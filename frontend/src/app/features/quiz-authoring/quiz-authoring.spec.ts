import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth';
import {
  QuestionType,
  Visibility,
  QuestionBank,
  QuestionSummary,
} from '../question-banks/content.models';
import { OwnedQuiz, QuizQuestion } from './quiz.models';
import { MyQuizzes } from './my-quizzes';
import { QuizForm } from './quiz-form';
import { QuizBuilder } from './quiz-builder';
import { QuestionPicker } from './question-picker';
import { quizError, validPoints } from './quiz.rules';
import { routes } from '../../app.routes';
import { roleGuard } from '../../core/security';
const quiz: OwnedQuiz = {
  quizId: 21,
  title: 'Web foundations',
  description: 'A short assessment',
  duration: 20,
  visibility: Visibility.Private,
  createdAt: '2026-09-15T00:00:00Z',
  creatorId: 'owner',
  creatorName: 'Test owner',
  questionCount: 2,
  totalPoints: 3,
};
const first: QuizQuestion = {
  quizId: 21,
  questionId: 100,
  content: 'Choose a protocol.',
  questionType: QuestionType.SingleChoice,
  questionOrder: 1,
  points: 1,
  answerCount: 2,
  isOwnedQuestion: true,
};
const second: QuizQuestion = {
  ...first,
  questionId: 200,
  content: 'Select valid methods.',
  questionType: QuestionType.MultipleChoice,
  questionOrder: 2,
  points: 2,
  isOwnedQuestion: false,
};
const bank: QuestionBank = {
  questionBankId: 7,
  name: 'My bank',
  description: null,
  visibility: Visibility.Private,
  ownerId: 'owner',
  ownerName: 'Test owner',
  questionCount: 2,
  createdAt: quiz.createdAt,
};
const publicBank: QuestionBank = {
  ...bank,
  questionBankId: 8,
  name: 'Shared bank',
  ownerId: 'another',
  ownerName: 'Another creator',
  visibility: Visibility.Public,
};
const question: QuestionSummary = {
  questionId: 100,
  questionBankId: 7,
  content: first.content,
  questionType: first.questionType,
  answerCount: 2,
  createdAt: quiz.createdAt,
};
const publicQuestion: QuestionSummary = {
  ...question,
  questionId: 200,
  questionBankId: 8,
  content: second.content,
};
describe('Quiz authoring contracts and state', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '21' })),
            snapshot: {
              paramMap: convertToParamMap({ id: '21' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            session: signal({ userId: 'owner', fullName: 'Preview account', roles: ['User'] }),
            home: () => '/app',
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
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
  async function builder(visibility = Visibility.Private) {
    const f = TestBed.createComponent(QuizBuilder);
    http.expectOne('/api/quizzes/21').flush({ ...quiz, visibility });
    http.expectOne('/api/quizzes/21/questions').flush([first, second]);
    await f.whenStable();
    return f;
  }
  async function picker(existing: QuizQuestion[] = []) {
    const f = TestBed.createComponent(QuestionPicker);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.detectChanges();
    http.expectOne('/api/quizzes/21').flush(quiz);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/quizzes/21/questions').flush(existing);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/question-banks/mine').flush([bank]);
    http.expectOne('/api/question-banks/public').flush([publicBank]);
    http.expectOne('/api/question-banks/7/questions').flush([question, publicQuestion]);
    await f.whenStable();
    return f;
  }
  it('waits for the mine response before rendering empty state, and retries failures', async () => {
    const f = TestBed.createComponent(MyQuizzes);
    await f.whenStable();
    expect(f.nativeElement.textContent).not.toContain('No quizzes yet');
    http.expectOne('/api/quizzes/mine').flush({}, { status: 500, statusText: 'Error' });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Unable to load your quizzes');
    f.componentInstance.load();
    http.expectOne('/api/quizzes/mine').flush([]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No quizzes yet');
  });
  it('validates metadata and creates only exact supported fields, then navigates to builder', async () => {
    const f = TestBed.createComponent(QuizForm);
    await f.whenStable();
    f.componentInstance.initialize();
    f.componentInstance.form.setValue({ title: '  ', description: '', duration: 1.5 });
    f.componentInstance.save();
    http.expectNone('/api/quizzes');
    f.componentInstance.form.setValue({
      title: ' Web foundations ',
      description: ' ',
      duration: 45,
    });
    f.componentInstance.save();
    const r = http.expectOne('/api/quizzes');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ title: 'Web foundations', description: null, duration: 45 });
    r.flush({ ...quiz, duration: 45, questionCount: 0, totalPoints: 0 });
    await f.whenStable();
    expect(f.nativeElement.querySelector('dialog')).toBeNull();
    const list = TestBed.createComponent(MyQuizzes);
    http.expectOne('/api/quizzes/mine').flush([]);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    list.componentInstance.editQuiz(quiz);
    expect(nav).toHaveBeenCalledWith(['/app/quizzes', 21, 'edit']);
  });
  it('updates metadata without sending visibility or relationship fields', async () => {
    const f = TestBed.createComponent(QuizForm);
    await f.whenStable();
    f.componentInstance.initialize({ ...quiz, visibility: Visibility.Public });
    f.componentInstance.form.controls.title.setValue('Updated');
    f.componentInstance.save();
    const r = http.expectOne('/api/quizzes/21');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({
      title: 'Updated',
      description: quiz.description,
      duration: 20,
    });
    r.flush({ ...quiz, title: 'Updated', visibility: Visibility.Public });
  });
  it('does not request quiz questions or expose authoring actions for another owner', async () => {
    const f = TestBed.createComponent(QuizBuilder);
    http.expectOne('/api/quizzes/21').flush({ ...quiz, creatorId: 'another' });
    await f.whenStable();
    http.expectNone('/api/quizzes/21/questions');
    expect(f.nativeElement.textContent).toContain('only your own quizzes');
    expect(f.nativeElement.querySelector('.toolbar')).toBeNull();
  });
  it('reorders every relationship ID only after success and preserves old order on failure', async () => {
    const f = await builder();
    f.componentInstance.move(0, 1);
    let r = http.expectOne('/api/quizzes/21/questions/order');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ questionIds: [200, 100] });
    expect(f.componentInstance.rows()[0].questionId).toBe(100);
    r.flush({}, { status: 409, statusText: 'Conflict' });
    expect(f.componentInstance.rows()[0].questionId).toBe(100);
    f.componentInstance.move(0, 1);
    r = http.expectOne('/api/quizzes/21/questions/order');
    r.flush(null);
    expect(f.componentInstance.rows().map((q) => q.questionId)).toEqual([200, 100]);
    expect(f.componentInstance.message()).toBe('Order updated.');
  });
  it('saves points explicitly to the relationship, calculates totals and rejects invalid precision', async () => {
    const f = await builder();
    f.componentInstance.editPoints(first);
    f.componentInstance.points.setValue(2.5);
    http.expectNone((r) => r.method === 'PUT');
    f.componentInstance.savePoints(new Event('submit'), first);
    const r = http.expectOne('/api/quizzes/21/questions/100/points');
    expect(r.request.body).toEqual({ points: 2.5 });
    r.flush({ ...first, points: 2.5 });
    expect(f.componentInstance.total()).toBe(4.5);
    f.componentInstance.points.setValue(0.001);
    f.componentInstance.savePoints(new Event('submit'), first);
    http.expectNone((r) => r.method === 'PUT');
    expect(f.componentInstance.error()).toContain('two decimal places');
  });
  it('removes only the quiz-question relationship after confirmation', async () => {
    const f = await builder();
    f.componentInstance.ask('remove', first);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('The question will remain in its Question Bank');
    http.expectNone((r) => r.method === 'DELETE');
    f.componentInstance.confirmAction();
    const r = http.expectOne('/api/quizzes/21/questions/100');
    expect(r.request.method).toBe('DELETE');
    http.expectNone('/api/questions/100');
    r.flush(null);
    expect(f.componentInstance.rows().length).toBe(1);
    expect(f.componentInstance.rows()[0].questionOrder).toBe(1);
    expect(f.componentInstance.total()).toBe(2);
  });
  it('maps publishing validation IDs to visible row numbers without leaking technical text', async () => {
    const f = await builder();
    f.componentInstance.ask('publish');
    http.expectNone('/api/quizzes/21/publish');
    f.componentInstance.confirmAction();
    const r = http.expectOne('/api/quizzes/21/publish');
    expect(r.request.method).toBe('PUT');
    r.flush(
      { detail: 'Multiple Choice question 200 must have at least one correct answer.' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(f.componentInstance.actionError()).toBe(
      'Question 2 must have at least one correct answer.',
    );
    expect(f.componentInstance.published()).toBe(false);
  });
  it('publishes, protects all structural operations, and enables them after unpublishing', async () => {
    const f = await builder();
    f.componentInstance.ask('publish');
    f.componentInstance.confirmAction();
    http.expectOne('/api/quizzes/21/publish').flush({ ...quiz, visibility: Visibility.Public });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Unpublish this quiz before changing');
    expect(f.nativeElement.querySelector('button[aria-label="Move question 1 down"]')).toBeNull();
    f.componentInstance.move(0, 1);
    f.componentInstance.savePoints(new Event('submit'), first);
    http.expectNone((r) => r.method === 'PUT');
    f.componentInstance.ask('unpublish');
    f.componentInstance.confirmAction();
    http.expectOne('/api/quizzes/21/unpublish').flush(quiz);
    await f.whenStable();
    expect(
      f.nativeElement.querySelector('button[aria-label="Move question 1 down"]'),
    ).not.toBeNull();
  });
  it('keeps a quiz after a historical-attempt deletion conflict', async () => {
    const f = await builder();
    f.componentInstance.ask('delete');
    http.expectNone((r) => r.method === 'DELETE');
    f.componentInstance.confirmAction();
    http
      .expectOne('/api/quizzes/21')
      .flush(
        { detail: 'The Quiz has existing attempts and cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(f.componentInstance.quiz()).not.toBeNull();
    expect(f.componentInstance.actionError()).toContain('past attempts');
  });
  it('joins origin labels, disables included questions, and searches only on explicit submit', async () => {
    const f = await picker([first]);
    expect(f.componentInstance.included(100)).toBe(true);
    expect(f.componentInstance.origin(8)).toBe('Public · Another creator · Shared bank');
    f.componentInstance.query.setValue(' protocol ');
    http.expectNone('/api/questions/search?search=protocol');
    f.componentInstance.search();
    http.expectOne('/api/questions/search?search=protocol').flush([question]);
    await f.whenStable();
    expect(f.nativeElement.querySelector('input[type="checkbox"]').disabled).toBe(true);
  });
  it('adds sequentially, retains partial success, then retries only failed questions', async () => {
    const f = await picker();
    f.componentInstance.selected.set(
      new Map([
        [100, question],
        [200, publicQuestion],
      ]),
    );
    const adding = f.componentInstance.addSelected();
    http.expectOne('/api/quizzes/21').flush(quiz);
    await Promise.resolve();
    await Promise.resolve();
    const a = http.expectOne('/api/quizzes/21/questions');
    expect(a.request.body).toEqual({ questionId: 100, points: 1 });
    http.expectNone((r) => r.method === 'POST');
    a.flush(first);
    await Promise.resolve();
    const b = http.expectOne('/api/quizzes/21/questions');
    expect(b.request.body.questionId).toBe(200);
    b.flush({}, { status: 500, statusText: 'Error' });
    await Promise.resolve();
    http.expectOne('/api/quizzes/21/questions').flush([first]);
    await adding;
    expect(f.componentInstance.selected().has(100)).toBe(false);
    expect(f.componentInstance.selected().has(200)).toBe(true);
    expect(f.componentInstance.failures().length).toBe(1);
    const retry = f.componentInstance.addSelected();
    http.expectOne('/api/quizzes/21').flush(quiz);
    await Promise.resolve();
    await Promise.resolve();
    const c = http.expectOne('/api/quizzes/21/questions');
    expect(c.request.body.questionId).toBe(200);
    c.flush(second);
    await Promise.resolve();
    http.expectOne('/api/quizzes/21/questions').flush([first, second]);
    await retry;
    expect(f.componentInstance.selected().size).toBe(0);
  });
  it('blocks retry after an uncertain reconciliation until refresh succeeds', async () => {
    const f = await picker();
    f.componentInstance.selected.set(new Map([[100, question]]));
    const adding = f.componentInstance.addSelected();
    http.expectOne('/api/quizzes/21').flush(quiz);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/quizzes/21/questions').flush(first);
    await Promise.resolve();
    http.expectOne('/api/quizzes/21/questions').error(new ProgressEvent('error'));
    await adding;
    expect(f.componentInstance.syncFailed()).toBe(true);
    await f.componentInstance.addSelected();
    http.expectNone((r) => r.method === 'POST');
    const refresh = f.componentInstance.refreshIncluded();
    http.expectOne('/api/quizzes/21/questions').flush([first]);
    await refresh;
    expect(f.componentInstance.syncFailed()).toBe(false);
  });
  it('guards both authoring routes with User access', () => {
    const children = routes.find((r) => r.path === '')!.children!;
    for (const path of [
      'app/quizzes',
      'app/quizzes/:id/builder',
      'app/quizzes/:id/questions/add',
    ]) {
      const route = children.find((r) => r.path === path)!;
      expect(route.data?.['role']).toBe('User');
      expect(route.canActivate).toContain(roleGuard);
    }
  });
  it('navigates to a dedicated picker URL instead of opening a dialog', async () => {
    const f = await builder();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.addFromBank();
    expect(nav).toHaveBeenCalledWith(['/app/quizzes', 21, 'questions', 'add']);
    expect(router.serializeUrl(router.createUrlTree(nav.mock.calls[0][0]))).toBe(
      '/app/quizzes/21/questions/add',
    );
  });
  it('renders a page with singular/plural actions and cancels without a mutation', async () => {
    const f = await picker();
    expect(f.nativeElement.querySelector('dialog')).toBeNull();
    expect(f.nativeElement.querySelector('h1').textContent).toBe('Add questions');
    f.componentInstance.selected.set(new Map([[100, question]]));
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('1 question selected');
    expect(f.nativeElement.textContent).toContain('Add 1 question');
    f.componentInstance.selected.set(
      new Map([
        [100, question],
        [200, publicQuestion],
      ]),
    );
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Add 2 questions');
    f.componentInstance.close();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/app/quizzes', 21, 'builder']);
    http.expectNone((r) => r.method === 'POST');
  });
  it('returns to the builder only after successful additions are reconciled', async () => {
    const f = await picker();
    f.componentInstance.selected.set(new Map([[100, question]]));
    const adding = f.componentInstance.addSelected();
    http.expectOne('/api/quizzes/21').flush(quiz);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/quizzes/21/questions').flush(first);
    await Promise.resolve();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    http.expectOne('/api/quizzes/21/questions').flush([first]);
    await adding;
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/app/quizzes', 21, 'builder'], {
      queryParams: { added: 100 },
    });
  });
  it('blocks a stale page if the quiz is published before addition', async () => {
    const f = await picker();
    f.componentInstance.selected.set(new Map([[100, question]]));
    const adding = f.componentInstance.addSelected();
    http.expectOne('/api/quizzes/21').flush({ ...quiz, visibility: Visibility.Public });
    await adding;
    expect(f.componentInstance.contextError()).toContain('unpublished');
    http.expectNone((r) => r.method === 'POST');
  });
});
describe('Authoring validation and safe errors', () => {
  it('honors decimal storage and DTO points limits', () => {
    for (const n of [0, -1, 0.001, 100000.01, NaN, Infinity]) expect(validPoints(n)).toBe(false);
    for (const n of [0.01, 2.5, 100000]) expect(validPoints(n)).toBe(true);
  });
  it('does not display arbitrary server details or unmapped question IDs', () => {
    expect(
      quizError(new HttpErrorResponse({ status: 500, error: { detail: 'SQL exception' } })),
    ).not.toContain('SQL');
    expect(
      quizError(
        new HttpErrorResponse({
          status: 400,
          error: { detail: 'Question 900 must contain at least two answers.' },
        }),
      ),
    ).toBe('A question in this quiz must contain at least two answers.');
  });
});
