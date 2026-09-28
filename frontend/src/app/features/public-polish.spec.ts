import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { QuizList } from './public-quizzes/quiz-list';
import { AuthPage } from './auth/auth-page';
const quiz = {
  quizId: 27,
  title: 'HTTP basics',
  description: 'Understand requests',
  creatorName: 'Test creator',
  duration: 20,
  questionCount: 4,
  totalPoints: 8,
  createdAt: '2026-09-14T00:00:00Z',
};
describe('Public discovery states and controls', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('waits for the API before showing the no-data state', async () => {
    const fixture = TestBed.createComponent(QuizList);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Loading quizzes');
    expect(fixture.nativeElement.textContent).not.toContain('0 quizzes');
    http.expectOne('/api/public/quizzes').flush([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No public quizzes yet');
  });
  it('submits explicit trimmed search and distinguishes no matches, then clears', async () => {
    const fixture = TestBed.createComponent(QuizList);
    http.expectOne('/api/public/quizzes').flush([quiz]);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = ' missing ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    http.expectNone('/api/public/quizzes?search=missing');
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    http.expectOne('/api/public/quizzes?search=missing').flush([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No matching quizzes');
    fixture.componentInstance.search = '';
    fixture.componentInstance.load();
    http.expectOne('/api/public/quizzes').flush([quiz]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('HTTP basics');
    expect(fixture.nativeElement.querySelector('.view-link').getAttribute('href')).toBe(
      '/quizzes/27',
    );
  });
  it('recovers from failure without displaying technical response details', async () => {
    const fixture = TestBed.createComponent(QuizList);
    http
      .expectOne('/api/public/quizzes')
      .flush({ detail: 'SQL exception' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Unable to load quizzes');
    expect(fixture.nativeElement.textContent).not.toContain('SQL');
    fixture.componentInstance.load();
    http.expectOne('/api/public/quizzes').flush([quiz]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Test creator');
  });
  for (const status of [0, 500, 502]) {
    it(`ends loading and permits retry when the backend is unavailable (${status})`, async () => {
      const fixture = TestBed.createComponent(QuizList);
      const request = http.expectOne('/api/public/quizzes');
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush('AggregateError [ECONNREFUSED]', { status, statusText: 'Proxy failure' });
      await fixture.whenStable();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('Unable to load quizzes');
      expect(fixture.nativeElement.textContent).not.toMatch(/AggregateError|ECONNREFUSED|Loading quizzes/);
      const retry = fixture.nativeElement.querySelector('section[role="alert"] button') as HTMLButtonElement;
      retry.click();
      http.expectOne('/api/public/quizzes').flush([quiz]);
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('HTTP basics');
      expect(fixture.componentInstance.error()).toBe('');
    });
  }
  it('loads detail using the route ID and renders only public metadata', async () => {
    const harness = await RouterTestingHarness.create('/quizzes/27');
    http.expectOne('/api/public/quizzes/27').flush(quiz);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('HTTP basics');
    expect(harness.routeNativeElement?.textContent).toContain('8');
    expect(harness.routeNativeElement?.textContent).not.toContain('Start quiz');
  });
  it('toggles password without submitting or clearing its value', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const page = harness.routeDebugElement?.componentInstance as AuthPage;
    page.form.controls.password.setValue('Password1!');
    await harness.fixture.whenStable();
    const button = harness.routeNativeElement!.querySelector('.reveal') as HTMLButtonElement;
    expect(button.type).toBe('button');
    button.click();
    await harness.fixture.whenStable();
    expect(button.textContent?.trim()).toBe('Hide');
    expect(button.getAttribute('aria-label')).toBe('Hide password');
    expect((harness.routeNativeElement!.querySelector('#password') as HTMLInputElement).type).toBe(
      'text',
    );
    expect(page.form.controls.password.value).toBe('Password1!');
    http.expectNone('/api/auth/login');
  });
});
