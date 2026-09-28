import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { API_URL, apiError } from '../../core/api';
import { QuestionType } from '../question-banks/content.models';
import { AttemptHistoryItem, QuizAttemptResult, SubmissionReceipt } from './result.models';
export enum AttemptStatus {
  InProgress = 1,
  Completed = 2,
}
export interface AttemptAnswer {
  answerId: number;
  content: string;
}
export interface AttemptQuestion {
  questionId: number;
  content: string;
  questionType: QuestionType;
  questionOrder: number;
  points: number;
  answers: AttemptAnswer[];
}
export interface QuizAttempt {
  quizAttemptId: number;
  quizId: number;
  quizTitle: string;
  startedAt: string;
  expiresAt?: string | null;
  serverNow?: string;
  submittedAt: string | null;
  score: number | null;
  totalPoints: number;
  percentage: number | null;
  status: AttemptStatus;
  questions: AttemptQuestion[];
}
export interface AttemptSubmission {
  questions: { questionId: number; answerIds: number[] }[];
}
@Injectable({ providedIn: 'root' })
export class AttemptService {
  private http = inject(HttpClient);
  private url = inject(API_URL) + '/quiz-attempts';
  start(quizId: number) {
    return this.http.post<QuizAttempt>(this.url, { quizId });
  }
  get(id: number) {
    return this.http.get<QuizAttempt>(this.url + '/' + id);
  }
  submit(id: number, body: AttemptSubmission) {
    return this.http.post<SubmissionReceipt>(this.url + '/' + id + '/submit', body);
  }
  result(id: number) {
    return this.http.get<QuizAttemptResult>(this.url + '/' + id + '/result');
  }
  history(page = 1, pageSize = 20) {
    return this.http.get<AttemptHistoryItem[]>(this.url + '/mine', { params: { page, pageSize } });
  }
}
export function attemptError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404)
      return 'This attempt or quiz is unavailable for your account. Return to Public Quizzes.';
    if (error.status === 409)
      return 'This attempt may already be submitted. Check its status before trying again.';
    if (error.status === 400)
      return 'Your answers could not be accepted. Refresh the attempt and review your selections.';
  }
  return apiError(error);
}
