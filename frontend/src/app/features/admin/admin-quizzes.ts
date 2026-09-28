import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { SuccessFeedback } from '../../shared/success-feedback';
import { ConfirmDialog } from '../question-banks/confirm-dialog';
import { Visibility } from '../question-banks/content.models';
import { AdminService, AdminQuiz, adminError } from './admin.service';
@Component({
  selector: 'app-admin-quizzes',
  imports: [SuccessFeedback, ConfirmDialog],
  styleUrl: './admin.scss',
  template: `
    <div class="page-heading">
      <h1>Quiz administration</h1>
      <p>Review system quizzes. Disabling a quiz removes it from public discovery.</p>
    </div>
    @if (message()) {
      <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
    }
    @if (loading()) {
      <p class="loading" role="status">Loading quizzes…</p>
    } @else if (error()) {
      <section class="state" role="alert">
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (!quizzes().length) {
      <section class="state">
        <h2>No quizzes yet</h2>
        <p>Quizzes will appear here when creators add them.</p>
      </section>
    } @else {
      <div class="table-wrap" role="region" aria-label="System quizzes" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">Quiz</th>
              <th scope="col">Visibility</th>
              <th scope="col">Questions</th>
              <th scope="col">Attempts</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (quiz of quizzes(); track quiz.quizId) {
              <tr>
                <td>
                  <strong>{{ quiz.title }}</strong>
                </td>
                <td>{{ quiz.visibility === visibility.Public ? 'Public' : 'Private' }}</td>
                <td>{{ quiz.questionCount }}</td>
                <td>{{ quiz.attemptCount }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      class="text-button"
                      [disabled]="busy() || quiz.visibility === visibility.Private"
                      (click)="ask(quiz, 'disable')"
                    >
                      Disable</button
                    ><button
                      class="text-button danger-button"
                      [disabled]="busy() || quiz.attemptCount > 0"
                      (click)="ask(quiz, 'delete')"
                    >
                      Delete
                    </button>
                  </div>
                  @if (quiz.attemptCount > 0) {
                    <small>Quizzes with attempts cannot be deleted.</small>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    <app-confirm-dialog
      [title]="action() === 'delete' ? 'Delete quiz?' : 'Disable quiz?'"
      [subject]="pending()?.title || ''"
      [description]="
        action() === 'delete'
          ? 'The quiz will be permanently removed. Reusable questions remain in their banks.'
          : 'The quiz will become private. Its creator may publish it again.'
      "
      [actionLabel]="action() === 'delete' ? 'Delete' : 'Disable'"
      pendingLabel="Updating…"
      [irreversible]="action() === 'delete'"
      [busy]="busy()"
      [error]="actionError()"
      (confirmed)="confirmAction()"
    />
  `,
})
export class AdminQuizzes {
  private api = inject(AdminService);
  private destroy = inject(DestroyRef);
  private dialog = viewChild.required(ConfirmDialog);
  private request?: Subscription;
  quizzes = signal<AdminQuiz[]>([]);
  loading = signal(true);
  error = signal('');
  message = signal('');
  busy = signal(false);
  actionError = signal('');
  pending = signal<AdminQuiz | null>(null);
  action = signal<'delete' | 'disable'>('disable');
  visibility = Visibility;
  constructor() {
    this.load();
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .quizzes()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (q) => {
          this.quizzes.set(q);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(adminError(e));
          this.loading.set(false);
        },
      });
  }
  ask(q: AdminQuiz, action: 'delete' | 'disable') {
    if (this.busy()) return;
    this.pending.set(q);
    this.action.set(action);
    this.actionError.set('');
    this.dialog().open();
  }
  confirmAction() {
    const q = this.pending(),
      action = this.action();
    if (!q || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    (action === 'delete' ? this.api.delete(q.quizId) : this.api.disable(q.quizId))
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.quizzes.update((rows) =>
            action === 'delete'
              ? rows.filter((r) => r.quizId !== q.quizId)
              : rows.map((r) =>
                  r.quizId === q.quizId ? { ...r, visibility: Visibility.Private } : r,
                ),
          );
          this.busy.set(false);
          this.dialog().close();
          this.message.set(action === 'delete' ? 'Quiz deleted.' : 'Quiz is now private.');
        },
        error: (e) => {
          this.busy.set(false);
          this.actionError.set(adminError(e));
        },
      });
  }
}
