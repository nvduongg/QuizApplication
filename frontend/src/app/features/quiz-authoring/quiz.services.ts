import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/api';
import { QuestionBank, QuestionSummary } from '../question-banks/content.models';
import { AddQuizQuestion, OwnedQuiz, QuizInput, QuizQuestion } from './quiz.models';
@Injectable({ providedIn: 'root' })
export class QuizService {
  private http = inject(HttpClient);
  private url = inject(API_URL) + '/quizzes';
  mine() {
    return this.http.get<OwnedQuiz[]>(this.url + '/mine');
  }
  detail(id: number) {
    return this.http.get<OwnedQuiz>(this.url + '/' + id);
  }
  create(body: QuizInput) {
    return this.http.post<OwnedQuiz>(this.url, body);
  }
  update(id: number, body: QuizInput) {
    return this.http.put<OwnedQuiz>(this.url + '/' + id, body);
  }
  publish(id: number) {
    return this.http.put<OwnedQuiz>(this.url + '/' + id + '/publish', {});
  }
  unpublish(id: number) {
    return this.http.put<OwnedQuiz>(this.url + '/' + id + '/unpublish', {});
  }
  delete(id: number) {
    return this.http.delete<void>(this.url + '/' + id);
  }
}
@Injectable({ providedIn: 'root' })
export class QuizQuestionService {
  private http = inject(HttpClient);
  private base = inject(API_URL) + '/quizzes';
  private url(id: number) {
    return this.base + '/' + id + '/questions';
  }
  list(id: number) {
    return this.http.get<QuizQuestion[]>(this.url(id));
  }
  add(id: number, body: AddQuizQuestion) {
    return this.http.post<QuizQuestion>(this.url(id), body);
  }
  points(id: number, questionId: number, points: number) {
    return this.http.put<QuizQuestion>(this.url(id) + '/' + questionId + '/points', { points });
  }
  reorder(id: number, questionIds: number[]) {
    return this.http.put<void>(this.url(id) + '/order', { questionIds });
  }
  remove(id: number, questionId: number) {
    return this.http.delete<void>(this.url(id) + '/' + questionId);
  }
}
@Injectable({ providedIn: 'root' })
export class QuestionReuseService {
  private http = inject(HttpClient);
  private base = inject(API_URL);
  ownedBanks() {
    return this.http.get<QuestionBank[]>(this.base + '/question-banks/mine');
  }
  publicBanks() {
    return this.http.get<QuestionBank[]>(this.base + '/question-banks/public');
  }
  byBank(id: number) {
    return this.http.get<QuestionSummary[]>(this.base + '/question-banks/' + id + '/questions');
  }
  search(search: string) {
    return this.http.get<QuestionSummary[]>(this.base + '/questions/search', {
      params: { search: search.trim() },
    });
  }
}
