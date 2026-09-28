import { UnsavedChangesForm } from '../../shared/unsaved-changes';
import { SuccessFeedback } from '../../shared/success-feedback';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subscription } from 'rxjs';
import { AnswerService } from './content.services';
import { Answer, QuestionDetail, QuestionType } from './content.models';
import { answerProblem, contentError, nonBlank } from './content.rules';
import { ConfirmDialog } from './confirm-dialog';
export interface AnswerState {
  count: number;
  busy: boolean;
  ready: boolean;
}
@Component({
  selector: 'app-answer-manager',
  imports: [UnsavedChangesForm, SuccessFeedback, ReactiveFormsModule, ConfirmDialog],
  styleUrl: './content.scss',
  template: ` <section class="answers" aria-labelledby="answers-title">
      <div class="toolbar">
        <h2 id="answers-title">Answers</h2>
        <button
          class="button secondary"
          [disabled]="
            disabled() ||
            loading() ||
            !!error() ||
            busy() ||
            showing() ||
            (question().questionType === type.TrueFalse && answers().length >= 2)
          "
          (click)="question().questionType === type.TrueFalse ? setupTrueFalse() : edit()"
        >
          {{ question().questionType === type.TrueFalse ? 'Set up answers' : 'Add answer' }}
        </button>
      </div>
      <p class="answer-hint">
        {{
          question().questionType === type.MultipleChoice
            ? 'Select all correct answers.'
            : 'Select the correct answer.'
        }}
      </p>
      @if (selectionError()) {
        <p class="error" role="alert">{{ selectionError() }}</p>
      }
      @if (disabled()) {
        <p class="notice">Save your question changes before managing answers.</p>
      }
      @if (message()) {
        <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
      }
      @if (loading()) {
        <p class="loading" role="status">Loading answers…</p>
      } @else if (error()) {
        <div class="state" role="alert">
          <p>{{ error() }}</p>
          <button class="button secondary" (click)="load()">Retry</button>
        </div>
      } @else {
        @if (!answers().length) {
          <div class="state">
            <h3>No answers yet</h3>
            <p>Add an answer when you are ready. You can save work in progress.</p>
          </div>
        } @else {
          <ul class="content-list">
            @for (answer of answers(); track answer.answerId) {
              <li class="content-row">
                <label class="answer-choice">
                  <span class="answer-control">
                    @if (question().questionType === type.MultipleChoice) {
                      <input
                        type="checkbox"
                        [checked]="answer.isCorrect"
                        [disabled]="disabled() || busy() || showing() || loading()"
                        [attr.aria-label]="'Mark correct: ' + answer.content"
                        (change)="toggleCorrect(answer, $event)"
                      />
                    } @else {
                      <input
                        type="radio"
                        name="correct-answer"
                        [formControl]="correctChoice"
                        [value]="answer.answerId"
                        [attr.disabled]="
                          disabled() || busy() || showing() || loading() ? true : null
                        "
                        [attr.aria-label]="'Correct answer: ' + answer.content"
                        (change)="chooseCorrect(answer)"
                      />
                    }
                  </span>
                  <span class="answer-content">{{ answer.content }}</span></label
                >
                <div class="row-actions">
                  <button
                    class="text-button action-link"
                    [disabled]="disabled() || busy() || showing()"
                    [attr.aria-label]="'Edit answer: ' + answer.content"
                    (click)="edit(answer)"
                  >
                    Edit</button
                  ><button
                    class="text-button action-link danger-button"
                    [disabled]="disabled() || busy() || showing()"
                    [attr.aria-label]="'Delete answer: ' + answer.content"
                    (click)="confirmDelete(answer)"
                  >
                    Delete
                  </button>
                </div>
              </li>
            }
          </ul>
          @if (question().questionType !== type.MultipleChoice && correctChoice.value !== null) {
            <button
              type="button"
              class="text-button action-link"
              [disabled]="disabled() || busy() || showing()"
              (click)="chooseCorrect(null)"
            >
              Clear selection
            </button>
          }
        }
      }
      @if (showing()) {
        <form class="focused-form" [formGroup]="form" [unsavedChanges]="form" (ngSubmit)="save()">
          <h3>{{ editing() ? 'Edit answer' : 'Add answer' }}</h3>
          <fieldset [disabled]="busy() || disabled()">
            <div class="field">
              <label for="answer-content">Answer content</label>
              @if (question().questionType === type.TrueFalse) {
                <select id="answer-content" formControlName="content">
                  <option value="">Choose an answer</option>
                  <option value="True" [disabled]="taken('True')">True</option>
                  <option value="False" [disabled]="taken('False')">False</option>
                </select>
              } @else {
                <textarea
                  id="answer-content"
                  formControlName="content"
                  maxlength="500"
                  [attr.aria-invalid]="
                    form.controls.content.touched && form.controls.content.invalid
                  "
                  aria-describedby="answer-content-error"
                ></textarea>
              }
              <small id="answer-content-error" class="field-error">
                @if (form.controls.content.touched && form.controls.content.invalid) {
                  Enter an answer, up to 500 characters.
                }
              </small>
            </div>
            @if (question().questionType === type.MultipleChoice) {
              <label class="choice"
                ><input type="checkbox" formControlName="isCorrect" />Correct answer</label
              >
            } @else {
              <fieldset>
                <legend>Correctness</legend>
                <label class="choice"
                  ><input
                    type="radio"
                    formControlName="isCorrect"
                    [value]="true"
                    [attr.disabled]="otherCorrect() ? true : null"
                  />Correct answer</label
                ><label class="choice"
                  ><input type="radio" formControlName="isCorrect" [value]="false" />Not marked
                  correct</label
                >
                @if (otherCorrect()) {
                  <small
                    >Another answer is marked correct. Edit that answer first to unmark it.</small
                  >
                }
              </fieldset>
            }
          </fieldset>
          @if (saveError()) {
            <p class="error" role="alert">{{ saveError() }}</p>
          }
          <div class="form-actions">
            <button type="submit" class="button" [disabled]="busy() || disabled()">
              {{ busy() ? 'Saving…' : editing() ? 'Save answer' : 'Add answer' }}</button
            ><button
              type="button"
              class="button secondary"
              [disabled]="busy()"
              (click)="cancelEdit()"
            >
              Cancel
            </button>
          </div>
        </form>
      }
    </section>
    <app-confirm-dialog
      title="Delete answer?"
      [subject]="pendingDelete()?.content || ''"
      description="The answer will be removed from this question."
      [busy]="busy()"
      [error]="deleteError()"
      (confirmed)="deleteAnswer()"
    />`,
})
export class AnswerManager {
  question = input.required<QuestionDetail>();
  disabled = input(false);
  stateChanged = output<AnswerState>();
  private api = inject(AnswerService);
  private destroy = inject(DestroyRef);
  private request?: Subscription;
  private confirm = viewChild.required(ConfirmDialog);
  readonly type = QuestionType;
  answers = signal<Answer[]>([]);
  loading = signal(true);
  error = signal('');
  busy = signal(false);
  showing = signal(false);
  editing = signal<Answer | null>(null);
  message = signal('');
  selectionError = signal('');
  correctChoice = new FormControl<number | null>(null);
  saveError = signal('');
  deleteError = signal('');
  pendingDelete = signal<Answer | null>(null);
  form = inject(FormBuilder).nonNullable.group({
    content: ['', [nonBlank, Validators.maxLength(500)]],
    isCorrect: [false],
  });
  constructor() {
    effect(() => {
      const id = this.question().questionId;
      untracked(() => {
        this.showing.set(false);
        this.load(id);
      });
    });
  }
  private emit() {
    this.stateChanged.emit({
      count: this.answers().length,
      busy: this.busy() || this.showing(),
      ready: !this.loading() && !this.error(),
    });
  }
  load(id = this.question().questionId) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.emit();
    this.request = this.api
      .byQuestion(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (answers) => {
          this.answers.set(answers);
          this.correctChoice.setValue(answers.find((a) => a.isCorrect)?.answerId ?? null, {
            emitEvent: false,
          });
          this.loading.set(false);
          this.emit();
        },
        error: (e) => {
          this.error.set(contentError(e, 'answers'));
          this.loading.set(false);
          this.emit();
        },
      });
  }
  edit(answer: Answer | null = null) {
    if (this.disabled() || this.busy()) return;
    this.editing.set(answer);
    const content = answer?.content ?? '';
    this.form.reset({
      content:
        this.question().questionType === QuestionType.TrueFalse && content
          ? content.toLowerCase() === 'true'
            ? 'True'
            : 'False'
          : content,
      isCorrect: answer?.isCorrect ?? false,
    });
    this.saveError.set('');
    this.message.set('');
    this.showing.set(true);
    this.emit();
  }
  cancelEdit() {
    this.showing.set(false);
    this.emit();
  }
  taken(content: string) {
    return this.answers().some(
      (a) =>
        a.answerId !== this.editing()?.answerId &&
        a.content.toLowerCase() === content.toLowerCase(),
    );
  }
  otherCorrect() {
    return this.answers().some((a) => a.answerId !== this.editing()?.answerId && a.isCorrect);
  }
  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || this.disabled()) return;
    const value = this.form.getRawValue();
    const body = { ...value, content: value.content.trim() };
    const problem = answerProblem(
      this.question().questionType,
      this.answers(),
      body,
      this.editing()?.answerId,
    );
    if (problem) {
      this.saveError.set(problem);
      return;
    }
    this.busy.set(true);
    this.saveError.set('');
    this.emit();
    const editing = this.editing();
    (editing
      ? this.api.update(editing.answerId, body)
      : this.api.create(this.question().questionId, body)
    )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (answer) => {
          this.answers.update((answers) =>
            editing
              ? answers.map((a) => (a.answerId === answer.answerId ? answer : a))
              : [...answers, answer],
          );
          this.correctChoice.setValue(this.answers().find((a) => a.isCorrect)?.answerId ?? null, {
            emitEvent: false,
          });
          this.busy.set(false);
          this.showing.set(false);
          this.message.set(editing ? 'Answer updated.' : 'Answer added.');
          this.emit();
        },
        error: (e) => {
          this.busy.set(false);
          this.saveError.set(contentError(e, 'answer'));
          this.emit();
        },
      });
  }

  async setupTrueFalse() {
    if (this.disabled() || this.busy() || this.loading() || this.error() || this.showing()) return;
    this.busy.set(true);
    this.selectionError.set('');
    this.emit();
    try {
      for (const content of ['True', 'False']) {
        if (!this.answers().some((a) => a.content.toLowerCase() === content.toLowerCase())) {
          const answer = await firstValueFrom(
            this.api
              .create(this.question().questionId, { content, isCorrect: false })
              .pipe(takeUntilDestroyed(this.destroy)),
          );
          if (this.destroy.destroyed) return;
          this.answers.update((answers) => [...answers, answer]);
        }
      }
      this.message.set('Answers ready. Select the correct answer.');
    } catch (e) {
      if (!this.destroy.destroyed) this.selectionError.set(contentError(e, 'answer'));
    } finally {
      if (!this.destroy.destroyed) {
        this.busy.set(false);
        this.load();
      }
    }
  }
  toggleCorrect(answer: Answer, event: Event) {
    const input = event.target as HTMLInputElement;
    const selected = input.checked;
    input.checked = answer.isCorrect;
    void this.chooseCorrect(answer, selected);
  }
  async chooseCorrect(answer: Answer | null, selected = true) {
    const multiple = this.question().questionType === QuestionType.MultipleChoice;
    const previous = this.answers().find((a) => a.isCorrect) ?? null;
    this.correctChoice.setValue(previous?.answerId ?? null, { emitEvent: false });
    if (this.disabled() || this.busy() || this.showing() || this.loading() || this.error()) return;
    if (!multiple && previous?.answerId === answer?.answerId) return;
    this.busy.set(true);
    this.selectionError.set('');
    this.message.set('');
    this.emit();
    let cleared = false;
    const update = (item: Answer, isCorrect: boolean) =>
      firstValueFrom(
        this.api
          .update(item.answerId, { content: item.content, isCorrect })
          .pipe(takeUntilDestroyed(this.destroy)),
      );
    try {
      if (!multiple && previous) {
        await update(previous, false);
        cleared = true;
      }
      if (answer) await update(answer, selected);
      this.message.set('Answer updated.');
    } catch (error) {
      if (this.destroy.destroyed) return;
      this.selectionError.set(contentError(error, 'answer'));
      if (cleared && previous) {
        try {
          await update(previous, true);
        } catch {
          if (this.destroy.destroyed) return;
          this.selectionError.set(
            'The new selection could not be saved and the previous selection could not be restored. Check the refreshed answers before trying again.',
          );
        }
      }
    } finally {
      if (!this.destroy.destroyed) {
        this.busy.set(false);
        this.load();
      }
    }
  }
  confirmDelete(answer: Answer) {
    this.pendingDelete.set(answer);
    this.deleteError.set('');
    this.confirm().open();
  }
  deleteAnswer() {
    const answer = this.pendingDelete();
    if (!answer || this.busy() || this.disabled()) return;
    this.busy.set(true);
    this.deleteError.set('');
    this.emit();
    this.api
      .delete(answer.answerId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.answers.update((answers) => answers.filter((a) => a.answerId !== answer.answerId));
          this.correctChoice.setValue(this.answers().find((a) => a.isCorrect)?.answerId ?? null, {
            emitEvent: false,
          });
          this.busy.set(false);
          this.confirm().close();
          this.message.set('Answer deleted.');
          this.emit();
        },
        error: (e) => {
          this.busy.set(false);
          this.deleteError.set(contentError(e, 'answer', true));
          this.emit();
        },
      });
  }
}
