import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { validId } from '../question-banks/content.rules';
import { ContentFeedback } from '../question-banks/content.services';
import { SuccessFeedback } from '../../shared/success-feedback';
import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth';
import {
  QuestionBank,
  QuestionSummary,
  questionTypeLabels,
} from '../question-banks/content.models';
import { QuestionReuseService, QuizQuestionService, QuizService } from './quiz.services';
import { quizError } from './quiz.rules';
@Component({
  selector: 'app-question-picker',
  host: { class: 'has-page-back' },
  imports: [SuccessFeedback, ReactiveFormsModule, RouterLink, Icon, CountLabel],
  styleUrl: './quiz.scss',
  template: `<a
      class="page-back"
      [routerLink]="busy() ? null : ['/app/quizzes', quizId(), 'builder']"
      ><app-icon name="back" /> {{ title() || 'Quiz Builder' }}</a
    >
    <div class="page-heading">
      <h1>Add questions</h1>
      <p>Choose reusable questions from your question banks and accessible public banks.</p>
    </div>
    @if (contextLoading()) {
      <p role="status">Loading quiz…</p>
    } @else if (contextError()) {
      <p class="error" role="alert">{{ contextError() }}</p>
      <button class="button secondary" (click)="initialize()">Retry</button>
    } @else {
      @if (banksLoading()) {
        <p class="loading" role="status">Loading accessible banks…</p>
      } @else if (banksError()) {
        <p class="error" role="alert">{{ banksError() }}</p>
        <button class="button secondary" (click)="loadBanks()">Retry</button>
      } @else {
        <div class="picker-filters">
          <div>
            <label for="picker-bank">Browse a question bank</label
            ><select
              id="picker-bank"
              [value]="bankId()"
              [disabled]="busy()"
              (change)="chooseBank($event)"
            >
              <option value="0" [selected]="bankId() === 0">Choose a bank</option>
              @for (bank of banks(); track bank.questionBankId) {
                <option [value]="bank.questionBankId" [selected]="bank.questionBankId === bankId()">
                  {{ bank.ownerId === userId() ? 'Yours' : 'Public' }} · {{ bank.name }}
                </option>
              }
            </select>
          </div>
          <form (submit)="search($event)">
            <label for="picker-search">Search all accessible questions</label>
            <div class="picker-search">
              <input
                id="picker-search"
                [formControl]="query"
                placeholder="Question content"
                [readonly]="busy()"
              /><button type="submit" class="button secondary" [disabled]="busy()">Search</button>
            </div>
          </form>
        </div>
        @if (loading()) {
          <p class="loading" role="status">Loading questions…</p>
        } @else if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
          <button class="button secondary" [disabled]="busy()" (click)="loadQuestions()">
            Retry
          </button>
        } @else if (!questions().length) {
          <p class="state">
            {{
              searchTerm()
                ? 'No matching questions. Try another keyword.'
                : banks().length
                  ? 'No questions in this bank yet. Choose another bank.'
                  : 'No accessible question banks yet. Create questions in Question Banks first.'
            }}
          </p>
        } @else {
          <ul class="content-list picker-list">
            @for (question of questions(); track question.questionId) {
              <li class="content-row">
                <label class="picker-choice"
                  ><input
                    type="checkbox"
                    [checked]="selected().has(question.questionId) || included(question.questionId)"
                    [disabled]="busy() || included(question.questionId)"
                    (change)="toggle(question, $event)"
                  /><span class="row-copy"
                    ><span>{{ question.content }}</span
                    ><span class="metadata"
                      >{{ labels[question.questionType] }} ·
                      {{ origin(question.questionBankId) }}</span
                    >
                    @if (included(question.questionId)) {
                      <span class="metadata">Already added</span>
                    }
                  </span></label
                >
              </li>
            }
          </ul>
        }
      }
      @if (result()) {
        <app-success-feedback [message]="result()" (dismissed)="result.set('')" />
      }
      @if (failures().length) {
        <div class="error" role="alert">
          <p>Some questions could not be added. Successful additions are kept.</p>
          <ul>
            @for (failure of failures(); track $index) {
              <li>{{ failure }}</li>
            }
          </ul>
        </div>
      }
      @if (syncFailed()) {
        <p class="error" role="alert">
          Unable to refresh the quiz after adding. Refresh before retrying to avoid duplicates.
        </p>
        <button class="button secondary" [disabled]="busy()" (click)="refreshIncluded()">
          Refresh quiz questions
        </button>
      }
      <div class="picker-actions">
        <p class="selection-note">
          {{ selected().size | countLabel: 'question' }} selected · New questions start at 1 point
          each.
        </p>
        <div class="row-actions">
          <button type="button" class="button secondary" [disabled]="busy()" (click)="close()">
            Cancel</button
          ><button
            type="button"
            class="button"
            [disabled]="busy() || !selected().size || syncFailed()"
            (click)="addSelected()"
          >
            {{
              busy() ? 'Adding / refreshing…' : 'Add ' + (selected().size | countLabel: 'question')
            }}
          </button>
        </div>
      </div>
    }`,
})
export class QuestionPicker implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizzes = inject(QuizService);
  private feedback = inject(ContentFeedback);
  quizId = signal(validId(this.route.snapshot.paramMap.get('id')));
  title = signal('');
  contextLoading = signal(true);
  contextError = signal('');
  private reuse = inject(QuestionReuseService);
  private api = inject(QuizQuestionService);
  private auth = inject(AuthService);
  private destroy = inject(DestroyRef);
  private bankRequest?: Subscription;
  private request?: Subscription;
  labels = questionTypeLabels;
  userId = () => this.auth.session()?.userId;
  banks = signal<QuestionBank[]>([]);
  banksLoading = signal(false);
  banksError = signal('');
  questions = signal<QuestionSummary[]>([]);
  bankId = signal(0);
  query = new FormControl('', { nonNullable: true });
  searchTerm = signal('');
  loading = signal(false);
  error = signal('');
  selected = signal(new Map<number, QuestionSummary>());
  busy = signal(false);
  result = signal('');
  failures = signal<string[]>([]);
  syncFailed = signal(false);
  private known = signal(new Set<number>());
  ngOnInit() {
    void this.initialize();
  }
  async initialize() {
    this.contextLoading.set(true);
    this.contextError.set('');
    if (!this.quizId()) {
      this.contextError.set('This quiz is unavailable.');
      this.contextLoading.set(false);
      return;
    }
    try {
      await this.checkQuiz();
      const rows = await firstValueFrom(
        this.api.list(this.quizId()).pipe(takeUntilDestroyed(this.destroy)),
      );
      this.known.set(new Set(rows.map((q) => q.questionId)));
      this.loadBanks();
    } catch (e) {
      if (!this.destroy.destroyed && !this.contextError()) this.contextError.set(quizError(e));
    } finally {
      if (!this.destroy.destroyed) this.contextLoading.set(false);
    }
  }
  private async checkQuiz() {
    const quiz = await firstValueFrom(
      this.quizzes.detail(this.quizId()).pipe(takeUntilDestroyed(this.destroy)),
    );
    this.title.set(quiz.title);
    if (quiz.creatorId !== this.userId() || quiz.visibility === 2) {
      this.contextError.set('You can add questions only to your own unpublished quiz.');
      throw new Error('Quiz is not editable.');
    }
  }
  close() {
    if (!this.busy()) void this.router.navigate(['/app/quizzes', this.quizId(), 'builder']);
  }
  loadBanks() {
    this.bankRequest?.unsubscribe();
    this.banksLoading.set(true);
    this.banksError.set('');
    this.bankRequest = forkJoin([this.reuse.ownedBanks(), this.reuse.publicBanks()])
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: ([owned, publicBanks]) => {
          this.banks.set([...owned, ...publicBanks]);
          this.bankId.set(owned[0]?.questionBankId ?? publicBanks[0]?.questionBankId ?? 0);
          this.query.setValue('');
          this.searchTerm.set('');
          this.banksLoading.set(false);
          this.loadQuestions();
        },
        error: (e) => {
          this.banksLoading.set(false);
          this.banksError.set(quizError(e));
        },
      });
  }
  chooseBank(event: Event) {
    this.bankId.set(Number((event.target as HTMLSelectElement).value));
    this.query.setValue('');
    this.searchTerm.set('');
    this.loadQuestions();
  }
  search(event?: Event) {
    event?.preventDefault();
    if (this.busy()) return;
    this.searchTerm.set(this.query.value.trim());
    this.loadQuestions();
  }
  loadQuestions() {
    this.request?.unsubscribe();
    this.error.set('');
    if (!this.searchTerm() && !this.bankId()) {
      this.questions.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.request = (
      this.searchTerm() ? this.reuse.search(this.searchTerm()) : this.reuse.byBank(this.bankId())
    )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (q) => {
          this.questions.set(q);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(quizError(e));
        },
      });
  }
  origin(id: number) {
    const bank = this.banks().find((b) => b.questionBankId === id);
    return bank
      ? (bank.ownerId === this.userId()
          ? 'Your question · '
          : 'Public · ' + bank.ownerName + ' · ') + bank.name
      : 'Accessible question';
  }
  included(id: number) {
    return this.known().has(id);
  }
  toggle(question: QuestionSummary, event: Event) {
    if (this.busy() || this.included(question.questionId)) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.update((current) => {
      const next = new Map(current);
      if (checked) next.set(question.questionId, question);
      else next.delete(question.questionId);
      return next;
    });
  }
  async addSelected() {
    if (this.busy() || this.syncFailed() || this.contextLoading() || this.contextError()) return;
    const selected = [...this.selected().values()].filter((q) => !this.included(q.questionId));
    if (!selected.length) return;
    this.busy.set(true);
    this.failures.set([]);
    try {
      await this.checkQuiz();
    } catch (e) {
      if (!this.destroy.destroyed) {
        if (!this.contextError()) this.error.set(quizError(e));
        this.busy.set(false);
      }
      return;
    }
    let added = 0;
    const failed = new Map<number, string>();
    for (const question of selected) {
      try {
        const q = await firstValueFrom(
          this.api
            .add(this.quizId(), { questionId: question.questionId, points: 1 })
            .pipe(takeUntilDestroyed(this.destroy)),
        );
        this.known.update((ids) => new Set([...ids, q.questionId]));
        this.selected.update((current) => {
          const next = new Map(current);
          next.delete(q.questionId);
          return next;
        });
        added++;
      } catch (e) {
        if (this.destroy.destroyed) return;
        this.failures.update((errors) => [...errors, question.content + ': ' + quizError(e)]);
        failed.set(question.questionId, question.content + ': ' + quizError(e));
      }
    }
    this.result.set(added === 1 ? 'Question added.' : added + ' questions added.');
    await this.refreshIncluded();
    if (!this.syncFailed()) {
      this.failures.set(
        [...failed].filter(([id]) => !this.included(id)).map(([, message]) => message),
      );
      this.result.set(
        selected.filter((q) => this.included(q.questionId)).length +
          ' of ' +
          selected.length +
          ' selected questions are now in the quiz.',
      );
    }
    if (!this.syncFailed() && !this.selected().size) {
      this.feedback.set('Selected questions are now in the quiz.');
      void this.router.navigate(['/app/quizzes', this.quizId(), 'builder'], {
        queryParams: { added: selected[selected.length - 1].questionId },
      });
    }
  }
  async refreshIncluded() {
    this.busy.set(true);
    try {
      const rows = await firstValueFrom(
        this.api.list(this.quizId()).pipe(takeUntilDestroyed(this.destroy)),
      );
      this.known.set(new Set(rows.map((q) => q.questionId)));
      this.selected.update(
        (current) => new Map([...current].filter(([id]) => !this.known().has(id))),
      );
      this.syncFailed.set(false);
    } catch {
      if (this.destroy.destroyed) return;
      this.syncFailed.set(true);
    } finally {
      if (!this.destroy.destroyed) this.busy.set(false);
    }
  }
}
