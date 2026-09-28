import { SuccessFeedback } from '../../shared/success-feedback';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ContentFeedback } from '../question-banks/content.services';
import { Visibility } from '../question-banks/content.models';
import { OwnedQuiz } from './quiz.models';
import { QuizService } from './quiz.services';
import { quizError } from './quiz.rules';
@Component({
  selector: 'app-my-quizzes',
  imports: [SuccessFeedback, RouterLink],
  styleUrl: './quiz.scss',
  template: `
    <div class="page-heading">
      <h1>My Quizzes</h1>
      <p>Create, organize, and publish your assessments.</p>
    </div>
    <div class="toolbar">
      <span>Your assessments</span><a class="button" routerLink="/app/quizzes/create">New quiz</a>
    </div>
    @if (message()) {
      <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
    }
    @if (loading()) {
      <p class="loading" role="status">Loading quizzes…</p>
    } @else if (error()) {
      <section class="state" role="alert">
        <h2>Unable to load your quizzes</h2>
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (!quizzes().length) {
      <section class="state">
        <h2>No quizzes yet</h2>
        <p>Create your first quiz and build it from reusable questions.</p>
        <a class="button" routerLink="/app/quizzes/create">New quiz</a>
      </section>
    } @else {
      <ul class="content-list">
        @for (quiz of quizzes(); track quiz.quizId) {
          <li class="content-row">
            <div class="row-copy">
              <h2>
                <a [routerLink]="['/app/quizzes', quiz.quizId, 'builder']">{{ quiz.title }}</a>
              </h2>
              <div class="metadata">
                <span class="badge">{{
                  quiz.visibility === visibility.Public ? 'Published' : 'Draft'
                }}</span
                ><span>{{ quiz.questionCount }} questions</span><span>{{ quiz.duration }} min</span
                ><span>{{ quiz.totalPoints }} pts</span>
              </div>
            </div>
            <div class="row-actions">
              <button
                class="button secondary"
                [attr.aria-label]="'Edit details: ' + quiz.title"
                (click)="editQuiz(quiz)"
              >
                Edit details</button
              ><a
                class="button secondary"
                [routerLink]="['/app/quizzes', quiz.quizId, 'builder']"
                [attr.aria-label]="'Open builder: ' + quiz.title"
                >Open builder</a
              >
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class MyQuizzes {
  private api = inject(QuizService);
  private destroy = inject(DestroyRef);
  private router = inject(Router);
  private feedback = inject(ContentFeedback);
  private request?: Subscription;
  visibility = Visibility;
  quizzes = signal<OwnedQuiz[]>([]);
  loading = signal(true);
  error = signal('');
  message = signal(this.feedback.take());
  constructor() {
    this.load();
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .mine()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (q) => {
          this.quizzes.set(q);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(quizError(e));
        },
      });
  }
  editQuiz(quiz: OwnedQuiz) {
    void this.router.navigate(['/app/quizzes', quiz.quizId, 'edit']);
  }
}
