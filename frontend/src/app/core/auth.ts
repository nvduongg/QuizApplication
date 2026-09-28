import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { API_URL } from './api';
import { AuthResponse, LoginRequest, RegisterRequest, Role, Session } from './models';
const KEY = 'quiz.foundation.session';
const CLAIMS = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/';
export function sessionFromToken(token: string, fullName = ''): Session | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
      (char) => char.charCodeAt(0),
    );
    const claims: Record<string, unknown> = JSON.parse(new TextDecoder().decode(bytes));
    const id = claims[CLAIMS + 'nameidentifier'];
    const email = claims[CLAIMS + 'emailaddress'];
    const rawRoles = claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    const roles = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).filter(
      (role): role is Role => role === 'User' || role === 'Administrator',
    );
    const expires = claims['exp'];
    if (
      typeof id !== 'string' ||
      typeof email !== 'string' ||
      typeof expires !== 'number' ||
      expires * 1000 <= Date.now() ||
      !roles.length
    )
      return null;
    return {
      token,
      userId: id,
      fullName: fullName || email,
      email,
      roles,
      expires: expires * 1000,
    };
  } catch {
    return null;
  }
}
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_URL) + '/auth';
  private readonly state = signal<Session | null>(this.restore());
  readonly session = this.state.asReadonly();
  readonly home = computed(() =>
    this.session()?.roles.includes('Administrator') ? '/admin' : '/app',
  );
  readonly notice = signal('');
  private restore(): Session | null {
    try {
      const stored: { token?: unknown; fullName?: unknown } =
        JSON.parse(localStorage.getItem(KEY) || 'null') ?? {};
      const session =
        typeof stored.token === 'string'
          ? sessionFromToken(
              stored.token,
              typeof stored.fullName === 'string' ? stored.fullName : '',
            )
          : null;
      if (!session) localStorage.removeItem(KEY);
      return session;
    } catch {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* Storage may be restricted. */
      }
      return null;
    }
  }
  token(): string | null {
    if (this.state() && this.state()!.expires <= Date.now()) this.clear();
    return this.state()?.token ?? null;
  }
  hasRole(role: Role): boolean {
    return !!this.token() && !!this.state()?.roles.includes(role);
  }
  login(model: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.url}/login`, model).pipe(
      tap((response) => {
        const session = sessionFromToken(response.accessToken, response.fullName);
        if (!session) throw new Error('Invalid session response');
        try {
          localStorage.setItem(
            KEY,
            JSON.stringify({ token: session.token, fullName: session.fullName }),
          );
        } catch {
          /* Keep a memory-only session when storage is unavailable. */
        }
        this.state.set(session);
        this.notice.set('');
      }),
    );
  }
  register(model: RegisterRequest) {
    return this.http.post<{ message: string }>(`${this.url}/register`, model);
  }
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* Clear in-memory state regardless. */
    }
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith('quizizi.attempt.')) sessionStorage.removeItem(key);
    } catch {
      /* Optional local drafts. */
    }
    this.state.set(null);
  }
}
