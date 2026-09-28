import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService, sessionFromToken } from './core/auth';
import { apiError, PublicQuizService } from './core/api';
import { apiInterceptor } from './core/security';
import { routes } from './app.routes';
import { AuthPage } from './features/auth/auth-page';
const tokenFor = (roles: string | string[] = 'User', exp = Date.now() / 1000 + 3600) =>
  'header.' +
  btoa(
    JSON.stringify({
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': 'user-1',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.test',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': roles,
      exp,
    }),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.signature';
describe('Foundation integration', () => {
  let http: HttpTestingController;
  let saved: string | null;
  beforeEach(() => {
    saved = localStorage.getItem('quiz.foundation.session');
    localStorage.removeItem('quiz.foundation.session');
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    if (saved === null) localStorage.removeItem('quiz.foundation.session');
    else localStorage.setItem('quiz.foundation.session', saved);
    vi.restoreAllMocks();
  });
  function login(role = 'User') {
    TestBed.inject(AuthService)
      .login({ email: 'user@example.test', password: 'Password1!' })
      .subscribe();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({
      accessToken: tokenFor(role),
      fullName: 'Alex Morgan',
      email: 'user@example.test',
      roles: [role],
      userId: 'user-1',
      expiresAt: '',
    });
  }
  it('extracts exact URI role claims and rejects expired or malformed JWTs', () => {
    expect(sessionFromToken(tokenFor(['User', 'Administrator']))?.roles).toEqual([
      'User',
      'Administrator',
    ]);
    expect(sessionFromToken(tokenFor('User', 1))).toBeNull();
    expect(sessionFromToken('broken')).toBeNull();
  });
  it('restores user state from stored JWT and ignores stored role overrides', () => {
    login();
    const stored = JSON.parse(localStorage.getItem('quiz.foundation.session')!);
    expect(stored.token).toBeTruthy();
    expect(stored.roles).toBeUndefined();
    expect(TestBed.inject(AuthService).session()?.fullName).toBe('Alex Morgan');
  });
  for (const role of ['User', 'Administrator'])
    for (const path of ['/app', '/admin'])
      it(role + ' route access ' + path, async () => {
        login(role);
        const harness = await RouterTestingHarness.create();
        await harness.navigateByUrl(path);
        expect(TestBed.inject(Router).url).toBe(
          (role === 'User' && path === '/app') || (role === 'Administrator' && path === '/admin')
            ? path
            : '/access-denied',
        );
      });
  it('redirects guests to login for protected pages', async () => {
    const harness = await RouterTestingHarness.create('/admin');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Sign in');
  });
  it('allows public browsing without a token', async () => {
    await RouterTestingHarness.create('/quizzes');
    const request = http.expectOne('/api/public/quizzes');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });
  it('attaches tokens only to protected API requests', () => {
    login();
    const client = TestBed.inject(HttpClient);
    for (const url of [
      '/api/quizzes/mine',
      '/api/public/quizzes',
      'https://example.test/api/other',
    ]) {
      client.get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(url === '/api/quizzes/mine');
      request.flush([]);
    }
  });
  it('clears session and navigates once on simultaneous 401 responses', () => {
    login();
    const router = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const client = TestBed.inject(HttpClient);
    client.get('/api/one').subscribe({ error: () => {} });
    client.get('/api/two').subscribe({ error: () => {} });
    http.expectOne('/api/one').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/two').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(AuthService).session()).toBeNull();
  });
  it('preserves safe validation but hides technical server failures', () => {
    expect(
      apiError(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'An account with this email already exists.' },
        }),
      ),
    ).toContain('already exists');
    expect(
      apiError(new HttpErrorResponse({ status: 500, error: { detail: 'SQL stack trace' } })),
    ).not.toContain('SQL');
  });
  it('sends search as the backend query parameter', () => {
    TestBed.inject(PublicQuizService).list(' HTTP ').subscribe();
    const request = http.expectOne('/api/public/quizzes?search=HTTP');
    request.flush([]);
  });
  it('registers with no role and does not assume automatic login', async () => {
    const harness = await RouterTestingHarness.create('/register');
    const page = harness.routeDebugElement?.componentInstance as AuthPage;
    page.form.setValue({
      fullName: ' New User ',
      email: 'new@example.test',
      password: 'Password1!',
    });
    page.submit();
    page.submit();
    const request = http.expectOne('/api/auth/register');
    expect(request.request.body).toEqual({
      fullName: 'New User',
      email: 'new@example.test',
      password: 'Password1!',
    });
    request.flush(
      { message: 'Account created successfully.' },
      { status: 201, statusText: 'Created' },
    );
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Account created');
    expect(TestBed.inject(AuthService).session()).toBeNull();
  });
  it('logout clears only this frontend session', () => {
    login();
    TestBed.inject(AuthService).clear();
    expect(localStorage.getItem('quiz.foundation.session')).toBeNull();
    expect(TestBed.inject(AuthService).token()).toBeNull();
  });
});
