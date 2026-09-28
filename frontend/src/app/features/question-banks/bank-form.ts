import { UnsavedChangesForm } from '../../shared/unsaved-changes';
import { Component, DestroyRef, inject, input, output, signal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuestionBank, Visibility } from './content.models';
import { QuestionBankService } from './content.services';
import { contentError, nonBlank } from './content.rules';
@Component({
  selector: 'app-bank-form',
  imports: [UnsavedChangesForm, ReactiveFormsModule],
  styleUrls: ['./content.scss'],
  template: `
    <form [formGroup]="form" [unsavedChanges]="form" (ngSubmit)="save()">
      <div class="field">
        <label for="bank-name">Name</label
        ><input
          autofocus
          id="bank-name"
          formControlName="name"
          maxlength="150"
          [attr.aria-invalid]="form.controls.name.touched && form.controls.name.invalid"
          aria-describedby="bank-name-error"
        /><small id="bank-name-error" class="field-error">
          @if (form.controls.name.touched && form.controls.name.invalid) {
            Enter a name, up to 150 characters.
          }
        </small>
      </div>
      @if (!minimal()) {
        <div class="field">
          <label for="bank-description">Description (optional)</label
          ><textarea id="bank-description" formControlName="description" maxlength="500"></textarea
          ><small>Up to 500 characters.</small>
        </div>
      }
      <div class="field">
        <label for="bank-visibility">Visibility</label
        ><select id="bank-visibility" formControlName="visibility">
          <option [ngValue]="1">Private</option>
          <option [ngValue]="2">Public</option></select
        ><small>Public banks can be read by other signed-in accounts.</small>
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="form-actions">
        <button type="submit" class="button" [disabled]="busy()">
          {{ busy() ? 'Saving…' : editing ? 'Save changes' : 'Create question bank' }}</button
        ><button type="button" class="button secondary" [disabled]="busy()" (click)="close()">
          Cancel
        </button>
      </div>
    </form>
  `,
})
export class BankForm {
  minimal = input(false);
  private api = inject(QuestionBankService);
  private destroy = inject(DestroyRef);
  initial = input<QuestionBank | null>(null);
  cancelled = output<void>();
  saved = output<QuestionBank>();
  editing: QuestionBank | null = null;
  busy = signal(false);
  error = signal('');
  form = inject(FormBuilder).nonNullable.group({
    name: ['', [nonBlank, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(500)],
    visibility: [Visibility.Private, Validators.required],
  });
  constructor() {
    effect(() => this.initialize(this.initial()));
  }
  initialize(bank: QuestionBank | null = null) {
    this.editing = bank;
    this.error.set('');
    this.form.reset({
      name: bank?.name ?? '',
      description: bank?.description ?? '',
      visibility: bank?.visibility ?? Visibility.Private,
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
      name: value.name.trim(),
      description: value.description.trim() || null,
    };
    this.busy.set(true);
    this.error.set('');
    (this.editing ? this.api.update(this.editing.questionBankId, body) : this.api.create(body))
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (bank) => {
          this.busy.set(false);
          this.form.markAsPristine();
          this.saved.emit(bank);
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(contentError(e, 'question bank'));
        },
      });
  }
}
