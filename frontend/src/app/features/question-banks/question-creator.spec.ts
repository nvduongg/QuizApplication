import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth';
import { QuestionCreator } from './question-creator';
import { QuestionType, QuestionBank, Visibility } from './content.models';

const bank: QuestionBank = {
  questionBankId: 7,
  name: 'My bank',
  ownerId: 'owner',
  ownerName: 'Owner',
  visibility: Visibility.Private,
  description: null,
  createdAt: '',
  questionCount: 0,
};
const question = {
  questionId: 22,
  questionBankId: 7,
  content: 'Test question',
  questionType: 2,
  answers: [],
  createdAt: '',
};
const quiz = { quizId: 5, creatorId: 'owner', visibility: 1 };
const row = { quizId: 5, questionId: 22, points: 1, questionOrder: 1 };
describe('Shared question creation and quiz attachment', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: AuthService, useValue: { session: signal({ userId: 'owner' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function setup(quizMode = true, banks = [bank]) {
    const f = TestBed.createComponent(QuestionCreator);
    if (quizMode) f.componentRef.setInput('quizId', 5);
    else f.componentRef.setInput('bankId', 7);
    f.detectChanges();
    if (quizMode) {
      http.expectOne('/api/quizzes/5').flush({ ...quiz, title: 'My quiz' });
      await tick();
      http.expectOne('/api/question-banks/mine').flush(banks);
    } else http.expectOne('/api/question-banks/7').flush(bank);
    await f.whenStable();
    const c = f.componentInstance;
    c.form.patchValue({ content: 'Test question' });
    c.answers.at(0).setValue({ content: 'A', isCorrect: true });
    c.answers.at(1).setValue({ content: 'B', isCorrect: false });
    return { f, c };
  }
  const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  async function createAndAnswers(c: QuestionCreator) {
    http.expectOne('/api/quizzes/5').flush(quiz);
    await tick();
    http.expectOne('/api/question-banks/7/questions').flush(question);
    await tick();
    http.expectOne('/api/questions/22/answers').flush([]);
    await tick();
    http
      .expectOne('/api/questions/22/answers')
      .flush({ answerId: 1, questionId: 22, content: 'A', isCorrect: true });
    await tick();
    http
      .expectOne('/api/questions/22/answers')
      .flush({ answerId: 2, questionId: 22, content: 'B', isCorrect: false });
    await tick();
    expect(c.created()?.questionId).toBe(22);
  }
  it('filters foreign banks, preselects a sole owned bank, and requires a choice with multiple banks', async () => {
    const { c } = await setup(true, [
      bank,
      { ...bank, questionBankId: 8, ownerId: 'foreign', visibility: 2 },
    ]);
    expect(c.banks().length).toBe(1);
    expect(c.form.controls.bankId.value).toBe(7);
    c.form.controls.bankId.setValue(0);
    const loading = c.loadBanks();
    http.expectOne('/api/question-banks/mine').flush([bank, { ...bank, questionBankId: 9 }]);
    await loading;
    expect(c.form.controls.bankId.value).toBe(0);
  });
  it('handles zero banks and selects an explicitly created bank while preserving question data', async () => {
    const { c, f } = await setup(true, []);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain("You don't have a question bank yet.");
    const loading = c.loadBanks(7);
    http.expectOne('/api/question-banks/mine').flush([bank]);
    await loading;
    expect(c.form.controls.bankId.value).toBe(7);
    expect(c.form.controls.content.value).toBe('Test question');
  });
  it('validates correctness and duplicates with shared answer rules for all three types', async () => {
    const { c } = await setup();
    c.answers.at(1).controls.isCorrect.setValue(true);
    expect(c.problem()).toContain('correct answer');
    c.form.controls.questionType.setValue(QuestionType.MultipleChoice);
    expect(c.problem()).toBe('');
    c.answers.at(1).controls.content.setValue(' a ');
    expect(c.problem()).toContain('already exists');
    c.form.controls.questionType.setValue(QuestionType.TrueFalse);
    c.changeType();
    expect(c.answers.getRawValue().map((a) => a.content)).toEqual(['True', 'False']);
    expect(c.problem()).toContain('exactly one');
    c.answers.at(0).controls.isCorrect.setValue(true);
    expect(c.problem()).toBe('');
  });
  it('creates once, saves answers, adds the same ID at 1 point and refreshes composition', async () => {
    const { c } = await setup();
    const done = vi.fn();
    c.attached.subscribe(done);
    const saving = c.submit();
    await c.submit();
    await createAndAnswers(c);
    http.expectOne('/api/quizzes/5/questions').flush([]);
    await tick();
    const add = http.expectOne('/api/quizzes/5/questions');
    expect(add.request.body).toEqual({ questionId: 22, points: 1 });
    add.flush(row);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([row]);
    await saving;
    expect(done).toHaveBeenCalledWith({ questionId: 22, rows: [row] });
  });
  it('keeps created question on attachment failure and retries only attachment', async () => {
    const { c } = await setup();
    const saving = c.submit();
    await createAndAnswers(c);
    http.expectOne('/api/quizzes/5/questions').flush([]);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush({}, { status: 500, statusText: 'Error' });
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([]);
    await saving;
    expect(c.error()).toContain('Question was created in My bank, but could not be added');
    const retry = c.submit();
    http.expectOne('/api/quizzes/5').flush(quiz);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([]);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush(row);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([row]);
    await retry;
    http.expectNone((r) => r.method === 'POST' && r.url.includes('question-banks'));
  });
  it('treats a duplicate attachment conflict as success only when the same ID is actually present', async () => {
    const { c } = await setup();
    const done = vi.fn();
    c.attached.subscribe(done);
    const saving = c.submit();
    await createAndAnswers(c);
    http.expectOne('/api/quizzes/5/questions').flush([]);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush({}, { status: 409, statusText: 'Conflict' });
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([row]);
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([row]);
    await saving;
    expect(done).toHaveBeenCalledOnce();
  });
  it('reconciles an answer whose response was lost before resuming without duplicating it', async () => {
    const { c } = await setup();
    const saving = c.submit();
    http.expectOne('/api/quizzes/5').flush(quiz);
    await tick();
    http.expectOne('/api/question-banks/7/questions').flush(question);
    await tick();
    http.expectOne('/api/questions/22/answers').flush([]);
    await tick();
    http.expectOne('/api/questions/22/answers').error(new ProgressEvent('error'));
    await saving;
    expect(c.error()).toContain('answers could not be completed');
    const retry = c.submit();
    http.expectOne('/api/quizzes/5').flush(quiz);
    await tick();
    http
      .expectOne('/api/questions/22/answers')
      .flush([{ answerId: 1, content: 'A', isCorrect: true }]);
    await tick();
    const answer = http.expectOne('/api/questions/22/answers');
    expect(answer.request.body.content).toBe('B');
    answer.flush({ answerId: 2, content: 'B', isCorrect: false });
    await tick();
    http.expectOne('/api/quizzes/5/questions').flush([row]);
    await retry;
  });
  it('blocks new creation for published or foreign quizzes before a question is written', async () => {
    const { c } = await setup();
    for (const q of [
      { ...quiz, visibility: 2 },
      { ...quiz, creatorId: 'foreign' },
    ]) {
      const saving = c.submit();
      http.expectOne('/api/quizzes/5').flush(q);
      await saving;
      expect(c.error()).toBe(
        q.visibility === 2
          ? 'Unpublish your quiz before adding questions.'
          : 'You can manage only your own quizzes.',
      );
      http.expectNone((r) => r.method === 'POST');
    }
  });
  it('does not replay uncertain question creation without an ID', async () => {
    const { c } = await setup();
    const saving = c.submit();
    http.expectOne('/api/quizzes/5').flush(quiz);
    await tick();
    http.expectOne('/api/question-banks/7/questions').error(new ProgressEvent('error'));
    await saving;
    expect(c.uncertain()).toBe(true);
    await c.submit();
    http.expectNone((r) => r.method === 'POST');
  });
  for (const status of [400, 401, 403, 404, 409])
    it('handles creation HTTP ' + status + ' without claiming a saved question', async () => {
      const { c } = await setup();
      const saving = c.submit();
      http.expectOne('/api/quizzes/5').flush(quiz);
      await tick();
      http
        .expectOne('/api/question-banks/7/questions')
        .flush({ detail: 'sensitive database detail' }, { status, statusText: 'Failure' });
      await saving;
      expect(c.error()).toContain('Question creation failed');
      expect(c.error()).not.toContain('sensitive');
      expect(c.created()).toBeNull();
    });
  it('uses the same form to create a normal bank question without quiz requests', async () => {
    const { c } = await setup(false);
    const done = vi.fn();
    c.saved.subscribe(done);
    const saving = c.submit();
    http.expectOne('/api/question-banks/7/questions').flush(question);
    await tick();
    http.expectOne('/api/questions/22/answers').flush([]);
    await tick();
    http
      .expectOne('/api/questions/22/answers')
      .flush({ answerId: 1, content: 'A', isCorrect: true });
    await tick();
    http
      .expectOne('/api/questions/22/answers')
      .flush({ answerId: 2, content: 'B', isCorrect: false });
    await saving;
    expect(done).toHaveBeenCalledOnce();
    http.expectNone((r) => r.url.includes('/quizzes'));
  });
});
