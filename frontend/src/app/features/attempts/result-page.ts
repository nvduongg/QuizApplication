import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AttemptService } from './attempt.service';
import { QuizAttemptResult } from './result.models';
import { ResultQuestionReview } from './result-question-review';
import { Icon } from '../../shared/icon';
import { apiError } from '../../core/api';
@Component({
  selector: 'app-result-page',
  host: { class: 'has-page-back' },
  imports: [RouterLink, Icon, DatePipe, ResultQuestionReview],
  styleUrl: './review.scss',
  template: `<a class="page-back" routerLink="/app/history"><app-icon name="back" /> History</a>
    @if (loading()) {
      <div class="page-heading"><h1>Quiz result</h1></div>
      <p class="loading" role="status">Loading result…</p>
    } @else if (error()) {
      <div class="page-heading">
        <h1>{{ active() ? 'Quiz in progress' : 'Unable to open result' }}</h1>
      </div>
      <p class="error" role="alert">{{ error() }}</p>
      @if (active()) {
        <a class="button" [routerLink]="['/app/attempts', id]"
          >Continue quiz <app-icon name="forward"
        /></a>
      } @else {
        <button type="button" class="button secondary" (click)="load()">Retry</button>
      }
    } @else if (result(); as result) {
      <div class="page-heading">
        <h1>Quiz completed</h1>
        <p class="quiz-title">{{ result.quizTitle }}</p>
      </div>
      <section class="result-summary" aria-label="Result summary">
        <p class="score">{{ result.score ?? '—' }} / {{ result.totalPoints }} points</p>
        <p class="percentage">
          {{ result.percentage === null ? 'Percentage unavailable' : result.percentage + '%' }}
        </p>
        @if (result.submittedAt) {
          <p class="result-date">Submitted {{ result.submittedAt | date: 'medium' }}</p>
        }
      </section>
      @if (result.reviewAvailable) {
        <h2>Review your answers</h2>
        @for (question of result.questions; track question.questionId; let i = $index) {
          <app-result-question-review [question]="question" [number]="i + 1" />
        }
      } @else {
        <p class="state">Detailed answer review is unavailable for this earlier attempt.</p>
      }
    }`,
})
export class ResultPage {
  private api = inject(AttemptService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  private request?: Subscription;
  id = 0;
  result = signal<QuizAttemptResult | null>(null);
  loading = signal(true);
  error = signal('');
  active = signal(false);
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.id = Number(p.get('id'));
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.result.set(null);
    this.error.set('');
    this.active.set(false);
    this.loading.set(true);
    if (!Number.isSafeInteger(this.id) || this.id < 1) {
      this.error.set('This result could not be found.');
      this.loading.set(false);
      return;
    }
    this.request = this.api
      .result(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.result.set({
            ...result,
            questions: [...result.questions].sort((a, b) => a.questionOrder - b.questionOrder),
          });
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.active.set(e instanceof HttpErrorResponse && e.status === 409);
          this.error.set(
            this.active()
              ? 'This attempt has not been submitted. Continue your quiz when you are ready.'
              : e instanceof HttpErrorResponse && e.status === 404
                ? 'This result could not be found or is not available to your account.'
                : apiError(e),
          );
        },
      });
  }
}
