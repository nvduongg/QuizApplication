import { SuccessFeedback } from '../../shared/success-feedback';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth';
import { ConfirmDialog } from './confirm-dialog';
import { QuestionBankService, QuestionService, ContentFeedback } from './content.services';
import {
  QuestionBank,
  QuestionSummary,
  questionTypeLabels,
  visibilityLabels,
} from './content.models';
import { contentError, validId } from './content.rules';
@Component({
  selector: 'app-bank-detail',
  host: { class: 'bank-workspace' },
  imports: [SuccessFeedback, RouterLink, ConfirmDialog, Icon, CountLabel],
  styleUrl: './content.scss',
  template: ` <a class="page-back" routerLink="/app/question-banks"
      ><app-icon name="back" /> Question Banks</a
    >
    <div class="page-heading bank-heading">
      <div class="page-title-row">
        <h1>{{ bank()?.name || 'Question bank' }}</h1>
        @if (bank(); as bank) {
          <span class="badge">{{ visibility[bank.visibility] }}</span>
        }
      </div>
      @if (bank(); as bank) {
        <p>{{ bank.description || 'Organize questions in this bank.' }}</p>
      }
    </div>

    @if (message()) {
      <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
    }
    @if (loading()) {
      <p class="loading" role="status">Loading question bank…</p>
    } @else if (error()) {
      <section class="state" role="alert">
        <h2>Unable to open question bank</h2>
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (!owned()) {
      <p class="notice">
        This bank belongs to another account. Content management is available only for your own
        question banks.
      </p>
    } @else {
      <div class="bank-actions">
        <button class="button" [disabled]="deleting()" (click)="createQuestion()">
          Add question
        </button>
        <a
          class="button secondary"
          [routerLink]="['/app/question-banks', bank()?.questionBankId, 'import']"
          >Import questions</a
        >
        <button class="button secondary" [disabled]="deleting()" (click)="editBank()">
          Edit bank
        </button>
        <button
          class="text-button action-link danger-button"
          [disabled]="deleting()"
          (click)="confirmDelete()"
        >
          Delete bank
        </button>
      </div>

      @if (owned()) {
        <section class="bank-questions" aria-labelledby="questions-title">
          <h2 id="questions-title">
            Questions
            @if (!questionsLoading() && !questionsError()) {
              <span class="metadata">{{
                bank()?.questionCount ?? 0 | countLabel: 'question'
              }}</span>
            }
          </h2>
          @if (questionsLoading()) {
            <p class="loading" role="status">Loading questions…</p>
          } @else if (questionsError()) {
            <div class="state" role="alert">
              <p>{{ questionsError() }}</p>
              <button class="button secondary" (click)="loadQuestions()">Retry</button>
            </div>
          } @else if (!questions().length) {
            <div class="bank-empty">
              <h3>No questions yet</h3>
              <p>Create the first reusable question in this bank.</p>
            </div>
          } @else {
            <ul class="content-list">
              @for (question of questions(); track question.questionId) {
                <li class="content-row">
                  <div class="row-copy">
                    <h3>
                      <a [routerLink]="['/app/questions', question.questionId]">{{
                        question.content
                      }}</a>
                    </h3>
                    <div class="metadata">
                      <span>{{ typeLabels[question.questionType] }}</span
                      ><span>{{ question.answerCount | countLabel: 'answer' }}</span>
                    </div>
                  </div>
                  <a
                    class="action-link"
                    [routerLink]="['/app/questions', question.questionId]"
                    [attr.aria-label]="'Edit question: ' + question.content"
                    >Edit</a
                  >
                </li>
              }
            </ul>
          }
        </section>
      }
    }
    <app-confirm-dialog
      #deleteDialog
      title="Delete question bank?"
      [subject]="bank()?.name || ''"
      description="Questions and answers in this bank will also be removed. Banks containing questions used by quizzes or past attempts cannot be deleted."
      [busy]="deleting()"
      [error]="deleteError()"
      (confirmed)="deleteBank()"
    />`,
})
export class BankDetail {
  private api = inject(QuestionBankService);
  private questionApi = inject(QuestionService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private feedback = inject(ContentFeedback);
  private request?: Subscription;
  private questionRequest?: Subscription;
  private id = 0;
  private confirm = viewChild.required(ConfirmDialog);
  bank = signal<QuestionBank | null>(null);
  questions = signal<QuestionSummary[]>([]);
  loading = signal(true);
  questionsLoading = signal(false);
  error = signal('');
  questionsError = signal('');
  message = signal(this.feedback.take());
  deleting = signal(false);
  deleteError = signal('');
  owned = computed(() => !!this.bank() && this.bank()?.ownerId === this.auth.session()?.userId);
  visibility = visibilityLabels;
  typeLabels = questionTypeLabels;
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id = validId(params.get('id'));
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.questionRequest?.unsubscribe();
    this.bank.set(null);
    this.error.set('');
    this.loading.set(true);
    if (!this.id) {
      this.error.set('This question bank is unavailable.');
      this.loading.set(false);
      return;
    }
    this.request = this.api
      .detail(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (bank) => {
          this.bank.set(bank);
          this.loading.set(false);
          if (this.owned()) this.loadQuestions();
        },
        error: (e) => {
          this.error.set(contentError(e, 'question bank'));
          this.loading.set(false);
        },
      });
  }
  loadQuestions() {
    if (!this.owned()) return;
    this.questionRequest?.unsubscribe();
    this.questionsLoading.set(true);
    this.questionsError.set('');
    this.questionRequest = this.questionApi
      .byBank(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (q) => {
          this.questions.set(q);
          this.bank.update((bank) => (bank ? { ...bank, questionCount: q.length } : bank));
          this.questionsLoading.set(false);
        },
        error: (e) => {
          this.questionsError.set(contentError(e, 'questions'));
          this.questionsLoading.set(false);
        },
      });
  }
  editBank() {
    void this.router.navigate(['/app/question-banks', this.bank()!.questionBankId, 'edit']);
  }

  createQuestion() {
    void this.router.navigate([
      '/app/question-banks',
      this.bank()!.questionBankId,
      'questions',
      'create',
    ]);
  }

  confirmDelete() {
    this.deleteError.set('');
    this.confirm().open();
  }
  deleteBank() {
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
          this.feedback.set('Question bank deleted.');
          void this.router.navigate(['/app/question-banks']);
        },
        error: (e) => {
          this.deleting.set(false);
          this.deleteError.set(contentError(e, 'question bank', true));
        },
      });
  }
}
