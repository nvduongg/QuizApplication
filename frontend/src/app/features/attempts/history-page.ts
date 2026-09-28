import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, map, of, switchMap } from 'rxjs';
import { AttemptService, AttemptStatus } from './attempt.service';
import { AttemptHistoryItem } from './result.models';
import { apiError } from '../../core/api';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-history-page',
  imports: [RouterLink, DatePipe, Icon],
  styleUrl: './review.scss',
  template: `<div class="page-heading">
      <h1>History</h1>
      <p>Review completed quizzes or continue an unfinished attempt.</p>
    </div>
    @if (loading()) {
      <p class="loading" role="status">Loading history…</p>
    } @else if (error()) {
      <div class="state" role="alert">
        <p>{{ error() }}</p>
        <button type="button" class="button secondary" (click)="load()">Retry</button>
      </div>
    } @else if (!items().length) {
      <section class="state">
        <h2>{{ page() === 1 ? 'No quiz attempts yet.' : 'No attempts on this page.' }}</h2>
        <p>
          {{
            page() === 1
              ? 'Browse public quizzes to get started.'
              : 'Return to the previous page to see earlier entries.'
          }}
        </p>
        @if (page() === 1) {
          <a class="button secondary" routerLink="/quizzes">Public quizzes</a>
        }
      </section>
    } @else {
      <ul class="history-list">
        @for (item of items(); track item.quizAttemptId) {
          <li>
            <div>
              <h2>{{ item.quizTitle }}</h2>
              <p class="history-meta">
                @if (item.status === statuses.Completed) {
                  Completed · {{ item.score ?? '—' }} / {{ item.totalPoints }} points
                  @if (item.percentage !== null) {
                    · {{ item.percentage }}%
                  }
                } @else {
                  In progress
                }
              </p>
              <p class="history-date">Started {{ item.startedAt | date: 'medium' }}</p>
            </div>
            @if (item.status === statuses.Completed) {
              <a
                class="history-action"
                [routerLink]="['/app/attempts', item.quizAttemptId, 'result']"
                [attr.aria-label]="'View result for ' + item.quizTitle"
                >View result <app-icon name="forward"
              /></a>
            } @else {
              <a
                class="history-action"
                [routerLink]="['/app/attempts', item.quizAttemptId]"
                [attr.aria-label]="'Continue ' + item.quizTitle"
                >Continue <app-icon name="forward"
              /></a>
            }
          </li>
        }
      </ul>
    }
    @if (!loading() && !error() && (page() > 1 || hasNext())) {
      <nav class="pagination" aria-label="History pages">
        <button
          type="button"
          class="button secondary"
          [disabled]="page() === 1"
          (click)="go(page() - 1)"
        >
          Previous</button
        ><span aria-current="page">Page {{ page() }}</span
        ><button
          type="button"
          class="button secondary"
          [disabled]="!hasNext()"
          (click)="go(page() + 1)"
        >
          Next
        </button>
      </nav>
    }`,
})
export class HistoryPage {
  private api = inject(AttemptService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly pageSize = 20;
  statuses = AttemptStatus;
  page = signal(1);
  items = signal<AttemptHistoryItem[]>([]);
  loading = signal(true);
  error = signal('');
  hasNext = signal(false);
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const page = Number(p.get('page') || 1);
      this.page.set(Number.isSafeInteger(page) && page > 0 && page <= 2147483647 ? page : 1);
      this.load();
    });
  }
  go(page: number) {
    if (!this.loading())
      void this.router.navigate([], { relativeTo: this.route, queryParams: { page } });
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.hasNext.set(false);
    this.request = this.api
      .history(this.page(), this.pageSize)
      .pipe(
        switchMap((items) =>
          items.length < this.pageSize || this.page() === 2147483647
            ? of({ items, hasNext: false })
            : this.api
                .history(this.page() + 1, this.pageSize)
                .pipe(map((next) => ({ items, hasNext: next.length > 0 }))),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (data) => {
          this.items.set(data.items);
          this.hasNext.set(data.hasNext);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.error.set(apiError(e));
          this.loading.set(false);
        },
      });
  }
}
