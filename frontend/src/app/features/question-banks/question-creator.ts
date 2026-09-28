import { Component, DestroyRef, inject, input, output, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthService } from '../../core/auth';
import { UnsavedChangesForm } from '../../shared/unsaved-changes';
import { Icon } from '../../shared/icon';
import { AnswerService, QuestionBankService, QuestionService } from './content.services';
import {
  Answer,
  QuestionBank,
  QuestionDetail,
  QuestionType,
  Visibility,
  questionTypes,
  questionTypeLabels,
} from './content.models';
import { answerProblem, contentError, nonBlank, validId } from './content.rules';
import { QuizQuestionService, QuizService } from '../quiz-authoring/quiz.services';
import { QuizQuestion } from '../quiz-authoring/quiz.models';
import { quizError } from '../quiz-authoring/quiz.rules';

/** One authoring form for banks and quizzes. Created resources survive later failures. */
@Component({
  selector: 'app-question-creator',
  imports: [ReactiveFormsModule, RouterLink, UnsavedChangesForm, Icon],
  templateUrl: './question-creator.html',
  styleUrls: ['./content.scss', './question-creator.scss'],
})
export class QuestionCreator implements OnInit {
  quizId = input<number | null>(null);
  bankId = input<number | null>(null);
  saved = output<QuestionDetail>();
  attached = output<{ questionId: number; rows: QuizQuestion[] }>();
  private auth = inject(AuthService);
  private banksApi = inject(QuestionBankService);
  private questions = inject(QuestionService);
  private answersApi = inject(AnswerService);
  private quizzes = inject(QuizService);
  private links = inject(QuizQuestionService);
  private destroy = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  title = signal('');
  contextError = signal('');
  fixedBank = signal<QuestionBank | null>(null);
  banks = signal<QuestionBank[]>([]);
  loading = signal(false);
  bankError = signal('');
  busy = signal('');
  error = signal('');
  created = signal<QuestionDetail | null>(null);
  answersDone = signal(false);
  uncertain = signal(false);
  types = questionTypes;
  labels = questionTypeLabels;
  type = QuestionType;
  form = this.fb.nonNullable.group({
    bankId: [0, Validators.min(1)],
    content: ['', [nonBlank, Validators.maxLength(1000)]],
    questionType: [QuestionType.SingleChoice, Validators.required],
    answers: this.fb.array([this.answer(), this.answer()]),
  });
  get answers() {
    return this.form.controls.answers;
  }
  private answer(content = '') {
    return this.fb.nonNullable.group({
      content: [content, [nonBlank, Validators.maxLength(500)]],
      isCorrect: false,
    });
  }
  ngOnInit() {
    void this.initialize();
  }
  async initialize() {
    this.loading.set(true);
    this.contextError.set('');
    try {
      if (this.quizId()) {
        const quiz = await this.read(this.quizzes.detail(this.quizId()!));
        this.title.set(quiz.title);
        if (quiz.creatorId !== this.auth.session()?.userId)
          throw new Error('You can manage only your own quizzes.');
        if (quiz.visibility === Visibility.Public)
          throw new Error('Unpublish your quiz before adding questions.');
        await this.loadBanks(validId(this.route.snapshot.queryParamMap.get('bank')));
      } else if (this.bankId()) {
        const bank = await this.read(this.banksApi.detail(this.bankId()!));
        this.title.set(bank.name);
        if (bank.ownerId !== this.auth.session()?.userId)
          throw new Error('You can manage questions only in your own banks.');
        this.fixedBank.set(bank);
        this.banks.set([bank]);
        this.form.controls.bankId.setValue(bank.questionBankId);
      } else this.contextError.set('This question creation page is unavailable.');
    } catch (e) {
      if (!this.destroy.destroyed)
        this.contextError.set(
          e instanceof HttpErrorResponse
            ? contentError(e)
            : 'This authoring context is unavailable or cannot be edited.',
        );
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  backLink() {
    return this.quizId()
      ? ['/app/quizzes', this.quizId()!, 'builder']
      : ['/app/question-banks', this.bankId()!];
  }
  close() {
    if (this.busy()) return;
    void this.router.navigate(this.backLink());
  }
  reset() {
    this.created.set(null);
    this.answersDone.set(false);
    this.uncertain.set(false);
    this.error.set('');
    this.answers.clear();
    this.answers.push(this.answer());
    this.answers.push(this.answer());
    this.form.reset({
      bankId: this.fixedBank()?.questionBankId ?? this.form.controls.bankId.value,
      content: '',
      questionType: QuestionType.SingleChoice,
    });
  }
  async loadBanks(selectId?: number) {
    this.loading.set(true);
    this.bankError.set('');
    try {
      const banks = (await this.read(this.banksApi.mine())).filter(
        (b) => b.ownerId === this.auth.session()?.userId,
      );
      this.banks.set(banks);
      const current = selectId ?? this.form.controls.bankId.value;
      this.form.controls.bankId.setValue(
        banks.some((b) => b.questionBankId === current)
          ? current
          : banks.length === 1
            ? banks[0].questionBankId
            : 0,
      );
    } catch (e) {
      if (!this.destroy.destroyed) this.bankError.set(contentError(e, 'question banks'));
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  changeType() {
    if (this.created() || this.busy()) return;
    if (this.form.controls.questionType.value === QuestionType.TrueFalse) {
      this.answers.clear();
      this.answers.push(this.answer('True'));
      this.answers.push(this.answer('False'));
    } else {
      // Keep content when switching between choice types; reduce correctness to one for radio types.
      if (this.answers.value.every((a) => a.content === 'True' || a.content === 'False')) {
        this.answers.clear();
        this.answers.push(this.answer());
        this.answers.push(this.answer());
      }
      if (this.form.controls.questionType.value === QuestionType.SingleChoice) {
        let selected = false;
        this.answers.controls.forEach((a) => {
          const keep = !selected && a.controls.isCorrect.value;
          a.controls.isCorrect.setValue(keep);
          selected ||= keep;
        });
      }
    }
    this.form.markAsDirty();
    this.error.set('');
  }
  addAnswer() {
    this.form.markAsDirty();
    this.answers.push(this.answer());
  }
  removeAnswer(index: number) {
    if (this.answers.length > 2) {
      this.form.markAsDirty();
      this.answers.removeAt(index);
    }
  }
  choose(index: number, event: Event) {
    this.form.markAsDirty();
    const checked = (event.target as HTMLInputElement).checked;
    if (this.form.controls.questionType.value !== QuestionType.MultipleChoice)
      this.answers.controls.forEach((a, i) =>
        a.controls.isCorrect.setValue(i === index && checked),
      );
    else this.answers.at(index).controls.isCorrect.setValue(checked);
    this.form.markAsDirty();
  }
  bankName() {
    return (
      this.banks().find((b) => b.questionBankId === this.form.controls.bankId.value)?.name ??
      'the selected question bank'
    );
  }
  problem() {
    if (this.form.invalid)
      return 'Choose a question bank and complete the question and answers within their character limits.';
    const value = this.form.getRawValue();
    const accepted: Answer[] = [];
    for (const [index, answer] of value.answers.entries()) {
      const problem = answerProblem(value.questionType, accepted, answer);
      if (problem) return 'Answer ' + (index + 1) + ': ' + problem;
      accepted.push({ ...answer, answerId: index, questionId: 0 });
    }
    const correct = accepted.filter((a) => a.isCorrect).length;
    if (!correct || (value.questionType !== QuestionType.MultipleChoice && correct !== 1))
      return value.questionType === QuestionType.MultipleChoice
        ? 'Select at least one correct answer.'
        : 'Select exactly one correct answer.';
    return '';
  }
  async submit() {
    if (
      this.busy() ||
      this.loading() ||
      this.bankError() ||
      this.contextError() ||
      this.uncertain()
    )
      return;
    if (!this.created()) {
      this.form.markAllAsTouched();
      this.error.set(this.problem());
      if (
        this.error() ||
        !this.banks().some((b) => b.questionBankId === this.form.controls.bankId.value)
      )
        return;
    }
    this.error.set('');
    this.busy.set('Checking quiz…');
    let stage: 'check' | 'create' | 'answers' | 'attach' = 'check';
    try {
      const quizId = this.quizId();
      if (quizId) {
        const quiz = await this.read(this.quizzes.detail(quizId));
        if (quiz.creatorId !== this.auth.session()?.userId)
          throw new Error('You can manage only your own quizzes.');
        if (quiz.visibility === Visibility.Public)
          throw new Error('Unpublish your quiz before adding questions.');
      }
      const value = this.form.getRawValue();
      if (!this.created()) {
        stage = 'create';
        this.busy.set('Creating question…');
        this.created.set(
          await this.read(
            this.questions.create(value.bankId, {
              content: value.content.trim(),
              questionType: value.questionType,
            }),
          ),
        );
      }
      const question = this.created()!;
      if (!this.answersDone()) {
        stage = 'answers';
        this.busy.set('Saving answers…');
        // Read first on every attempt: a failed response may still have committed its answer.
        const persisted = await this.read(this.answersApi.byQuestion(question.questionId));
        for (const answer of value.answers) {
          const input = { content: answer.content.trim(), isCorrect: answer.isCorrect };
          const existing = persisted.find(
            (a) => a.content.toLowerCase() === input.content.toLowerCase(),
          );
          if (existing) {
            if (existing.isCorrect !== input.isCorrect)
              await this.read(this.answersApi.update(existing.answerId, input));
          } else
            persisted.push(await this.read(this.answersApi.create(question.questionId, input)));
        }
        this.created.set({ ...question, answers: persisted });
        this.answersDone.set(true);
        this.form.markAsPristine();
      }
      if (quizId) {
        stage = 'attach';
        this.busy.set('Adding to quiz…');
        let rows = await this.read(this.links.list(quizId));
        if (!rows.some((q) => q.questionId === question.questionId)) {
          try {
            await this.read(this.links.add(quizId, { questionId: question.questionId, points: 1 }));
          } catch (e) {
            // Reconcile conflicts and lost responses using actual composition, never another question.
            rows = await this.read(this.links.list(quizId));
            if (!rows.some((q) => q.questionId === question.questionId)) throw e;
          }
          rows = await this.read(this.links.list(quizId));
        }
        this.attached.emit({ questionId: question.questionId, rows });
      } else this.saved.emit(this.created()!);
      this.busy.set('');
      this.reset();
    } catch (e) {
      if (this.destroy.destroyed) return;
      const detail =
        stage === 'check' && e instanceof Error && !(e instanceof HttpErrorResponse)
          ? e.message
          : stage === 'attach' || stage === 'check'
            ? quizError(e)
            : contentError(e, 'question');
      if (this.created())
        this.error.set(
          'Question was created in ' +
            this.bankName() +
            (this.answersDone()
              ? ', but could not be added to this quiz. '
              : ', but its answers could not be completed. ') +
            detail,
        );
      else if (
        stage === 'create' &&
        e instanceof HttpErrorResponse &&
        (e.status === 0 || e.status >= 500)
      ) {
        this.uncertain.set(true);
        this.error.set(
          'The server did not confirm whether the question was created. Check the question bank before starting again to avoid a duplicate.',
        );
      } else this.error.set((stage === 'create' ? 'Question creation failed. ' : '') + detail);
    } finally {
      if (!this.destroy.destroyed) this.busy.set('');
    }
  }
  private read<T>(request: Observable<T>) {
    return firstValueFrom(request.pipe(takeUntilDestroyed(this.destroy)));
  }
}
