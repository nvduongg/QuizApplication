import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth';
import { Icon } from '../shared/icon';
import { BankForm } from './question-banks/bank-form';
import { QuestionBank } from './question-banks/content.models';
import { ContentFeedback, QuestionBankService } from './question-banks/content.services';
import { contentError, validId } from './question-banks/content.rules';
import { QuizForm } from './quiz-authoring/quiz-form';
import { OwnedQuiz } from './quiz-authoring/quiz.models';
import { QuizService } from './quiz-authoring/quiz.services';

/** Reuses the existing detail forms; return destinations are explicit application routes. */
@Component({
  selector: 'app-authoring-details-page',
  host: { class: 'has-page-back' },
  imports: [RouterLink, Icon, BankForm, QuizForm],
  styleUrl: './question-banks/content.scss',
  template: `
    <a class="page-back" [routerLink]="backLink()"
      ><app-icon name="back" />
      {{
        returnQuizId
          ? 'Create question'
          : bank()?.name || quiz()?.title || (resource === 'bank' ? 'Question Banks' : 'My Quizzes')
      }}</a
    >
    <div class="page-heading">
      <h1>{{ id ? 'Edit' : 'Create' }} {{ resource === 'bank' ? 'question bank' : 'quiz' }}</h1>
      <p>
        {{
          returnQuizId
            ? 'Create a bank, then continue creating your question.'
            : 'Set up the details for your ' + (resource === 'bank' ? 'question bank.' : 'quiz.')
        }}
      </p>
    </div>
    @if (loading()) {
      <p role="status">Loading details…</p>
    } @else if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
      <button class="button secondary" (click)="load()">Retry</button>
    } @else {
      <div class="focused-form">
        @if (resource === 'bank') {
          <app-bank-form
            [initial]="bank()"
            [minimal]="!!returnQuizId"
            (saved)="bankSaved($event)"
            (cancelled)="cancel()"
          />
        } @else {
          <app-quiz-form [initial]="quiz()" (saved)="quizSaved($event)" (cancelled)="cancel()" />
        }
      </div>
    }
  `,
})
export class AuthoringDetailsPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private banks = inject(QuestionBankService);
  private quizzes = inject(QuizService);
  private feedback = inject(ContentFeedback);
  private destroy = inject(DestroyRef);
  readonly resource: 'bank' | 'quiz' =
    this.route.snapshot.data['resource'] === 'quiz' ? 'quiz' : 'bank';
  readonly id = validId(this.route.snapshot.paramMap.get('id'));
  readonly returnQuizId =
    this.resource === 'bank' && !this.id
      ? validId(this.route.snapshot.queryParamMap.get('quizId'))
      : 0;
  bank = signal<QuestionBank | null>(null);
  quiz = signal<OwnedQuiz | null>(null);
  loading = signal(false);
  error = signal('');
  constructor() {
    this.load();
  }
  backLink() {
    if (this.returnQuizId) return ['/app/quizzes', this.returnQuizId, 'questions', 'create'];
    return this.resource === 'bank'
      ? this.id
        ? ['/app/question-banks', this.id]
        : ['/app/question-banks']
      : this.id
        ? ['/app/quizzes', this.id, 'builder']
        : ['/app/quizzes'];
  }
  cancel() {
    void this.router.navigate(this.backLink());
  }
  load() {
    if (this.route.snapshot.paramMap.has('id') && !this.id) {
      this.error.set('This editing page is unavailable.');
      return;
    }
    if (!this.id) return;
    this.loading.set(true);
    this.error.set('');
    if (this.resource === 'bank')
      this.banks
        .detail(this.id)
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: (bank) => {
            this.loading.set(false);
            if (bank.ownerId !== this.auth.session()?.userId)
              this.error.set('You can edit only your own banks.');
            else this.bank.set(bank);
          },
          error: (e) => {
            this.loading.set(false);
            this.error.set(contentError(e));
          },
        });
    else
      this.quizzes
        .detail(this.id)
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: (quiz) => {
            this.loading.set(false);
            if (quiz.creatorId !== this.auth.session()?.userId)
              this.error.set('You can edit only your own quizzes.');
            else this.quiz.set(quiz);
          },
          error: (e) => {
            this.loading.set(false);
            this.error.set(contentError(e));
          },
        });
  }
  bankSaved(bank: QuestionBank) {
    this.feedback.set(this.id ? 'Question bank updated.' : 'Question bank created.');
    if (this.returnQuizId)
      void this.router.navigate(this.backLink(), { queryParams: { bank: bank.questionBankId } });
    else void this.router.navigate(['/app/question-banks', bank.questionBankId]);
  }
  quizSaved(quiz: OwnedQuiz) {
    this.feedback.set(this.id ? 'Quiz updated.' : 'Quiz created.');
    void this.router.navigate(['/app/quizzes', quiz.quizId, 'builder']);
  }
}
