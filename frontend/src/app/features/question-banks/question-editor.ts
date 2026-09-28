import { QuestionCreator } from './question-creator';
import { UnsavedChangesForm } from '../../shared/unsaved-changes';
import { SuccessFeedback } from '../../shared/success-feedback';
import { Icon } from '../../shared/icon';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, map, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { QuestionBankService, QuestionService, ContentFeedback } from './content.services';
import {
  QuestionBank,
  QuestionDetail,
  QuestionType,
  questionTypes,
  questionTypeLabels,
} from './content.models';
import { contentError, nonBlank, validId } from './content.rules';
import { AnswerManager, AnswerState } from './answer-manager';
import { ConfirmDialog } from './confirm-dialog';
@Component({
  selector: 'app-question-editor',
  host: { class: 'has-page-back' },
  imports: [
    QuestionCreator,
    UnsavedChangesForm,
    SuccessFeedback,
    RouterLink,
    ReactiveFormsModule,
    AnswerManager,
    ConfirmDialog,
    Icon,
  ],
  styleUrl: './content.scss',
  template: `@if (creation) {
      <app-question-creator
        [quizId]="creation === 'quiz' ? creationId : null"
        [bankId]="creation === 'bank' ? creationId : null"
        (saved)="createdQuestion($event)"
        (attached)="createdForQuiz($event.questionId)"
      />
    } @else {
      <a
        class="page-back"
        [routerLink]="
          bank() ? ['/app/question-banks', bank()!.questionBankId] : ['/app/question-banks']
        "
        ><app-icon name="back" /> {{ bank()?.name || 'Question Banks' }}</a
      >
      <div class="page-heading">
        <h1>Question editor</h1>
        <p>Edit the question and configure its answers.</p>
      </div>
      @if (message()) {
        <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
      }
      @if (loading()) {
        <p class="loading" role="status">Loading question…</p>
      } @else if (error()) {
        <section class="state" role="alert">
          <h2>Unable to open question</h2>
          <p>{{ error() }}</p>
          <button class="button secondary" (click)="load()">Retry</button>
        </section>
      } @else if (!owned()) {
        <p class="notice">
          This question belongs to another account. You can manage questions only in your own banks.
        </p>
      } @else if (question(); as question) {
        <div class="editor-grid">
          <form class="focused-form" [formGroup]="form" [unsavedChanges]="form" (ngSubmit)="save()">
            <h2>Question</h2>
            <fieldset [disabled]="saving() || answersBusy() || deleting()">
              <div class="field">
                <label for="question-content">Question content</label
                ><textarea
                  id="question-content"
                  formControlName="content"
                  maxlength="1000"
                  [attr.aria-invalid]="
                    form.controls.content.touched && form.controls.content.invalid
                  "
                  aria-describedby="question-content-error"
                ></textarea
                ><small id="question-content-error" class="field-error">
                  @if (form.controls.content.touched && form.controls.content.invalid) {
                    Enter question content, up to 1,000 characters.
                  }
                </small>
              </div>
              <div class="field">
                <label for="question-type">Question type</label
                ><select
                  id="question-type"
                  formControlName="questionType"
                  aria-describedby="type-help"
                >
                  @for (type of types; track type) {
                    <option [ngValue]="type">{{ labels[type] }}</option>
                  }</select
                ><small id="type-help">{{
                  answerCount() > 0
                    ? 'Remove existing answers before changing type.'
                    : !answersReady()
                      ? 'Checking answers before enabling question type changes…'
                      : 'Choose a type before adding answers.'
                }}</small>
              </div>
            </fieldset>
            @if (saveError()) {
              <p class="error" role="alert">{{ saveError() }}</p>
            }
            <div class="question-actions">
              <button
                class="button"
                type="submit"
                [disabled]="saving() || answersBusy() || deleting() || !answersReady()"
              >
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
              <button
                class="text-button danger-button"
                type="button"
                [disabled]="saving() || answersBusy() || deleting()"
                (click)="confirmDelete()"
              >
                Delete question
              </button>
            </div>
          </form>
          <app-answer-manager
            class="answer-panel"
            [question]="question"
            [disabled]="saving() || deleting() || form.dirty"
            (stateChanged)="answerState($event)"
          />
        </div>
      }
      <app-confirm-dialog
        title="Delete question?"
        [subject]="question()?.content || ''"
        description="Its answers will also be removed. Questions used in quizzes cannot be deleted."
        [busy]="deleting()"
        [error]="deleteError()"
        (confirmed)="deleteQuestion()"
      />
    }`,
})
export class QuestionEditor {
  private api = inject(QuestionService);
  private banks = inject(QuestionBankService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private feedback = inject(ContentFeedback);
  private request?: Subscription;
  private id = 0;
  private confirm = viewChild.required(ConfirmDialog);
  question = signal<QuestionDetail | null>(null);
  bank = signal<QuestionBank | null>(null);
  loading = signal(true);
  error = signal('');
  saving = signal(false);
  saveError = signal('');
  deleting = signal(false);
  deleteError = signal('');
  message = signal(this.feedback.take());
  answerCount = signal(0);
  answersBusy = signal(false);
  answersReady = signal(false);
  owned = computed(() => !!this.bank() && this.bank()?.ownerId === this.auth.session()?.userId);
  types = questionTypes;
  labels = questionTypeLabels;
  form = inject(FormBuilder).nonNullable.group({
    content: ['', [nonBlank, Validators.maxLength(1000)]],
    questionType: [QuestionType.SingleChoice, Validators.required],
  });
  readonly creation: 'quiz' | 'bank' | null =
    this.route.snapshot?.data['creation'] === 'quiz'
      ? 'quiz'
      : this.route.snapshot?.data['creation'] === 'bank'
        ? 'bank'
        : null;
  readonly creationId = validId(this.route.snapshot?.paramMap.get('id') ?? null);
  createdQuestion(question: QuestionDetail) {
    this.feedback.set('Question created.');
    void this.router.navigate(['/app/question-banks', question.questionBankId]);
  }
  createdForQuiz(questionId: number) {
    this.feedback.set('Question created and added to quiz.');
    void this.router.navigate(['/app/quizzes', this.creationId, 'builder'], {
      queryParams: { added: questionId },
    });
  }
  constructor() {
    if (this.creation) return;
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = validId(params.get('id'));
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.question.set(null);
    this.bank.set(null);
    this.loading.set(true);
    this.error.set('');
    this.answersReady.set(false);
    this.answersBusy.set(false);
    if (!this.id) {
      this.error.set('This question is unavailable.');
      this.loading.set(false);
      return;
    }
    this.request = this.api
      .detail(this.id)
      .pipe(
        switchMap((question) =>
          this.banks.detail(question.questionBankId).pipe(map((bank) => ({ question, bank }))),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: ({ question, bank }) => {
          this.bank.set(bank);
          this.question.set(question);
          this.form.reset({ content: question.content, questionType: question.questionType });
          this.answerCount.set(question.answers.length);
          this.form.controls.questionType.disable();
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(contentError(e, 'question'));
          this.loading.set(false);
        },
      });
  }
  answerState(state: AnswerState) {
    this.answerCount.set(state.count);
    this.answersBusy.set(state.busy);
    this.answersReady.set(state.ready);
    if (state.count > 0 || !state.ready)
      this.form.controls.questionType.disable({ emitEvent: false });
    else this.form.controls.questionType.enable({ emitEvent: false });
  }
  save() {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.saving() ||
      this.answersBusy() ||
      !this.answersReady() ||
      !this.owned()
    )
      return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set('');
    this.api
      .update(this.id, { ...value, content: value.content.trim() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (q) => {
          this.form.reset({ content: q.content, questionType: q.questionType });
          this.question.set(q);
          this.saving.set(false);
          this.message.set('Question updated.');
        },
        error: (e) => {
          this.saving.set(false);
          this.saveError.set(contentError(e, 'question'));
        },
      });
  }
  confirmDelete() {
    this.deleteError.set('');
    this.confirm().open();
  }
  deleteQuestion() {
    if (!this.owned() || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.api
      .delete(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirm().close();
          this.form.markAsPristine();
          this.feedback.set('Question deleted.');
          void this.router.navigate(['/app/question-banks', this.bank()!.questionBankId]);
        },
        error: (e) => {
          this.deleting.set(false);
          this.deleteError.set(contentError(e, 'question', true));
        },
      });
  }
}
