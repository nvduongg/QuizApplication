import { Component, input } from '@angular/core';
import { ResultQuestion, QuestionOutcome } from './result.models';
import { QuestionType, questionTypeLabels } from '../question-banks/content.models';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-result-question-review',
  imports: [Icon],
  styleUrl: './review.scss',
  template: `<section
    class="review-question"
    [attr.aria-labelledby]="'review-' + question().questionId"
  >
    <div class="question-heading">
      <h3 [id]="'review-' + question().questionId">{{ number() }}. {{ question().content }}</h3>
      <span class="points">{{ question().earnedPoints }} / {{ question().maxPoints }} points</span>
    </div>
    <p class="question-meta">
      <span>{{ labels[question().questionType] }}</span>
      <span
        class="outcome"
        [class.correct]="question().outcome === outcomes.Correct"
        [class.incorrect]="question().outcome === outcomes.Incorrect"
      >
        @if (question().outcome === outcomes.Correct) {
          <app-icon name="check" /> Correct
        } @else if (question().outcome === outcomes.Incorrect) {
          <app-icon name="close" /> Incorrect
        } @else {
          Unanswered
        }
      </span>
    </p>
    @if (question().questionType === types.MultipleChoice) {
      <p class="review-note">
        All correct answers must be selected, with no extra choices, to earn the points.
      </p>
    }
    <ul class="review-answers">
      @for (answer of question().answers; track answer.answerId) {
        <li>
          <span class="answer-control" aria-hidden="true">
            <span
              class="selection"
              [class.square]="question().questionType === types.MultipleChoice"
              [class.selected]="selected(answer.answerId)"
              aria-hidden="true"
              >{{
                selected(answer.answerId)
                  ? question().questionType === types.MultipleChoice
                    ? '✓'
                    : '●'
                  : ''
              }}</span
            >
          </span>
          <span class="answer-content">{{ answer.content }}</span>
          <span
            class="answer-meaning"
            [class.correct]="correct(answer.answerId)"
            [class.incorrect]="selected(answer.answerId) && !correct(answer.answerId)"
          >
            @if (correct(answer.answerId)) {
              <app-icon name="check" />
              <span>{{
                selected(answer.answerId) ? 'Your answer · Correct selection' : 'Correct answer'
              }}</span>
            } @else if (selected(answer.answerId)) {
              <app-icon name="close" /><span>Your answer · Incorrect selection</span>
            }
          </span>
        </li>
      }
    </ul>
  </section>`,
})
export class ResultQuestionReview {
  question = input.required<ResultQuestion>();
  number = input.required<number>();
  labels = questionTypeLabels;
  types = QuestionType;
  outcomes = QuestionOutcome;
  selected(id: number) {
    return this.question().selectedAnswerIds.includes(id);
  }
  correct(id: number) {
    return this.question().correctAnswerIds.includes(id);
  }
}
