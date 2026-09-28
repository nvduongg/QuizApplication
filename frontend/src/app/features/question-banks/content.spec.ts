import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth';
import { Session } from '../../core/models';
import { roleGuard } from '../../core/security';
import { AnswerManager } from './answer-manager';
import { BankList } from './bank-list';
import { BankDetail } from './bank-detail';
import { BankForm } from './bank-form';
import { QuestionEditor } from './question-editor';
import { Answer, QuestionBank, QuestionDetail, QuestionType, Visibility } from './content.models';
import { answerProblem, contentError } from './content.rules';
import { AnswerService, QuestionBankService, QuestionService } from './content.services';
const bank: QuestionBank = {
  questionBankId: 7,
  name: 'Network fundamentals',
  description: 'Reusable questions',
  visibility: Visibility.Private,
  createdAt: '2026-09-14T00:00:00Z',
  ownerId: 'owner',
  ownerName: 'Test owner',
  questionCount: 0,
};
const question: QuestionDetail = {
  questionId: 9,
  questionBankId: 7,
  content: 'Choose a protocol',
  questionType: QuestionType.SingleChoice,
  createdAt: bank.createdAt,
  answers: [],
};
const answer: Answer = { answerId: 11, questionId: 9, content: 'HTTP', isCorrect: true };
const session = signal<Session | null>({
  token: 'test-only',
  userId: 'owner',
  fullName: 'Test owner',
  email: 'owner@example.test',
  roles: ['User'],
  expires: Date.now() + 60000,
});
describe('Owned question content management', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({
      token: 'test-only',
      userId: 'owner',
      fullName: 'Test owner',
      email: 'owner@example.test',
      roles: ['User'],
      expires: Date.now() + 60000,
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '9' })) } },
        {
          provide: AuthService,
          useValue: {
            session,
            token: () => session()?.token,
            hasRole: (role: string) => session()?.roles.some((r) => r === role),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    // jsdom does not implement native modal behavior; browser focus trapping is native dialog behavior.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
  });
  afterEach(() => http.verify());
  it('waits for the owned list before showing an empty state and recovers from network errors', async () => {
    const f = TestBed.createComponent(BankList);
    await f.whenStable();
    expect(f.nativeElement.textContent).not.toContain('No question banks yet');
    http.expectOne('/api/question-banks/mine').error(new ProgressEvent('error'));
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Unable to load question banks');
    f.componentInstance.load();
    http.expectOne('/api/question-banks/mine').flush([]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No question banks yet');
  });
  it('rejects a blank bank name and creates the exact trimmed private-bank payload', async () => {
    const f = TestBed.createComponent(BankForm);
    await f.whenStable();
    f.componentInstance.initialize();
    f.componentInstance.form.patchValue({ name: '   ' });
    f.componentInstance.save();
    http.expectNone('/api/question-banks');
    f.componentInstance.form.patchValue({
      name: '  Network fundamentals  ',
      description: '  Reusable questions  ',
    });
    f.componentInstance.save();
    const r = http.expectOne('/api/question-banks');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({
      name: bank.name,
      description: bank.description,
      visibility: 1,
    });
    r.flush(bank);
    await f.whenStable();
    expect(f.nativeElement.querySelector('dialog')).toBeNull();
  });
  it('updates public visibility through PUT and preserves the form on a safe duplicate-name error', async () => {
    const f = TestBed.createComponent(BankForm);
    await f.whenStable();
    f.componentInstance.initialize(bank);
    f.componentInstance.form.patchValue({ visibility: Visibility.Public });
    f.componentInstance.save();
    const r = http.expectOne('/api/question-banks/7');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body.visibility).toBe(2);
    r.flush(
      { detail: 'You already have another Question Bank with this name.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain(
      'You already have another Question Bank with this name.',
    );
    expect(f.componentInstance.error()).not.toBe('');
  });
  it('does not load editable questions or expose actions for a non-owned bank', async () => {
    const f = TestBed.createComponent(BankDetail);
    http.expectOne('/api/question-banks/9').flush({
      ...bank,
      questionBankId: 9,
      ownerId: 'someone-else',
      visibility: Visibility.Public,
    });
    await f.whenStable();
    http.expectNone('/api/question-banks/9/questions');
    expect(f.nativeElement.textContent).toContain('belongs to another account');
    expect(f.nativeElement.querySelector('.row-actions')).toBeNull();
  });
  it('navigates bank creation to the shared editor page', async () => {
    const f = TestBed.createComponent(BankDetail);
    http.expectOne('/api/question-banks/9').flush({ ...bank, questionBankId: 9 });
    http.expectOne('/api/question-banks/9/questions').flush([]);
    await f.whenStable();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.createQuestion();
    expect(nav).toHaveBeenCalledWith(['/app/question-banks', 9, 'questions', 'create']);
    expect(router.serializeUrl(router.createUrlTree(nav.mock.calls[0][0]))).toBe(
      '/app/question-banks/9/questions/create',
    );
  });
  it('requires bank delete confirmation and displays the referenced-resource conflict', async () => {
    const f = TestBed.createComponent(BankDetail);
    http.expectOne('/api/question-banks/9').flush({ ...bank, questionBankId: 9 });
    http.expectOne('/api/question-banks/9/questions').flush([]);
    await f.whenStable();
    f.componentInstance.confirmDelete();
    http.expectNone((r) => r.method === 'DELETE');
    f.componentInstance.deleteBank();
    const r = http.expectOne('/api/question-banks/9');
    expect(r.request.method).toBe('DELETE');
    r.flush({ detail: 'Database foreign key constraint' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('used in a quiz or a past attempt');
    expect(f.nativeElement.textContent).not.toContain('foreign key');
  });
  it('blocks the question editor until ownership is verified', async () => {
    const f = TestBed.createComponent(QuestionEditor);
    http.expectOne('/api/questions/9').flush(question);
    http.expectOne('/api/question-banks/7').flush({ ...bank, ownerId: 'someone-else' });
    await f.whenStable();
    expect(f.nativeElement.querySelector('form')).toBeNull();
    http.expectNone('/api/questions/9/answers');
  });
  it('locks question type while answers exist and unlocks only after confirmed answer deletion', async () => {
    const f = TestBed.createComponent(QuestionEditor);
    http.expectOne('/api/questions/9').flush({ ...question, answers: [answer] });
    http.expectOne('/api/question-banks/7').flush(bank);
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([answer]);
    await f.whenStable();
    expect(f.componentInstance.form.controls.questionType.disabled).toBe(true);
    const manager = f.debugElement.query(By.directive(AnswerManager))
      .componentInstance as AnswerManager;
    manager.confirmDelete(answer);
    manager.deleteAnswer();
    expect(f.componentInstance.form.controls.questionType.disabled).toBe(true);
    http.expectOne('/api/answers/11').flush(null);
    await f.whenStable();
    expect(f.componentInstance.form.controls.questionType.enabled).toBe(true);
  });
  it('updates question content without changing the numeric type and refreshes answers', async () => {
    const f = TestBed.createComponent(QuestionEditor);
    http.expectOne('/api/questions/9').flush({ ...question, answers: [answer] });
    http.expectOne('/api/question-banks/7').flush(bank);
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([answer]);
    await f.whenStable();
    f.componentInstance.form.controls.content.setValue(' Revised question ');
    f.componentInstance.save();
    const r = http.expectOne('/api/questions/9');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ content: 'Revised question', questionType: 2 });
    r.flush({ ...question, content: 'Revised question', answers: [answer] });
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([answer]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Question updated.');
  });
  it('prevents a second correct single-choice answer before sending a request', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', question);
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([answer]);
    await f.whenStable();
    f.componentInstance.edit();
    f.componentInstance.form.setValue({ content: 'FTP', isCorrect: true });
    f.componentInstance.save();
    http.expectNone((r) => r.method === 'POST');
    expect(f.componentInstance.saveError()).toContain('Unmark the existing correct answer');
  });
  it('switches single-choice correctness sequentially and refreshes the confirmed selection', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', question);
    await f.whenStable();
    const second = { ...answer, answerId: 12, content: 'FTP', isCorrect: false };
    http.expectOne('/api/questions/9/answers').flush([answer, second]);
    await f.whenStable();
    const pending = f.componentInstance.chooseCorrect(second);
    const clear = http.expectOne('/api/answers/11');
    expect(clear.request.body.isCorrect).toBe(false);
    http.expectNone('/api/answers/12');
    clear.flush({ ...answer, isCorrect: false });
    await Promise.resolve();
    const mark = http.expectOne('/api/answers/12');
    expect(mark.request.body.isCorrect).toBe(true);
    mark.flush({ ...second, isCorrect: true });
    await pending;
    http.expectOne('/api/questions/9/answers').flush([
      { ...answer, isCorrect: false },
      { ...second, isCorrect: true },
    ]);
    await f.whenStable();
    const radios = f.nativeElement.querySelectorAll(
      'input[type=radio]',
    ) as NodeListOf<HTMLInputElement>;
    expect(Array.from(radios).map((r) => r.checked)).toEqual([false, true]);
  });
  it('restores the previous correct answer when selecting its replacement fails', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', question);
    await f.whenStable();
    const second = { ...answer, answerId: 12, content: 'FTP', isCorrect: false };
    http.expectOne('/api/questions/9/answers').flush([answer, second]);
    await f.whenStable();
    const pending = f.componentInstance.chooseCorrect(second);
    http.expectOne('/api/answers/11').flush({ ...answer, isCorrect: false });
    await Promise.resolve();
    http.expectOne('/api/answers/12').flush({}, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    const restore = http.expectOne('/api/answers/11');
    expect(restore.request.body.isCorrect).toBe(true);
    restore.flush(answer);
    await pending;
    http.expectOne('/api/questions/9/answers').flush([answer, second]);
    await f.whenStable();
    expect(f.componentInstance.correctChoice.value).toBe(11);
    expect(f.componentInstance.selectionError()).toBeTruthy();
  });
  it('changes one multiple-choice checkbox without clearing another correct answer', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', { ...question, questionType: QuestionType.MultipleChoice });
    await f.whenStable();
    const second = { ...answer, answerId: 12, content: 'FTP', isCorrect: false };
    http.expectOne('/api/questions/9/answers').flush([answer, second]);
    await f.whenStable();
    const pending = f.componentInstance.chooseCorrect(second, true);
    http.expectNone('/api/answers/11');
    http.expectOne('/api/answers/12').flush({ ...second, isCorrect: true });
    await pending;
    http.expectOne('/api/questions/9/answers').flush([answer, { ...second, isCorrect: true }]);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('input[type=checkbox]:checked').length).toBe(2);
  });
  it('adds multiple correct answers for Multiple Choice without refetch loops', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', { ...question, questionType: QuestionType.MultipleChoice });
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([answer]);
    await f.whenStable();
    f.componentInstance.edit();
    f.componentInstance.form.setValue({ content: ' FTP ', isCorrect: true });
    f.componentInstance.save();
    const r = http.expectOne('/api/questions/9/answers');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ content: 'FTP', isCorrect: true });
    r.flush({ ...answer, answerId: 12, content: 'FTP' });
    await f.whenStable();
    expect(f.componentInstance.answers().filter((a) => a.isCorrect).length).toBe(2);
    http.expectNone('/api/questions/9/answers');
  });
  it('offers only True/False content and rejects invalid or duplicate answers', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', { ...question, questionType: QuestionType.TrueFalse });
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([{ ...answer, content: 'True' }]);
    await f.whenStable();
    f.componentInstance.edit();
    await f.whenStable();
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
    expect(
      Array.from(
        f.nativeElement.querySelectorAll('#answer-content option') as NodeListOf<HTMLOptionElement>,
      ).map((o) => o.value),
    ).toEqual(['', 'True', 'False']);
    f.componentInstance.form.setValue({ content: 'Maybe', isCorrect: false });
    f.componentInstance.save();
    http.expectNone((r) => r.method === 'POST');
    expect(f.componentInstance.saveError()).toBe('Choose True or False.');
  });
  it('keeps an answer after a deletion conflict and removes it only after success', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', question);
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([answer]);
    await f.whenStable();
    f.componentInstance.confirmDelete(answer);
    http.expectNone((r) => r.method === 'DELETE');
    f.componentInstance.deleteAnswer();
    http.expectOne('/api/answers/11').flush({}, { status: 409, statusText: 'Conflict' });
    expect(f.componentInstance.answers().length).toBe(1);
    expect(f.componentInstance.deleteError()).toContain('past quiz attempt');
    f.componentInstance.deleteAnswer();
    http.expectOne('/api/answers/11').flush(null);
    await f.whenStable();
    expect(f.componentInstance.answers()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('Answer deleted.');
  });
  it('uses exact update and delete endpoints for questions, answers and banks', () => {
    TestBed.inject(AnswerService).update(11, { content: 'HTTP', isCorrect: false }).subscribe();
    const a = http.expectOne('/api/answers/11');
    expect(a.request.method).toBe('PUT');
    a.flush({ ...answer, isCorrect: false });
    TestBed.inject(QuestionService).delete(9).subscribe();
    const q = http.expectOne('/api/questions/9');
    expect(q.request.method).toBe('DELETE');
    q.flush(null);
    TestBed.inject(QuestionBankService).delete(7).subscribe();
    const b = http.expectOne('/api/question-banks/7');
    expect(b.request.method).toBe('DELETE');
    b.flush(null);
  });
  it('rejects Administrator-only and anonymous access through the existing User guard', () => {
    const route = new ActivatedRouteSnapshot();
    route.data = { role: 'User' };
    const state = {} as Parameters<typeof roleGuard>[1];
    session.update((s) => (s ? { ...s, roles: ['Administrator'] } : s));
    expect(String(TestBed.runInInjectionContext(() => roleGuard(route, state)))).toBe(
      '/access-denied',
    );
    session.set(null);
    expect(String(TestBed.runInInjectionContext(() => roleGuard(route, state)))).toBe('/login');
  });
});
describe('Content validation boundaries', () => {
  it('permits unfinished questions and detects case-insensitive duplicate answers', () => {
    expect(
      answerProblem(QuestionType.SingleChoice, [], { content: 'HTTP', isCorrect: false }),
    ).toBe('');
    expect(
      answerProblem(QuestionType.MultipleChoice, [answer], { content: ' http ', isCorrect: false }),
    ).toContain('already exists');
  });
  it('sanitizes technical errors and uses resource-specific missing-state copy', () => {
    expect(
      contentError(
        new HttpErrorResponse({ status: 500, error: { detail: 'SQL stack trace' } }),
        'answer',
      ),
    ).not.toContain('SQL');
    expect(contentError(new HttpErrorResponse({ status: 404 }), 'question bank')).toContain(
      'question bank is no longer available',
    );
  });
});
