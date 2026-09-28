import { SuccessFeedback } from '../../shared/success-feedback';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { QuestionBankService, ContentFeedback } from './content.services';
import { QuestionBank, visibilityLabels } from './content.models';
import { contentError } from './content.rules';
@Component({
  selector: 'app-bank-list',
  imports: [SuccessFeedback, RouterLink, Icon, CountLabel],
  styleUrl: './content.scss',
  template: `
    <div class="page-heading">
      <h1>Question Banks</h1>
      <p>Organize reusable questions for your quizzes.</p>
    </div>
    <div class="toolbar">
      <span>My question banks</span
      ><a class="button" routerLink="/app/question-banks/create">New question bank</a>
    </div>
    @if (message()) {
      <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
    }
    @if (loading()) {
      <p class="loading" role="status">Loading question banks…</p>
    } @else if (error()) {
      <section class="state" role="alert">
        <h2>Unable to load question banks</h2>
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (!banks().length) {
      <section class="state">
        <h2>No question banks yet</h2>
        <p>Create a question bank to organize reusable questions.</p>
      </section>
    } @else {
      <ul class="content-list">
        @for (bank of banks(); track bank.questionBankId) {
          <li>
            <a class="bank-row-link" [routerLink]="['/app/question-banks', bank.questionBankId]"
              ><div class="row-copy">
                <h2>{{ bank.name }}</h2>
                @if (bank.description) {
                  <p>{{ bank.description }}</p>
                }
                <div class="metadata">
                  <span>{{ visibility[bank.visibility] }}</span
                  ><span>{{ bank.questionCount | countLabel: 'question' }}</span>
                </div>
              </div>
              <app-icon name="forward"
            /></a>
          </li>
        }
      </ul>
    }
  `,
})
export class BankList {
  private api = inject(QuestionBankService);
  private destroy = inject(DestroyRef);
  private feedback = inject(ContentFeedback);
  private request?: Subscription;
  readonly visibility = visibilityLabels;
  banks = signal<QuestionBank[]>([]);
  loading = signal(true);
  error = signal('');
  message = signal(this.feedback.take());
  constructor() {
    this.load();
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api
      .mine()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (banks) => {
          this.banks.set(banks);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(contentError(e, 'question banks'));
          this.loading.set(false);
        },
      });
  }
}
