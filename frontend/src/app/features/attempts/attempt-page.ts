import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AttemptClock, timerLabel, timerWarning } from './attempt-clock';
import { AuthService } from '../../core/auth';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { ConfirmDialog } from '../question-banks/confirm-dialog';
import { QuestionType } from '../question-banks/content.models';
import {
  AttemptService,
  AttemptStatus,
  QuizAttempt,
  AttemptQuestion,
  attemptError,
} from './attempt.service';
@Component({
  selector: 'app-attempt-page',
  imports: [RouterLink, Icon, CountLabel, ConfirmDialog],
  host: { class: 'has-page-back' },
  styleUrl: './attempt.scss',
  template: `
    <a class="page-back" routerLink="/app/history"><app-icon name="back" /> History</a>
    <div class="page-heading">
      <h1>{{ attempt()?.quizTitle || 'Quiz attempt' }}</h1>
      <p>
        {{
          completed() ? 'Quiz completed' : 'Choose your answers, then submit when you are ready.'
        }}
      </p>
    </div>
    @if (loading()) {
      <p class="loading" role="status">Loading attempt…</p>
    } @else if (loadError()) {
      <section class="state" role="alert">
        <p>{{ loadError() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (attempt(); as attempt) {
      @if (completed()) {
        <p role="status">Your quiz is completed.</p>
        <a class="button" [routerLink]="['/app/attempts', attempt.quizAttemptId, 'result']"
          >View result</a
        >
      } @else {
        <div class="progress-row">
          <p>{{ answered() }} of {{ attempt.questions.length }} answered</p>
          <p>{{ attempt.totalPoints | countLabel: 'point' }}</p>
          @if (remaining() !== null) {
            <p
              class="attempt-timer"
              [class.warning]="warning() === 'warning'"
              [class.urgent]="warning() === 'urgent'"
            >
              <span>{{ expired() ? 'Time expired' : 'Time remaining' }}</span>
              <strong role="timer" aria-live="off">{{ clockLabel() }}</strong>
            </p>
          }
        </div>
        <progress
          [value]="answered()"
          [max]="attempt.questions.length || 1"
          aria-label="Questions answered"
        ></progress>
        @if (current(); as q) {
          <section class="taking-question" aria-labelledby="question-title">
            <p class="metadata">
              Question {{ index() + 1 }} of {{ attempt.questions.length }} ·
              {{ q.points | countLabel: 'point' }}
            </p>
            <h2 id="question-title" #questionTitle tabindex="-1">{{ q.content }}</h2>
            <p class="metadata">
              {{
                q.questionType === types.MultipleChoice
                  ? 'Select all answers that apply. All correct choices are needed for the points.'
                  : 'Select one answer.'
              }}
            </p>
            <fieldset
              [disabled]="busy() || checking() || expired()"
              aria-labelledby="question-title"
            >
              @for (answer of q.answers; track answer.answerId) {
                <label class="answer-option"
                  ><span class="answer-control"
                    ><input
                      [type]="q.questionType === types.MultipleChoice ? 'checkbox' : 'radio'"
                      [name]="'question-' + q.questionId"
                      [checked]="selected(q.questionId, answer.answerId)"
                      (change)="select(q, answer.answerId, $event)" /></span
                  ><span class="answer-content">{{ answer.content }}</span></label
                >
              }
            </fieldset>
            <button
              type="button"
              class="text-button clear-answer"
              [disabled]="busy() || checking() || expired() || !selections()[q.questionId]?.length"
              (click)="clear(q.questionId)"
            >
              Clear answer
            </button>
          </section>
          <div class="attempt-actions">
            <div class="nav-actions">
              <button
                class="button secondary"
                [disabled]="index() === 0 || busy() || checking()"
                (click)="move(-1)"
              >
                Previous</button
              ><button
                class="button secondary"
                [disabled]="index() === attempt.questions.length - 1 || busy() || checking()"
                (click)="move(1)"
              >
                Next
              </button>
            </div>
            <button
              class="button"
              [disabled]="busy() || checking() || expired()"
              (click)="askSubmit()"
            >
              {{ busy() ? 'Submitting…' : 'Submit quiz' }}
            </button>
          </div>
        } @else {
          <p class="state">There are no questions in this attempt.</p>
          <button
            class="button"
            [disabled]="busy() || checking() || expired()"
            (click)="askSubmit()"
          >
            Submit quiz
          </button>
        }
        @if (error()) {
          <div class="error" role="alert">
            <p>{{ error() }}</p>
            <button
              class="button secondary"
              [disabled]="busy() || checking()"
              (click)="checkStatus()"
            >
              {{ checking() ? 'Checking…' : 'Check attempt status' }}
            </button>
            @if (expired()) {
              <button class="button secondary" [disabled]="busy() || checking()" (click)="submit()">
                Retry finalization
              </button>
            }
          </div>
        }
        <p class="metadata draft-note">
          Selections are kept in this tab while you work. You can submit with unanswered questions.
          @if (attempt.expiresAt) {
            At zero, your answers are submitted automatically. Answers received more than five
            seconds late cannot be counted.
          }
        </p>
      }
    }
    <app-confirm-dialog
      [title]="
        answered() < (attempt()?.questions.length || 0)
          ? 'Submit with unanswered questions?'
          : 'Submit quiz?'
      "
      [subject]="attempt()?.quizTitle || ''"
      [description]="
        answered() < (attempt()?.questions.length || 0)
          ? 'You have unanswered questions. Submit anyway? Your submission cannot be changed.'
          : 'Your submission cannot be changed. Submit your answers now?'
      "
      actionLabel="Submit quiz"
      pendingLabel="Submitting…"
      [danger]="false"
      [irreversible]="false"
      [busy]="busy()"
      [error]="error()"
      (confirmed)="submit()"
    />
  `,
})
export class AttemptPage {
  private injector = inject(Injector);
  private questionTitle = viewChild<ElementRef<HTMLElement>>('questionTitle');
  move(offset: number) {
    if (this.busy() || this.checking()) return;
    this.index.update((i) =>
      Math.max(0, Math.min(i + offset, (this.attempt()?.questions.length || 1) - 1)),
    );
    afterNextRender(() => this.questionTitle()?.nativeElement.focus(), { injector: this.injector });
  }
  private api = inject(AttemptService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private confirm = viewChild(ConfirmDialog);
  private clock = new AttemptClock();
  private autoSubmitted = false;
  remaining = signal<number | null>(null);
  expired = signal(false);
  clockLabel = computed(() => timerLabel(this.remaining() ?? 0));
  warning = computed(() => timerWarning(this.remaining() ?? 301));
  private request?: Subscription;
  private mutation?: Subscription;
  private id = 0;
  attempt = signal<QuizAttempt | null>(null);
  loading = signal(true);
  loadError = signal('');
  error = signal('');
  busy = signal(false);
  checking = signal(false);
  index = signal(0);
  selections = signal<Record<number, number[]>>({});
  types = QuestionType;
  completed = computed(() => this.attempt()?.status === AttemptStatus.Completed);
  current = computed(() => this.attempt()?.questions[this.index()] ?? null);
  answered = computed(
    () =>
      this.attempt()?.questions.filter((q) => this.selections()[q.questionId]?.length).length ?? 0,
  );
  constructor() {
    const timer = setInterval(() => this.tick(), 1000);
    const resume = () => {
      if (
        document.visibilityState === 'visible' &&
        this.attempt() &&
        !this.completed() &&
        !this.loading()
      )
        this.checkStatus();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    this.destroy.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.request?.unsubscribe();
      this.mutation?.unsubscribe();
      this.id = Number(params.get('id'));
      this.attempt.set(null);
      this.error.set('');
      this.selections.set({});
      this.index.set(0);
      this.busy.set(false);
      this.checking.set(false);
      this.remaining.set(null);
      this.expired.set(false);
      this.autoSubmitted = false;
      this.load();
    });
  }
  private key() {
    return 'quizizi.attempt.' + this.auth.session()?.userId + '.' + this.id;
  }
  private persist() {
    try {
      sessionStorage.setItem(this.key(), JSON.stringify(this.selections()));
    } catch {
      /* Storage may be unavailable; current selections remain in memory. */
    }
  }
  private accept(a: QuizAttempt) {
    this.attempt.set({
      ...a,
      questions: [...a.questions].sort((x, y) => x.questionOrder - y.questionOrder),
    });
    if (a.status === AttemptStatus.Completed) {
      try {
        sessionStorage.removeItem(this.key());
      } catch {
        /* Optional local draft. */
      }
      void this.router.navigate(['/app/attempts', a.quizAttemptId, 'result'], {
        replaceUrl: true,
      });
      return;
    }
    let draft: unknown = this.selections();
    try {
      draft = JSON.parse(sessionStorage.getItem(this.key()) || JSON.stringify(draft));
    } catch {
      /* Retain in-memory answers. */
    }
    const clean: Record<number, number[]> = {};
    for (const q of a.questions) {
      const values: unknown =
        typeof draft === 'object' && draft !== null
          ? Reflect.get(draft, String(q.questionId))
          : undefined;
      if (Array.isArray(values)) {
        const ids = q.answers
          .filter((answer) => values.includes(answer.answerId))
          .map((answer) => answer.answerId);
        clean[q.questionId] =
          q.questionType === QuestionType.MultipleChoice ? ids : ids.slice(0, 1);
      }
    }
    this.selections.set(clean);
    this.index.update((i) => Math.max(0, Math.min(i, a.questions.length - 1)));
    if (a.expiresAt) {
      if (!a.serverNow || !this.clock.reset(a.expiresAt, a.serverNow, performance.now())) {
        this.expired.set(true);
        this.error.set('Unable to verify the time limit. Check attempt status before continuing.');
        return;
      }
      this.remaining.set(this.clock.remaining(performance.now()));
      if (!this.autoSubmitted && this.remaining()! > 0) this.expired.set(false);
    } else this.remaining.set(null);
    this.tick();
  }
  tick() {
    if (this.completed() || this.remaining() === null) return;
    this.remaining.set(this.clock.remaining(performance.now()));
    if (this.remaining() === 0) {
      this.expired.set(true);
      if (!this.autoSubmitted && !this.busy() && !this.checking()) {
        this.autoSubmitted = true;
        this.confirm()?.close();
        this.submit();
      }
    }
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    if (!Number.isSafeInteger(this.id) || this.id < 1) {
      this.loading.set(false);
      this.loadError.set('This attempt is unavailable.');
      return;
    }
    this.request = this.api
      .get(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (a) => {
          this.accept(a);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.loadError.set(attemptError(e));
        },
      });
  }
  selected(q: number, a: number) {
    return !!this.selections()[q]?.includes(a);
  }
  select(q: AttemptQuestion, id: number, event: Event) {
    if (this.busy() || this.checking() || this.completed() || this.expired()) return;
    const checked = (event.target as HTMLInputElement).checked;
    const previous = this.selections()[q.questionId] || [];
    const next =
      q.questionType === QuestionType.MultipleChoice
        ? checked
          ? [...new Set([...previous, id])]
          : previous.filter((a) => a !== id)
        : [id];
    this.selections.update((s) => ({ ...s, [q.questionId]: next }));
    this.persist();
  }
  clear(id: number) {
    if (this.busy() || this.checking() || this.completed() || this.expired()) return;
    this.selections.update((s) => ({ ...s, [id]: [] }));
    this.persist();
  }
  askSubmit() {
    if (this.busy() || this.checking() || this.completed() || this.expired()) return;
    this.error.set('');
    this.confirm()?.open();
  }
  submit() {
    const a = this.attempt();
    if (!a || this.completed() || this.busy() || this.checking()) return;
    this.busy.set(true);
    this.error.set('');
    const questions = a.questions
      .filter((q) => this.selections()[q.questionId]?.length)
      .map((q) => ({ questionId: q.questionId, answerIds: this.selections()[q.questionId] }));
    this.mutation = this.api
      .submit(this.id, { questions })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.confirm()?.close();
          this.attempt.update((a) =>
            a ? { ...a, status: result.status, submittedAt: result.submittedAt } : a,
          );
          try {
            sessionStorage.removeItem(this.key());
          } catch {
            /* Optional local draft. */
          }
          void this.router.navigate(['/app/attempts', result.quizAttemptId, 'result'], {
            replaceUrl: true,
          });
        },
        error: (e) => {
          this.busy.set(false);
          this.confirm()?.close();
          this.error.set(attemptError(e));
          this.checkStatus();
        },
      });
  }
  checkStatus() {
    if (this.busy() || this.checking()) return;
    this.checking.set(true);
    this.request?.unsubscribe();
    this.request = this.api
      .get(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (a) => {
          this.checking.set(false);
          this.accept(a);
        },
        error: (e) => {
          this.checking.set(false);
          this.error.set(attemptError(e));
        },
      });
  }
}
