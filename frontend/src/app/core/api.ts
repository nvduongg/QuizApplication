import { InjectionToken, Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { PublicQuiz } from './models';
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
@Injectable({ providedIn: 'root' })
export class PublicQuizService {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_URL) + '/public/quizzes';
  list(search = '') {
    return this.http.get<PublicQuiz[]>(this.url, {
      params: search.trim() ? { search: search.trim() } : {},
    });
  }
  detail(id: number) {
    return this.http.get<PublicQuiz>(`${this.url}/${id}`);
  }
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Something went wrong. Please try again.';
  const body = record(error.error);
  const messages = [
    body['message'],
    body['detail'],
    ...Object.values(record(body['errors'])).flat(),
  ].filter((item): item is string => typeof item === 'string');
  const safe = messages.filter((message) =>
    /^(Full name cannot be empty\.|Email and password are required\.|An account with this email already exists\.|Invalid email or password\.|This account is inactive or blocked\.|Passwords must |The (FullName|Email|Password) field |The Email field is not a valid e-mail address)/.test(
      message,
    ),
  );
  if ((error.status === 400 || error.status === 401) && safe.length) return safe.join(' ');
  switch (error.status) {
    case 0:
      return 'Unable to connect. Please check your connection and try again.';
    case 400:
      return 'Check the information you entered and try again.';
    case 401:
      return 'Please sign in again to continue.';
    case 403:
      return 'You do not have permission to access this content.';
    case 404:
      return 'This resource could not be found.';
    case 409:
      return 'This action conflicts with the current state of the content. Refresh and try again.';
    default:
      return 'Unable to complete this request. Please try again.';
  }
}
