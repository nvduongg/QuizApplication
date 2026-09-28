import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth';
import { AttemptClock, timerLabel, timerWarning } from './attempt-clock';
import { AttemptPage } from './attempt-page';
import { QuizAttempt, AttemptStatus } from './attempt.service';

const timed: QuizAttempt = {
  quizAttemptId: 51,
  quizId: 21,
  quizTitle: 'Timed assessment',
  startedAt: '2026-09-22T00:00:00Z',
  expiresAt: '2026-09-22T00:10:00Z',
  serverNow: '2026-09-22T00:02:00Z',
  submittedAt: null,
  score: null,
  totalPoints: 1,
  percentage: null,
  status: AttemptStatus.InProgress,
  questions: [
    {
      questionId: 1,
      content: 'True?',
      questionType: 3,
      questionOrder: 1,
      points: 1,
      answers: [
        { answerId: 11, content: 'True' },
        { answerId: 12, content: 'False' },
      ],
    },
  ],
};

describe('Authoritative attempt countdown', () => {
  it('uses server deadline and monotonic elapsed time, never configured duration or wall-clock changes', () => {
    const clock = new AttemptClock();
    expect(clock.reset(timed.expiresAt!, timed.serverNow!, 100)).toBe(true);
    expect(clock.remaining(100)).toBe(480);
    expect(clock.remaining(30100)).toBe(450);
    expect(clock.remaining(900000)).toBe(0);
    expect(timerLabel(872)).toBe('14:32');
    expect(timerLabel(0)).toBe('0:00');
  });
  it('uses restrained warning thresholds at five minutes and one minute', () => {
    expect(timerWarning(301)).toBe('normal');
    expect(timerWarning(300)).toBe('warning');
    expect(timerWarning(61)).toBe('warning');
    expect(timerWarning(60)).toBe('urgent');
    expect(timerWarning(0)).toBe('urgent');
  });
  it('rejects malformed authoritative timestamps', () => {
    expect(new AttemptClock().reset('invalid', timed.serverNow!, 0)).toBe(false);
  });
});

describe('Timed participation workflow', () => {
  let http: HttpTestingController;
  let monotonic: number;
  let navigate: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    monotonic = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => monotonic);
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '51' })) } },
        { provide: AuthService, useValue: { session: () => ({ userId: 'owner' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  async function page(data = timed) {
    const f = TestBed.createComponent(AttemptPage);
    f.detectChanges();
    http.expectOne('/api/quiz-attempts/51').flush(data);
    await f.whenStable();
    return f;
  }
  it('renders remaining time and refresh/reopen continues from original deadline', async () => {
    const first = await page();
    expect(first.nativeElement.textContent).toContain('8:00');
    first.destroy();
    const reopened = await page({ ...timed, serverNow: '2026-09-22T00:04:00Z' });
    expect(reopened.nativeElement.textContent).toContain('6:00');
    expect(reopened.componentInstance.attempt()?.expiresAt).toBe(timed.expiresAt);
  });
  it('does not invent a countdown for legacy null deadlines', async () => {
    const f = await page({ ...timed, expiresAt: null });
    expect(f.nativeElement.querySelector('[role="timer"]')).toBeNull();
    f.componentInstance.tick();
    http.expectNone((r) => r.method === 'POST');
  });
  it('submits saved local answers once at zero, locks editing, and opens the normal result', async () => {
    sessionStorage.setItem('quizizi.attempt.owner.51', JSON.stringify({ 1: [11] }));
    const f = await page({ ...timed, serverNow: '2026-09-22T00:09:59Z' });
    monotonic += 1000;
    f.componentInstance.tick();
    f.componentInstance.tick();
    await f.whenStable();
    expect(f.componentInstance.expired()).toBe(true);
    expect(f.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('Time expired');
    f.componentInstance.clear(1);
    expect(f.componentInstance.selections()[1]).toEqual([11]);
    const submit = http.expectOne('/api/quiz-attempts/51/submit');
    expect(submit.request.body).toEqual({ questions: [{ questionId: 1, answerIds: [11] }] });
    http.expectNone((r) => r.method === 'POST');
    submit.flush({ quizAttemptId: 51, status: 2, submittedAt: timed.expiresAt });
    expect(navigate).toHaveBeenCalledWith(['/app/attempts', 51, 'result'], { replaceUrl: true });
  });
  it('reconciles uncertain auto-submit without looping, keeps a manual finalization retry', async () => {
    const f = await page({ ...timed, serverNow: timed.expiresAt! });
    http.expectOne('/api/quiz-attempts/51/submit').error(new ProgressEvent('error'));
    http.expectOne('/api/quiz-attempts/51').flush({ ...timed, serverNow: timed.expiresAt! });
    f.componentInstance.tick();
    f.componentInstance.tick();
    http.expectNone((r) => r.method === 'POST');
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Retry finalization');
    expect(f.componentInstance.expired()).toBe(true);
    f.componentInstance.submit();
    http
      .expectOne('/api/quiz-attempts/51/submit')
      .flush({ quizAttemptId: 51, status: 2, submittedAt: timed.expiresAt });
  });
  it('accepts another tab winning submission and navigates to its result', async () => {
    await page({ ...timed, serverNow: timed.expiresAt! });
    http
      .expectOne('/api/quiz-attempts/51/submit')
      .flush({}, { status: 409, statusText: 'Conflict' });
    http.expectOne('/api/quiz-attempts/51').flush({ ...timed, status: AttemptStatus.Completed });
    expect(navigate).toHaveBeenCalledWith(['/app/attempts', 51, 'result'], { replaceUrl: true });
  });
  it('reanchors when returning to the tab instead of resetting the deadline', async () => {
    const f = await page();
    window.dispatchEvent(new Event('focus'));
    http.expectOne('/api/quiz-attempts/51').flush({ ...timed, serverNow: '2026-09-22T00:09:30Z' });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('0:30');
    expect(f.nativeElement.querySelector('.attempt-timer').classList.contains('urgent')).toBe(true);
  });
  it('does not overlap a manual submission when the deadline passes', async () => {
    const f = await page({ ...timed, serverNow: '2026-09-22T00:09:59Z' });
    f.componentInstance.submit();
    const submit = http.expectOne('/api/quiz-attempts/51/submit');
    monotonic += 1000;
    f.componentInstance.tick();
    expect(f.componentInstance.expired()).toBe(true);
    http.expectNone((r) => r.method === 'POST');
    submit.flush({ quizAttemptId: 51, status: 2, submittedAt: timed.expiresAt });
    f.componentInstance.tick();
    http.expectNone((r) => r.method === 'POST');
  });
  it('locks malformed timing data and recovers on a successful status check', async () => {
    const f = await page({ ...timed, serverNow: undefined });
    expect(f.componentInstance.expired()).toBe(true);
    expect(f.componentInstance.error()).toContain('Unable to verify');
    http.expectNone((r) => r.method === 'POST');
    f.componentInstance.checkStatus();
    http.expectOne('/api/quiz-attempts/51').flush(timed);
    expect(f.componentInstance.expired()).toBe(false);
    expect(f.componentInstance.remaining()).toBe(480);
  });
});
