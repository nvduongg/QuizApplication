import { UnsavedChangesForm } from '../../shared/unsaved-changes';
import { SuccessFeedback } from '../../shared/success-feedback';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth';
import { Visibility, questionTypeLabels } from '../question-banks/content.models';
import { ContentFeedback } from '../question-banks/content.services';
import { validId } from '../question-banks/content.rules';
import { ConfirmDialog } from '../question-banks/confirm-dialog';
import { OwnedQuiz, QuizQuestion } from './quiz.models';
import { QuizService, QuizQuestionService } from './quiz.services';
import { quizError, validPoints } from './quiz.rules';
type Action = 'publish' | 'unpublish' | 'delete' | 'remove';
@Component({
  selector: 'app-quiz-builder',
  host: { class: 'has-page-back' },
  imports: [
    UnsavedChangesForm,
    SuccessFeedback,
    Icon,
    CountLabel,
    RouterLink,
    ReactiveFormsModule,
    ConfirmDialog,
  ],
  styleUrl: './quiz.scss',
  template: ` <a class="page-back" routerLink="/app/quizzes"><app-icon name="back" /> My Quizzes</a>
    <div class="builder-header">
      <div class="page-heading">
        <h1>{{ quiz()?.title || 'Quiz Builder' }}</h1>
        @if (quiz(); as quiz) {
          <div class="quiz-summary">
            <span class="badge">{{ published() ? 'Published' : 'Draft' }}</span
            ><span>{{ quiz.duration }} minutes</span>
          </div>
          <p>{{ quiz.description || 'Build an assessment from reusable questions.' }}</p>
        }
      </div>
      @if (owned() && !loading() && !loadError()) {
        @if (quiz(); as quiz) {
          <div class="builder-actions">
            <button class="button secondary" [disabled]="!!busy()" (click)="editDetails()">
              Edit details
            </button>
            <div class="row-actions">
              @if (published()) {
                <button class="button secondary" [disabled]="!!busy()" (click)="ask('unpublish')">
                  Unpublish
                </button>
              } @else {
                <button
                  class="button"
                  [disabled]="!!busy() || rowsLoading() || !!rowsError()"
                  (click)="ask('publish')"
                >
                  Publish
                </button>
              }
              <button
                class="button secondary danger-button"
                [disabled]="!!busy()"
                (click)="ask('delete')"
              >
                Delete quiz
              </button>
            </div>
          </div>
        }
      }
    </div>
    @if (loading()) {
      <p class="loading" role="status">Loading quiz…</p>
    } @else if (loadError()) {
      <section class="state" role="alert">
        <h2>Unable to open quiz</h2>
        <p>{{ loadError() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (!owned()) {
      <p class="notice">You can manage only your own quizzes.</p>
    } @else if (quiz(); as quiz) {
      @if (published()) {
        <p class="notice">Unpublish this quiz before changing its questions, order, or points.</p>
      }
      @if (message()) {
        <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
      }
      @if (busy()) {
        <p class="feedback" role="status">{{ busy() }}</p>
      }
      @if (error()) {
        <div class="error" role="alert">
          <p>{{ error() }}</p>
          <button class="button secondary" [disabled]="!!busy()" (click)="load()">
            Refresh quiz
          </button>
        </div>
      }
      <section aria-labelledby="builder-questions">
        <div class="toolbar">
          <h2 id="builder-questions">Questions</h2>
          <span>{{
            rowsLoading() || rowsError()
              ? ''
              : (rows().length | countLabel: 'question') + ' · Total points: ' + total()
          }}</span>
        </div>
        @if (!published()) {
          <div class="question-authoring-actions">
            <button
              class="button"
              [disabled]="!!busy() || rowsLoading() || !!rowsError()"
              (click)="createQuestion()"
            >
              + Create question
            </button>
            <button
              class="button secondary"
              [disabled]="!!busy() || rowsLoading() || !!rowsError()"
              (click)="addFromBank()"
            >
              Add from question bank
            </button>
          </div>
        }
        @if (rowsLoading()) {
          <p class="loading" role="status">Loading quiz questions…</p>
        } @else if (rowsError()) {
          <div class="state" role="alert">
            <p>{{ rowsError() }}</p>
            <button class="button secondary" (click)="loadRows()">Retry</button>
          </div>
        } @else if (!rows().length) {
          <div class="state">
            <h3>Start with your first question</h3>
            <p>Create a question or reuse one from your own banks or public banks.</p>
          </div>
        } @else {
          <ol class="content-list">
            @for (question of rows(); track question.questionId; let index = $index) {
              <li
                class="content-row builder-row"
                [class.just-added]="question.questionId === addedId()"
              >
                <span class="sequence" aria-hidden="true">{{ index + 1 }}</span>
                <div class="row-copy">
                  <h3>
                    <span class="sr-only">Question {{ index + 1 }}. </span>{{ question.content }}
                  </h3>
                  <div class="metadata">
                    <span>{{ labels[question.questionType] }}</span
                    ><span>{{
                      question.isOwnedQuestion ? 'Your question' : 'Reused public question'
                    }}</span
                    ><span>{{ question.answerCount | countLabel: 'answer' }}</span>
                  </div>
                </div>
                <div class="row-actions">
                  @if (editingPoints() === question.questionId && !published()) {
                    <form
                      [unsavedChanges]="points"
                      class="points-form"
                      (submit)="savePoints($event, question)"
                    >
                      <label [for]="'points-' + question.questionId">Points</label
                      ><input
                        [id]="'points-' + question.questionId"
                        type="number"
                        min="0.01"
                        max="100000"
                        step="0.01"
                        [formControl]="points"
                        [readonly]="!!busy()"
                      /><button class="button secondary" type="submit" [disabled]="!!busy()">
                        Save</button
                      ><button
                        class="text-button"
                        type="button"
                        [disabled]="!!busy()"
                        (click)="editingPoints.set(null)"
                      >
                        Cancel
                      </button>
                    </form>
                  } @else {
                    <span>{{ question.points | countLabel: 'point' }}</span>
                    @if (!published()) {
                      <button
                        class="text-button"
                        [disabled]="!!busy()"
                        [attr.aria-label]="'Edit points for question ' + (index + 1)"
                        (click)="editPoints(question)"
                      >
                        Edit points
                      </button>
                    }
                  }
                  @if (!published()) {
                    <button
                      class="button secondary order-control"
                      [disabled]="!!busy() || index === 0"
                      [attr.aria-label]="'Move question ' + (index + 1) + ' up'"
                      (click)="move(index, -1)"
                    >
                      <app-icon name="up" /></button
                    ><button
                      class="button secondary order-control"
                      [disabled]="!!busy() || index === rows().length - 1"
                      [attr.aria-label]="'Move question ' + (index + 1) + ' down'"
                      (click)="move(index, 1)"
                    >
                      <app-icon name="down" /></button
                    ><button
                      class="text-button"
                      [disabled]="!!busy()"
                      [attr.aria-label]="'Remove question ' + (index + 1) + ' from quiz'"
                      (click)="ask('remove', question)"
                    >
                      Remove
                    </button>
                  }
                </div>
              </li>
            }
          </ol>
        }
      </section>
    }
    <app-confirm-dialog
      [title]="actionTitle()"
      [subject]="action() === 'remove' ? removing()?.content || '' : quiz()?.title || ''"
      [description]="actionDescription()"
      [actionLabel]="actionLabel()"
      pendingLabel="Working…"
      [irreversible]="action() === 'delete'"
      [danger]="action() === 'delete'"
      [busy]="!!busy()"
      [error]="actionError()"
      (confirmed)="confirmAction()"
    />`,
})
export class QuizBuilder {
  private api = inject(QuizService);
  private links = inject(QuizQuestionService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private feedback = inject(ContentFeedback);
  private request?: Subscription;
  private rowRequest?: Subscription;
  private mutation?: Subscription;
  private id = 0;
  private confirm = viewChild.required(ConfirmDialog);
  quiz = signal<OwnedQuiz | null>(null);
  rows = signal<QuizQuestion[]>([]);
  addedId = signal<number | null>(null);
  loading = signal(true);
  loadError = signal('');
  rowsLoading = signal(false);
  rowsError = signal('');
  busy = signal('');
  error = signal('');
  message = signal(this.feedback.take());
  labels = questionTypeLabels;
  owned = computed(() => !!this.quiz() && this.quiz()?.creatorId === this.auth.session()?.userId);
  published = computed(() => this.quiz()?.visibility === Visibility.Public);
  total = computed(() =>
    Number(
      this.rows()
        .reduce((sum, q) => sum + q.points, 0)
        .toFixed(2),
    ),
  );
  editingPoints = signal<number | null>(null);
  points = new FormControl(1, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(0.01), Validators.max(100000)],
  });
  action = signal<Action>('publish');
  removing = signal<QuizQuestion | null>(null);
  actionError = signal('');
  actionLabel = computed(
    () =>
      ({ publish: 'Publish', unpublish: 'Unpublish', delete: 'Delete', remove: 'Remove' })[
        this.action()
      ],
  );
  actionTitle = computed(
    () => this.actionLabel() + (this.action() === 'remove' ? ' question from quiz?' : ' quiz?'),
  );
  actionDescription = computed(
    () =>
      ({
        publish: 'This quiz will become publicly discoverable and available to other users.',
        unpublish: 'This removes the quiz from public discovery and allows question changes again.',
        delete:
          'This quiz will be permanently deleted. Its reusable questions will remain in their banks.',
        remove:
          'The question will remain in its Question Bank. Only its link to this quiz is removed.',
      })[this.action()],
  );
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.mutation?.unsubscribe();
      this.busy.set('');
      this.id = validId(params.get('id'));
      this.addedId.set(validId(this.route.snapshot?.queryParamMap.get('added') ?? null) || null);
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.rowRequest?.unsubscribe();
    this.quiz.set(null);
    this.rows.set([]);
    this.loading.set(true);
    this.loadError.set('');
    this.error.set('');
    this.editingPoints.set(null);
    if (!this.id) {
      this.loadError.set('This quiz is unavailable.');
      this.loading.set(false);
      return;
    }
    this.request = this.api
      .detail(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (q) => {
          this.quiz.set(q);
          this.loading.set(false);
          if (this.owned()) this.loadRows();
        },
        error: (e) => {
          this.loading.set(false);
          this.loadError.set(quizError(e));
        },
      });
  }
  loadRows() {
    if (!this.owned()) return;
    this.rowRequest?.unsubscribe();
    this.rowsLoading.set(true);
    this.rowsError.set('');
    this.rowRequest = this.links
      .list(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (rows) => {
          this.reconcile(rows);
          this.rowsLoading.set(false);
        },
        error: (e) => {
          this.rowsLoading.set(false);
          this.rowsError.set(quizError(e));
        },
      });
  }
  reconcile(rows: QuizQuestion[]) {
    this.rowsError.set('');
    this.rows.set([...rows].sort((a, b) => a.questionOrder - b.questionOrder));
    this.quiz.update((q) =>
      q ? { ...q, questionCount: rows.length, totalPoints: this.total() } : q,
    );
  }
  addFromBank() {
    if (this.editable()) void this.router.navigate(['/app/quizzes', this.id, 'questions', 'add']);
  }
  createQuestion() {
    if (this.editable())
      void this.router.navigate(['/app/quizzes', this.id, 'questions', 'create']);
  }
  editDetails() {
    void this.router.navigate(['/app/quizzes', this.id, 'edit']);
  }

  private editable() {
    return (
      this.owned() && !this.published() && !this.busy() && !this.rowsLoading() && !this.rowsError()
    );
  }
  editPoints(q: QuizQuestion) {
    if (!this.editable()) return;
    this.points.reset(q.points);
    this.editingPoints.set(q.questionId);
    this.error.set('');
  }
  savePoints(event: Event, q: QuizQuestion) {
    event.preventDefault();
    if (!this.editable()) return;
    if (this.points.invalid || !validPoints(this.points.value)) {
      this.error.set('Enter points from 0.01 to 100,000, with up to two decimal places.');
      return;
    }
    this.run(
      this.links.points(this.id, q.questionId, this.points.value),
      'Saving points…',
      (updated) => {
        this.reconcile(
          this.rows().map((row) => (row.questionId === updated.questionId ? updated : row)),
        );
        this.editingPoints.set(null);
        this.message.set('Points updated.');
      },
    );
  }
  move(index: number, offset: number) {
    if (!this.editable()) return;
    const next = [...this.rows()];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    this.run(
      this.links.reorder(
        this.id,
        next.map((q) => q.questionId),
      ),
      'Updating order…',
      () => {
        this.reconcile(next.map((q, i) => ({ ...q, questionOrder: i + 1 })));
        this.message.set('Order updated.');
      },
    );
  }
  ask(action: Action, q: QuizQuestion | null = null) {
    if (!this.owned() || this.busy() || (action === 'remove' && !this.editable())) return;
    this.action.set(action);
    this.removing.set(q);
    this.actionError.set('');
    this.confirm().open();
  }
  confirmAction() {
    if (!this.owned() || this.busy()) return;
    const action = this.action();
    if (action === 'remove') {
      const q = this.removing();
      if (!q || !this.editable()) return;
      this.run(
        this.links.remove(this.id, q.questionId),
        'Removing question…',
        () => {
          this.reconcile(
            this.rows()
              .filter((row) => row.questionId !== q.questionId)
              .map((row, i) => ({ ...row, questionOrder: i + 1 })),
          );
          this.confirm().close();
          this.message.set('Question removed.');
        },
        true,
      );
    } else if (action === 'delete') {
      this.run(
        this.api.delete(this.id),
        'Deleting quiz…',
        () => {
          this.confirm().close();
          this.feedback.set('Quiz deleted.');
          void this.router.navigate(['/app/quizzes']);
        },
        true,
      );
    } else {
      this.run(
        action === 'publish' ? this.api.publish(this.id) : this.api.unpublish(this.id),
        action === 'publish' ? 'Publishing quiz…' : 'Unpublishing quiz…',
        (q) => {
          this.quiz.set(q);
          this.editingPoints.set(null);
          this.confirm().close();
          this.message.set(action === 'publish' ? 'Quiz published.' : 'Quiz unpublished.');
        },
        true,
      );
    }
  }
  private run<T>(request: Observable<T>, label: string, next: (value: T) => void, modal = false) {
    this.busy.set(label);
    this.error.set('');
    this.actionError.set('');
    this.message.set('');
    this.mutation = request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (value) => {
        this.busy.set('');
        next(value);
      },
      error: (e) => {
        this.busy.set('');
        const message = quizError(e, this.rows());
        this.error.set(message);
        if (modal) this.actionError.set(message);
      },
    });
  }
}
