import { UnsavedChangesForm } from '../../shared/unsaved-changes';
import { Component, DestroyRef, inject, output, signal, effect, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { nonBlank } from '../question-banks/content.rules';
import { QuizService } from './quiz.services';
import { OwnedQuiz } from './quiz.models';
import { integer, quizError } from './quiz.rules';
@Component({
  selector: 'app-quiz-form',
  imports: [UnsavedChangesForm, ReactiveFormsModule],
  styleUrl: './quiz.scss',
  template: `
    <form [formGroup]="form" [unsavedChanges]="form" (ngSubmit)="save()">
      <fieldset [disabled]="busy()">
        <div class="field">
          <label for="quiz-title">Title</label
          ><input
            autofocus
            id="quiz-title"
            formControlName="title"
            maxlength="255"
            aria-describedby="quiz-title-error"
            [attr.aria-invalid]="form.controls.title.touched && form.controls.title.invalid"
          /><small id="quiz-title-error" class="field-error">
            @if (form.controls.title.touched && form.controls.title.invalid) {
              Enter a title, up to 255 characters.
            }
          </small>
        </div>
        <div class="field">
          <label for="quiz-description">Description (optional)</label
          ><textarea id="quiz-description" formControlName="description" maxlength="1000"></textarea
          ><small>Up to 1,000 characters.</small>
        </div>
        <div class="field">
          <label for="quiz-duration">Time limit (minutes)</label
          ><input
            id="quiz-duration"
            type="number"
            min="1"
            max="1440"
            step="1"
            formControlName="duration"
            aria-describedby="duration-error"
            [attr.aria-invalid]="form.controls.duration.touched && form.controls.duration.invalid"
          /><small id="duration-error" class="field-error">
            @if (form.controls.duration.touched && form.controls.duration.invalid) {
              Enter a whole number from 1 to 1,440.
            }
          </small>
        </div>
      </fieldset>
      @if (!editing) {
        <p>Your quiz starts as a private draft. Add questions before publishing.</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="form-actions">
        <button class="button" type="submit" [disabled]="busy()">
          {{ busy() ? 'Saving…' : editing ? 'Save details' : 'Create quiz' }}</button
        ><button class="button secondary" type="button" [disabled]="busy()" (click)="close()">
          Cancel
        </button>
      </div>
    </form>
  `,
})
export class QuizForm {
  private api = inject(QuizService);
  private destroy = inject(DestroyRef);
  initial = input<OwnedQuiz | null>(null);
  cancelled = output<void>();
  saved = output<OwnedQuiz>();
  editing: OwnedQuiz | null = null;
  busy = signal(false);
  error = signal('');
  form = inject(FormBuilder).nonNullable.group({
    title: ['', [nonBlank, Validators.maxLength(255)]],
    description: ['', Validators.maxLength(1000)],
    duration: [20, [Validators.required, Validators.min(1), Validators.max(1440), integer]],
  });
  constructor() {
    effect(() => this.initialize(this.initial()));
  }
  initialize(quiz: OwnedQuiz | null = null) {
    this.editing = quiz;
    this.error.set('');
    this.form.reset({
      title: quiz?.title ?? '',
      description: quiz?.description ?? '',
      duration: quiz?.duration ?? 20,
    });
  }
  close() {
    if (!this.busy()) this.cancelled.emit();
  }
  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const body = {
      ...value,
      title: value.title.trim(),
      description: value.description.trim() || null,
    };
    this.busy.set(true);
    this.error.set('');
    (this.editing ? this.api.update(this.editing.quizId, body) : this.api.create(body))
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (quiz) => {
          this.busy.set(false);
          this.form.markAsPristine();
          this.saved.emit(quiz);
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(quizError(e));
        },
      });
  }
}
