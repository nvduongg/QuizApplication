import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ResultPage } from './result-page';
import { HistoryPage } from './history-page';
import { AttemptStatus } from './attempt.service';
import { QuizAttemptResult, QuestionOutcome } from './result.models';
import { QuestionType } from '../question-banks/content.models';
import { ResultQuestionReview } from './result-question-review';

const result: QuizAttemptResult = {
  quizAttemptId: 15,
  quizId: 8,
  quizTitle: 'Backend fundamentals',
  status: AttemptStatus.Completed,
  startedAt: '2026-09-15T00:00:00Z',
  submittedAt: '2026-09-15T00:10:00Z',
  score: 2,
  totalPoints: 10,
  percentage: 20,
  reviewAvailable: true,
  questions: [
    {
      questionId: 1,
      content: 'Create a resource?',
      questionType: QuestionType.SingleChoice,
      questionOrder: 1,
      earnedPoints: 2,
      maxPoints: 2,
      outcome: QuestionOutcome.Correct,
      selectedAnswerIds: [12],
      correctAnswerIds: [12],
      answers: [
        { answerId: 11, content: 'GET' },
        { answerId: 12, content: 'POST' },
      ],
    },
    {
      questionId: 2,
      content: 'Idempotent methods?',
      questionType: QuestionType.MultipleChoice,
      questionOrder: 2,
      earnedPoints: 0,
      maxPoints: 3,
      outcome: QuestionOutcome.Incorrect,
      selectedAnswerIds: [21, 24],
      correctAnswerIds: [21, 22, 23],
      answers: [
        { answerId: 21, content: 'GET' },
        { answerId: 22, content: 'PUT' },
        { answerId: 23, content: 'DELETE' },
        { answerId: 24, content: 'POST' },
      ],
    },
    {
      questionId: 3,
      content: 'HTTP is stateless.',
      questionType: QuestionType.TrueFalse,
      questionOrder: 3,
      earnedPoints: 0,
      maxPoints: 5,
      outcome: QuestionOutcome.Unanswered,
      selectedAnswerIds: [],
      correctAnswerIds: [31],
      answers: [
        { answerId: 31, content: 'True' },
        { answerId: 32, content: 'False' },
      ],
    },
  ],
};
describe('Result and history contracts', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: '15' }));
    query = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params, queryParamMap: query, snapshot: {} },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  for (const type of [
    QuestionType.SingleChoice,
    QuestionType.MultipleChoice,
    QuestionType.TrueFalse,
  ]) {
    it(`centers the shared read-only answer structure and preserves feedback for type ${type}`, async () => {
      const f = TestBed.createComponent(ResultQuestionReview);
      f.componentRef.setInput('number', 1);
      f.componentRef.setInput('question', {
        ...result.questions[1],
        questionType: type,
        answers: result.questions[1].answers.map((a, i) => ({
          ...a,
          content:
            i === 0
              ? 'An interface can define contracts and preserve long code-like content: Example<T>.ExecuteAsync()'
              : a.content,
        })),
      });
      await f.whenStable();
      const rows: HTMLElement[] = [...f.nativeElement.querySelectorAll('.review-answers > li')];
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect([...row.children].map((e) => e.classList[0])).toEqual([
          'answer-control',
          'answer-content',
          'answer-meaning',
        ]);
        const style = getComputedStyle(row);
        expect(style.display).toBe('grid');
        expect(style.alignItems).toBe('center');
        const indicator = row.querySelector('.selection')!;
        expect(indicator.getAttribute('aria-hidden')).toBe('true');
        expect(indicator.classList.contains('square')).toBe(type === QuestionType.MultipleChoice);
        expect(getComputedStyle(indicator).lineHeight).toBe('1');
        const meaning = row.querySelector('.answer-meaning')!;
        expect(getComputedStyle(meaning).alignItems).toBe('center');
        expect(meaning.querySelector('app-icon + span')).not.toBeNull();
      }
      expect(rows[0].textContent).toContain('Your answer · Correct selection');
      expect(rows[1].textContent).toContain('Correct answer');
      expect(rows[2].textContent).toContain('Correct answer');
      expect(rows[3].textContent).toContain('Your answer · Incorrect selection');
      expect(getComputedStyle(f.nativeElement.querySelector('.question-heading')).alignItems).toBe(
        'center',
      );
      expect(f.nativeElement.querySelector('input')).toBeNull();
    });
  }
  it('renders correct, incorrect and unanswered with backend awarded points and all selection meanings', async () => {
    const f = TestBed.createComponent(ResultPage);
    expect(f.componentInstance.loading()).toBe(true);
    http.expectOne('/api/quiz-attempts/15/result').flush(result);
    await f.whenStable();
    const reviews: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll(
      'app-result-question-review',
    );
    expect(reviews.length).toBe(3);
    expect(reviews[0].textContent).toContain('Correct');
    expect(reviews[1].textContent).toContain('0 / 3 points');
    const rows = [...reviews[1].querySelectorAll('li')].map((e) => e.textContent);
    expect(rows[0]).toContain('Your answer · Correct selection');
    expect(rows[1]).toContain('Correct answer');
    expect(rows[2]).toContain('Correct answer');
    expect(rows[3]).toContain('Your answer · Incorrect selection');
    expect(reviews[2].textContent).toContain('Unanswered');
    expect(reviews[2].textContent).toContain('Correct answer');
    expect(f.nativeElement.querySelector('input')).toBeNull();
    http.expectNone((r) => r.url.includes('/answers') || r.url === '/api/quiz-attempts/15');
  });
  it('displays the returned award without calculating partial credit', async () => {
    const f = TestBed.createComponent(ResultPage);
    http
      .expectOne('/api/quiz-attempts/15/result')
      .flush({ ...result, questions: [{ ...result.questions[1], earnedPoints: 0 }] });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('0 / 3 points');
    expect(f.nativeElement.textContent).not.toContain('1 / 3');
  });
  it('never fabricates legacy review even if unrelated question data is supplied', async () => {
    const f = TestBed.createComponent(ResultPage);
    http.expectOne('/api/quiz-attempts/15/result').flush({ ...result, reviewAvailable: false });
    await f.whenStable();
    expect(f.nativeElement.querySelector('app-result-question-review')).toBeNull();
    expect(f.nativeElement.textContent).toContain('20%');
  });
  it('cancels stale result loads when the record changes', async () => {
    const f = TestBed.createComponent(ResultPage);
    const first = http.expectOne('/api/quiz-attempts/15/result');
    params.next(convertToParamMap({ id: '17' }));
    expect(first.cancelled).toBe(true);
    http.expectOne('/api/quiz-attempts/17/result').flush({ ...result, quizAttemptId: 17 });
    await f.whenStable();
    expect(f.componentInstance.result()?.quizAttemptId).toBe(17);
  });
  it('shows safe result errors and retries the result endpoint', async () => {
    const f = TestBed.createComponent(ResultPage);
    http
      .expectOne('/api/quiz-attempts/15/result')
      .flush({ detail: 'SQL System.Exception' }, { status: 500, statusText: 'Error' });
    await f.whenStable();
    expect(f.nativeElement.textContent).not.toContain('System.Exception');
    f.componentInstance.load();
    http.expectOne('/api/quiz-attempts/15/result').flush(result);
    await f.whenStable();
    expect(f.componentInstance.error()).toBe('');
  });
  it('uses actual attempt IDs for history Result and Continue links without starting an attempt', async () => {
    const f = TestBed.createComponent(HistoryPage);
    const r = http.expectOne('/api/quiz-attempts/mine?page=1&pageSize=20');
    expect(r.request.params.has('userId')).toBe(false);
    r.flush([
      result,
      {
        ...result,
        quizAttemptId: 16,
        status: AttemptStatus.InProgress,
        score: null,
        percentage: null,
        submittedAt: null,
      },
    ]);
    await f.whenStable();
    const links: NodeListOf<HTMLAnchorElement> =
      f.nativeElement.querySelectorAll('.history-action');
    expect(links[0].getAttribute('href')).toBe('/app/attempts/15/result');
    expect(links[1].getAttribute('href')).toBe('/app/attempts/16');
    expect(f.nativeElement.querySelector('.pagination')).toBeNull();
    http.expectNone((r) => r.method === 'POST');
  });
  it('does not flash empty while loading; distinguishes errors, retries and empty', async () => {
    const f = TestBed.createComponent(HistoryPage);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Loading history');
    expect(f.nativeElement.textContent).not.toContain('No quiz attempts');
    http
      .expectOne('/api/quiz-attempts/mine?page=1&pageSize=20')
      .flush({}, { status: 500, statusText: 'Error' });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Retry');
    f.componentInstance.load();
    http.expectOne('/api/quiz-attempts/mine?page=1&pageSize=20').flush([]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No quiz attempts yet.');
  });
  it('uses bounded lookahead to avoid a Next button on an exactly full final page', async () => {
    const f = TestBed.createComponent(HistoryPage);
    http
      .expectOne('/api/quiz-attempts/mine?page=1&pageSize=20')
      .flush(Array.from({ length: 20 }, (_, i) => ({ ...result, quizAttemptId: i + 1 })));
    http.expectOne('/api/quiz-attempts/mine?page=2&pageSize=20').flush([]);
    await f.whenStable();
    expect(f.componentInstance.hasNext()).toBe(false);
    expect(f.nativeElement.querySelector('.pagination')).toBeNull();
  });
  it('shows Next when another page exists, and Previous on an empty later page', async () => {
    const f = TestBed.createComponent(HistoryPage);
    http
      .expectOne('/api/quiz-attempts/mine?page=1&pageSize=20')
      .flush(Array.from({ length: 20 }, (_, i) => ({ ...result, quizAttemptId: i + 1 })));
    http.expectOne('/api/quiz-attempts/mine?page=2&pageSize=20').flush([result]);
    await f.whenStable();
    expect(f.componentInstance.hasNext()).toBe(true);
    query.next(convertToParamMap({ page: '2' }));
    http.expectOne('/api/quiz-attempts/mine?page=2&pageSize=20').flush([]);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No attempts on this page');
    expect(f.nativeElement.textContent).toContain('Previous');
  });
});
