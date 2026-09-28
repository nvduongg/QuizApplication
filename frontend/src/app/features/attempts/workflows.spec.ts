import { ResultPage } from './result-page';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../core/auth';
import { roleGuard } from '../../core/security';
import { routes } from '../../app.routes';
import { QuizDetail } from '../public-quizzes/quiz-detail';
import { AttemptPage } from './attempt-page';
import { AttemptService, AttemptStatus, QuizAttempt, attemptError } from './attempt.service';
import { AdminUsers } from '../admin/admin-users';
import { AdminQuizzes } from '../admin/admin-quizzes';
import { AdminUser, adminError } from '../admin/admin.service';
import { AnswerManager } from '../question-banks/answer-manager';
const attempt: QuizAttempt = {
  quizAttemptId: 51,
  quizId: 21,
  quizTitle: 'HTTP foundations',
  startedAt: '2026-09-15T00:00:00Z',
  submittedAt: null,
  score: null,
  totalPoints: 6,
  percentage: null,
  status: AttemptStatus.InProgress,
  questions: [
    {
      questionId: 1,
      content: 'Which method retrieves a resource?',
      questionType: 2,
      questionOrder: 1,
      points: 2,
      answers: [
        { answerId: 11, content: 'GET' },
        { answerId: 12, content: 'POST' },
      ],
    },
    {
      questionId: 2,
      content: 'Select HTTP methods.',
      questionType: 1,
      questionOrder: 2,
      points: 3,
      answers: [
        { answerId: 21, content: 'GET' },
        { answerId: 22, content: 'POST' },
      ],
    },
    {
      questionId: 3,
      content: 'HTTP is stateless.',
      questionType: 3,
      questionOrder: 3,
      points: 1,
      answers: [
        { answerId: 31, content: 'True' },
        { answerId: 32, content: 'False' },
      ],
    },
  ],
};
const completed: QuizAttempt = {
  ...attempt,
  status: AttemptStatus.Completed,
  score: 2,
  percentage: 33.33,
  submittedAt: '2026-09-15T00:10:00Z',
};
const user: AdminUser = {
  userId: 'account',
  email: 'reader@example.test',
  fullName: 'Test reader',
  roles: ['User'],
  isBlocked: false,
};
describe('Participation and administration workflows', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let roles: string[];
  let navigate: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    roles = ['User'];
    params = new BehaviorSubject(convertToParamMap({ id: '51' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { data: {} } } },
        {
          provide: AuthService,
          useValue: {
            session: () => ({ userId: 'owner', roles, fullName: 'Test owner' }),
            token: () => (roles.length ? 'test-token' : null),
            hasRole: (role: string) => roles.includes(role),
            home: () => '/app',
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
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
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  async function page() {
    const f = TestBed.createComponent(AttemptPage);
    http.expectOne('/api/quiz-attempts/51').flush(attempt);
    await f.whenStable();
    return f;
  }
  it('shares a first-line control column across all answer types and keeps text labels clickable', async () => {
    const f = await page();
    for (let i = 0; i < attempt.questions.length; i++) {
      f.componentInstance.index.set(i);
      await f.whenStable();
      const row = f.nativeElement.querySelector('.answer-option') as HTMLLabelElement;
      const control = row.querySelector('input')!;
      const content = row.querySelector('.answer-content') as HTMLElement;
      expect(getComputedStyle(row).display).toBe('grid');
      expect(getComputedStyle(row).alignItems).toBe('center');
      expect(control.parentElement?.className).toBe('answer-control');
      expect(getComputedStyle(control).margin).toBe('0px');
      expect(getComputedStyle(control.parentElement!).alignSelf).toBe('start');
      expect(getComputedStyle(content).overflowWrap).toBe('anywhere');
      content.click();
      expect(control.checked).toBe(true);
      expect(
        f.componentInstance.selected(
          attempt.questions[i].questionId,
          attempt.questions[i].answers[0].answerId,
        ),
      ).toBe(true);
    }
    expect(getComputedStyle(f.nativeElement.querySelector('.clear-answer')).paddingInline).toBe(
      '0px',
    );
  });
  it('starts exactly one attempt with only quizId and navigates using the returned attempt ID', async () => {
    const f = TestBed.createComponent(QuizDetail);
    http
      .expectOne('/api/public/quizzes/51')
      .flush({ quizId: 21, title: 'Quiz', questionCount: 3, totalPoints: 6, duration: 20 });
    await f.whenStable();
    f.componentInstance.start();
    f.componentInstance.start();
    const r = http.expectOne('/api/quiz-attempts');
    expect(r.request.body).toEqual({ quizId: 21 });
    r.flush(attempt);
    expect(navigate).toHaveBeenCalledWith(['/app/attempts', 51]);
    expect(f.componentInstance.startedId()).toBe(51);
  });
  it('hides participation from Administrator-only accounts', async () => {
    roles = ['Administrator'];
    const f = TestBed.createComponent(QuizDetail);
    http
      .expectOne('/api/public/quizzes/51')
      .flush({ quizId: 21, title: 'Quiz', questionCount: 3, totalPoints: 6, duration: 20 });
    await f.whenStable();
    f.componentInstance.start();
    http.expectNone('/api/quiz-attempts');
    expect(f.nativeElement.textContent).toContain('requires a User account');
  });
  it('uses native radios, checkboxes and safe attempt answer content', async () => {
    const f = await page();
    expect(f.nativeElement.querySelectorAll('input[type=radio]').length).toBe(2);
    f.componentInstance.index.set(1);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('input[type=checkbox]').length).toBe(2);
    f.componentInstance.index.set(2);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('input[type=radio]').length).toBe(2);
    expect(f.nativeElement.textContent).not.toContain('IsCorrect');
  });
  it('confirms partial submission, sends exact answered entries, and blocks duplicate submits', async () => {
    const f = await page();
    f.componentInstance.selections.set({ 1: [11] });
    f.componentInstance.askSubmit();
    await f.whenStable();
    expect(f.nativeElement.querySelector('dialog').open).toBe(true);
    expect(f.nativeElement.textContent).toContain('Submit with unanswered questions?');
    http.expectNone((r) => r.method === 'POST');
    f.componentInstance.submit();
    f.componentInstance.submit();
    const r = http.expectOne('/api/quiz-attempts/51/submit');
    expect(r.request.body).toEqual({ questions: [{ questionId: 1, answerIds: [11] }] });
    r.flush({
      quizAttemptId: 51,
      status: AttemptStatus.Completed,
      submittedAt: completed.submittedAt,
    });
    expect(navigate).toHaveBeenCalledWith(['/app/attempts', 51, 'result'], { replaceUrl: true });
  });
  it('allows an entirely unanswered submission', async () => {
    const f = await page();
    f.componentInstance.submit();
    const r = http.expectOne('/api/quiz-attempts/51/submit');
    expect(r.request.body).toEqual({ questions: [] });
    r.flush({
      quizAttemptId: 51,
      status: AttemptStatus.Completed,
      submittedAt: completed.submittedAt,
    });
  });
  it('retains multiple selections and clears a single answer using the DOM', async () => {
    const f = await page();
    const radio = f.nativeElement.querySelector('input') as HTMLInputElement;
    radio.click();
    await f.whenStable();
    expect(f.componentInstance.selections()[1]).toEqual([11]);
    f.componentInstance.clear(1);
    await f.whenStable();
    expect(radio.checked).toBe(false);
    f.componentInstance.index.set(1);
    await f.whenStable();
    const checks = f.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    checks[0].click();
    checks[1].click();
    await f.whenStable();
    expect(f.componentInstance.selections()[2]).toEqual([21, 22]);
  });
  it('filters restored drafts to current answer IDs and enforces one radio selection', async () => {
    sessionStorage.setItem(
      'quizizi.attempt.owner.51',
      JSON.stringify({ 1: [11, 12, 999], 2: [21, 22, 999], 999: [999] }),
    );
    const f = await page();
    expect(f.componentInstance.selections()).toEqual({ 1: [11], 2: [21, 22] });
  });
  it('recovers an already-submitted response by reading status, without resubmitting', async () => {
    const f = await page();
    f.componentInstance.submit();
    http
      .expectOne('/api/quiz-attempts/51/submit')
      .flush({}, { status: 409, statusText: 'Conflict' });
    expect(f.componentInstance.checking()).toBe(true);
    http.expectOne('/api/quiz-attempts/51').flush(completed);
    expect(f.componentInstance.completed()).toBe(true);
    http.expectNone((r) => r.method === 'POST');
  });
  it('keeps selected answers after a failed submit and a failed status check', async () => {
    const f = await page();
    f.componentInstance.selections.set({ 1: [11] });
    f.componentInstance.submit();
    http.expectOne('/api/quiz-attempts/51/submit').error(new ProgressEvent('error'));
    http.expectOne('/api/quiz-attempts/51').error(new ProgressEvent('error'));
    expect(f.componentInstance.selections()[1]).toEqual([11]);
    expect(f.componentInstance.busy()).toBe(false);
    expect(f.componentInstance.error()).toContain('connect');
  });
  it('renders the legacy aggregate result without fabricated review', async () => {
    const f = TestBed.createComponent(ResultPage);
    http
      .expectOne('/api/quiz-attempts/51/result')
      .flush({ ...completed, reviewAvailable: false, questions: [] });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('33.33%');
    expect(f.nativeElement.querySelector('input')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Detailed answer review is unavailable');
  });
  it('offers Continue for an unfinished result without fetching correctness elsewhere', async () => {
    const f = TestBed.createComponent(ResultPage);
    http
      .expectOne('/api/quiz-attempts/51/result')
      .flush({}, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Continue quiz');
    expect(f.nativeElement.querySelector('a.button').getAttribute('href')).toBe('/app/attempts/51');
  });
  it('shows missing-state feedback and never requests authoring endpoints for participation', async () => {
    const f = TestBed.createComponent(AttemptPage);
    http.expectOne('/api/quiz-attempts/51').flush({}, { status: 404, statusText: 'Not Found' });
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('unavailable for your account');
    http.expectNone((r) => r.url.includes('/answers'));
  });
  it('blocks and unblocks a user through the exact status DTO', async () => {
    params.next(convertToParamMap({}));
    const f = TestBed.createComponent(AdminUsers);
    http.expectOne('/api/admin/users').flush([user]);
    await f.whenStable();
    f.componentInstance.ask(user);
    http.expectNone((r) => r.method === 'PUT');
    f.componentInstance.changeStatus();
    const r = http.expectOne('/api/admin/users/account/status');
    expect(r.request.body).toEqual({ blocked: true });
    r.flush({ ...user, isBlocked: true });
    f.componentInstance.ask(f.componentInstance.users()[0]);
    f.componentInstance.changeStatus();
    const unblock = http.expectOne('/api/admin/users/account/status');
    expect(unblock.request.body).toEqual({ blocked: false });
    unblock.flush(user);
  });
  it('loads user details using the route ID', async () => {
    params.next(convertToParamMap({ id: 'account' }));
    const f = TestBed.createComponent(AdminUsers);
    http.expectOne('/api/admin/users/account').flush(user);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain(user.email);
  });
  it('disables a quiz to private and reports safe deletion conflicts', async () => {
    const q = {
      quizId: 21,
      title: 'Quiz',
      creatorId: 'owner',
      visibility: 2,
      questionCount: 3,
      attemptCount: 0,
    };
    const f = TestBed.createComponent(AdminQuizzes);
    http.expectOne('/api/admin/quizzes').flush([q]);
    await f.whenStable();
    f.componentInstance.ask(q, 'disable');
    f.componentInstance.confirmAction();
    const disable = http.expectOne('/api/admin/quizzes/21/disable');
    expect(disable.request.method).toBe('PUT');
    disable.flush(null);
    expect(f.componentInstance.quizzes()[0].visibility).toBe(1);
    f.componentInstance.ask(q, 'delete');
    f.componentInstance.confirmAction();
    http
      .expectOne('/api/admin/quizzes/21')
      .flush({ detail: 'SQL constraint' }, { status: 409, statusText: 'Conflict' });
    expect(f.componentInstance.quizzes().length).toBe(1);
    expect(f.componentInstance.actionError()).toContain('existing attempts');
  });
  it('removes a system quiz only after a successful DELETE', async () => {
    const q = {
      quizId: 21,
      title: 'Quiz',
      creatorId: 'owner',
      visibility: 1,
      questionCount: 3,
      attemptCount: 0,
    };
    const f = TestBed.createComponent(AdminQuizzes);
    http.expectOne('/api/admin/quizzes').flush([q]);
    await f.whenStable();
    f.componentInstance.ask(q, 'delete');
    f.componentInstance.confirmAction();
    expect(f.componentInstance.quizzes().length).toBe(1);
    http.expectOne('/api/admin/quizzes/21').flush(null);
    expect(f.componentInstance.quizzes()).toEqual([]);
  });
  it('protects all new routes with the backend roles', () => {
    const children = routes.find((r) => r.path === '')!.children!;
    for (const route of children.filter(
      (r) => r.path?.startsWith('admin/') || r.path?.startsWith('app/attempts/'),
    )) {
      expect(route.canActivate).toContain(roleGuard);
      expect(route.data?.['role']).toBe(
        route.path?.startsWith('admin/') ? 'Administrator' : 'User',
      );
    }
    const route = new ActivatedRouteSnapshot();
    route.data = { role: 'Administrator' };
    expect(
      String(
        TestBed.runInInjectionContext(() =>
          roleGuard(route, {} as Parameters<typeof roleGuard>[1]),
        ),
      ),
    ).toBe('/access-denied');
    roles = [];
    expect(
      String(
        TestBed.runInInjectionContext(() =>
          roleGuard(route, {} as Parameters<typeof roleGuard>[1]),
        ),
      ),
    ).toBe('/login');
  });
  it('sanitizes 400/401/403/404/409/500 failures', () => {
    for (const status of [400, 401, 403, 404, 409, 500]) {
      const e = new HttpErrorResponse({ status, error: { detail: 'System.Exception SQL <html>' } });
      expect(attemptError(e)).not.toContain('System.Exception');
      expect(adminError(e)).not.toContain('<html>');
    }
  });
  it('sets up real True/False answers sequentially and preserves a partial success', async () => {
    const f = TestBed.createComponent(AnswerManager);
    f.componentRef.setInput('question', {
      questionId: 9,
      questionBankId: 7,
      questionType: 3,
      content: 'True?',
      createdAt: '',
      answers: [],
    });
    await f.whenStable();
    http.expectOne('/api/questions/9/answers').flush([]);
    await f.whenStable();
    const pending = f.componentInstance.setupTrueFalse();
    const first = http.expectOne('/api/questions/9/answers');
    expect(first.request.body).toEqual({ content: 'True', isCorrect: false });
    first.flush({ answerId: 91, questionId: 9, content: 'True', isCorrect: false });
    await Promise.resolve();
    http.expectOne('/api/questions/9/answers').flush({}, { status: 500, statusText: 'Error' });
    await pending;
    http
      .expectOne('/api/questions/9/answers')
      .flush([{ answerId: 91, questionId: 9, content: 'True', isCorrect: false }]);
    await f.whenStable();
    expect(f.componentInstance.answers().length).toBe(1);
  });
});
