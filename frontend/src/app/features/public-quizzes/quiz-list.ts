import { Icon } from '../../shared/icon';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PublicQuizService, apiError } from '../../core/api';
import { PublicQuiz } from '../../core/models';
@Component({
  selector: 'app-quiz-list',
  imports: [Icon, RouterLink, FormsModule],
  template: `
    <div class="page-heading">
      <h1>Public Quizzes</h1>
      <p>Find an assessment. Explore something new.</p>
    </div>
    <form class="search-row" (ngSubmit)="load()">
      <div>
        <label for="search">Search quizzes</label
        ><input
          id="search"
          name="search"
          type="search"
          [(ngModel)]="search"
          placeholder="Title or description"
        />
      </div>
      <button class="button secondary" type="submit">Search</button>
      @if (query()) {
        <button class="text-button" type="button" (click)="search = ''; load()">Clear</button>
      }
    </form>
    @if (loading()) {
      <div class="loading" role="status">Loading quizzes…</div>
    } @else if (error()) {
      <section class="state" role="alert">
        <h2>Unable to load quizzes</h2>
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Try again</button>
      </section>
    } @else {
      <p class="result-count" role="status">
        {{ quizzes().length }} {{ quizzes().length === 1 ? 'quiz' : 'quizzes'
        }}{{ query() ? ' matching “' + query() + '”' : ' available' }}
      </p>
      <div class="quiz-grid">
        @for (quiz of quizzes(); track quiz.quizId) {
          <article class="quiz-card">
            <p class="byline">By {{ quiz.creatorName }}</p>
            <h2>
              <a [routerLink]="['/quizzes', quiz.quizId]">{{ quiz.title }}</a>
            </h2>
            <p class="description">{{ quiz.description || 'Explore this assessment.' }}</p>
            <div class="quiz-meta">
              <span>{{ quiz.questionCount }} questions</span><span>{{ quiz.duration }} min</span
              ><span>{{ quiz.totalPoints }} points</span>
            </div>
            <a
              class="view-link"
              [routerLink]="['/quizzes', quiz.quizId]"
              [attr.aria-label]="'View quiz: ' + quiz.title"
              >View quiz <app-icon name="forward"
            /></a>
          </article>
        } @empty {
          <section class="state">
            <h2>{{ query() ? 'No matching quizzes' : 'No public quizzes yet' }}</h2>
            <p>
              {{
                query()
                  ? 'Try another title or keyword.'
                  : 'Check back when creators have shared their assessments.'
              }}
            </p>
          </section>
        }
      </div>
    }
  `,
  styleUrl: './public-quizzes.scss',
})
export class QuizList {
  private readonly api = inject(PublicQuizService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly quizzes = signal<PublicQuiz[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly query = signal('');
  search = '';
  constructor() {
    this.load();
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.query.set(this.search.trim());
    this.request = this.api
      .list(this.query())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quizzes) => {
          this.quizzes.set(quizzes);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiError(error));
          this.loading.set(false);
        },
      });
  }
}
