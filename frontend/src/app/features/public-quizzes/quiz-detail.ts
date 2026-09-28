import { AttemptService, attemptError } from '../attempts/attempt.service';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { PublicQuizService, apiError } from '../../core/api';
import { PublicQuiz } from '../../core/models';
import { AuthService } from '../../core/auth';
@Component({
  selector: 'app-quiz-detail',
  host: { class: 'reading-page' },
  imports: [RouterLink, Icon, CountLabel],
  template: ` <a class="page-back" routerLink="/quizzes"><app-icon name="back" /> Public quizzes</a>
    @if (loading()) {
      <h1>Quiz details</h1>
      <p class="loading" role="status">Loading assessment…</p>
    } @else if (error()) {
      <h1>Quiz unavailable</h1>
      <section class="state" role="alert">
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Try again</button>
      </section>
    } @else if (quiz(); as quiz) {
      <div class="page-heading">
        <h1>{{ quiz.title }}</h1>
        <p>Public assessment · Created by {{ quiz.creatorName }}</p>
      </div>
      <section class="detail-content">
        <p class="full-description">{{ quiz.description || 'No description provided.' }}</p>
        <dl class="detail-meta">
          <div>
            <dt class="sr-only">Questions</dt>
            <dd>{{ quiz.questionCount | countLabel: 'question' }}</dd>
          </div>
          <div>
            <dt class="sr-only">Duration</dt>
            <dd>{{ quiz.duration }} min</dd>
          </div>
          <div>
            <dt class="sr-only">Total points</dt>
            <dd>{{ quiz.totalPoints | countLabel: 'point' }}</dd>
          </div>
        </dl>
        @if (auth.session()?.roles?.includes('User')) {
          @if (startedId()) {
            <a class="button" [routerLink]="['/app/attempts', startedId()]">Continue attempt</a>
          } @else {
            <button class="button" [disabled]="starting()" (click)="start()">
              {{ starting() ? 'Starting…' : 'Start quiz' }}
            </button>
          }
          @if (startError()) {
            <p class="error" role="alert">{{ startError() }}</p>
          }
        } @else if (auth.session()) {
          <p class="notice">Quiz participation requires a User account.</p>
        }
        @if (!auth.session()) {
          <a class="button" routerLink="/login">Sign in to start quiz</a>
          <p class="footnote">You can browse public quizzes without an account.</p>
        }
      </section>
    }`,
  styleUrl: './public-quizzes.scss',
})
export class QuizDetail {
  private attempts = inject(AttemptService);
  private router = inject(Router);
  starting = signal(false);
  startError = signal('');
  startedId = signal<number | null>(null);
  start() {
    const quiz = this.quiz();
    if (!quiz || this.starting() || this.startedId() || !this.auth.hasRole('User')) return;
    this.starting.set(true);
    this.startError.set('');
    this.startRequest = this.attempts
      .start(quiz.quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (a) => {
          this.starting.set(false);
          this.startedId.set(a.quizAttemptId);
          void this.router.navigate(['/app/attempts', a.quizAttemptId]);
        },
        error: (e) => {
          this.starting.set(false);
          this.startError.set(attemptError(e));
        },
      });
  }
  readonly auth = inject(AuthService);
  private readonly api = inject(PublicQuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private startRequest?: Subscription;
  private id = 0;
  readonly quiz = signal<PublicQuiz | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.startRequest?.unsubscribe();
      this.starting.set(false);
      this.startedId.set(null);
      this.startError.set('');
      this.id = Number(params.get('id'));
      this.load();
    });
  }
  load(): void {
    this.request?.unsubscribe();
    this.quiz.set(null);
    this.error.set('');
    this.loading.set(false);
    if (!Number.isSafeInteger(this.id) || this.id < 1) {
      this.error.set('This quiz is unavailable.');
      return;
    }
    this.loading.set(true);
    this.request = this.api
      .detail(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quiz) => {
          this.quiz.set(quiz);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
}
