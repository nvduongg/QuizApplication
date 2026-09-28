import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../core/api';
import {
  Answer,
  AnswerInput,
  BankInput,
  QuestionBank,
  QuestionDetail,
  QuestionInput,
  QuestionSummary,
} from './content.models';
@Injectable({ providedIn: 'root' })
export class QuestionBankService {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_URL) + '/question-banks';
  mine() {
    return this.http.get<QuestionBank[]>(this.url + '/mine');
  }
  detail(id: number) {
    return this.http.get<QuestionBank>(this.url + '/' + id);
  }
  create(body: BankInput) {
    return this.http.post<QuestionBank>(this.url, body);
  }
  update(id: number, body: BankInput) {
    return this.http.put<QuestionBank>(this.url + '/' + id, body);
  }
  delete(id: number) {
    return this.http.delete<void>(this.url + '/' + id);
  }
}
@Injectable({ providedIn: 'root' })
export class QuestionService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  byBank(id: number) {
    return this.http.get<QuestionSummary[]>(this.base + '/question-banks/' + id + '/questions');
  }
  detail(id: number) {
    return this.http.get<QuestionDetail>(this.base + '/questions/' + id);
  }
  create(bankId: number, body: QuestionInput) {
    return this.http.post<QuestionDetail>(
      this.base + '/question-banks/' + bankId + '/questions',
      body,
    );
  }
  update(id: number, body: QuestionInput) {
    return this.http.put<QuestionDetail>(this.base + '/questions/' + id, body);
  }
  delete(id: number) {
    return this.http.delete<void>(this.base + '/questions/' + id);
  }
}
@Injectable({ providedIn: 'root' })
export class AnswerService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  byQuestion(id: number) {
    return this.http.get<Answer[]>(this.base + '/questions/' + id + '/answers');
  }
  create(questionId: number, body: AnswerInput) {
    return this.http.post<Answer>(this.base + '/questions/' + questionId + '/answers', body);
  }
  update(id: number, body: AnswerInput) {
    return this.http.put<Answer>(this.base + '/answers/' + id, body);
  }
  delete(id: number) {
    return this.http.delete<void>(this.base + '/answers/' + id);
  }
}
@Injectable({ providedIn: 'root' })
export class ContentFeedback {
  private readonly message = signal('');
  set(message: string) {
    this.message.set(message);
  }
  take() {
    const message = this.message();
    this.message.set('');
    return message;
  }
}
