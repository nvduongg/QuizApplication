import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { API_URL, apiError } from '../../core/api';
import { Visibility } from '../question-banks/content.models';
export interface AdminUser {
  userId: string;
  email: string;
  fullName: string;
  isBlocked: boolean;
  roles: string[];
}
export interface AdminQuiz {
  quizId: number;
  title: string;
  creatorId: string;
  visibility: Visibility;
  questionCount: number;
  attemptCount: number;
}
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private url = inject(API_URL) + '/admin';
  users() {
    return this.http.get<AdminUser[]>(this.url + '/users');
  }
  user(id: string) {
    return this.http.get<AdminUser>(this.url + '/users/' + encodeURIComponent(id));
  }
  status(id: string, blocked: boolean) {
    return this.http.put<AdminUser>(this.url + '/users/' + encodeURIComponent(id) + '/status', {
      blocked,
    });
  }
  quizzes() {
    return this.http.get<AdminQuiz[]>(this.url + '/quizzes');
  }
  disable(id: number) {
    return this.http.put<void>(this.url + '/quizzes/' + id + '/disable', {});
  }
  delete(id: number) {
    return this.http.delete<void>(this.url + '/quizzes/' + id);
  }
}
export function adminError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 404) return 'This user or quiz is no longer available. Refresh the list.';
    if (e.status === 409) return 'This quiz has existing attempts and cannot be deleted.';
  }
  return apiError(e);
}
