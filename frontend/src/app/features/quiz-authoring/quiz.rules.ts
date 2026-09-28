import { AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from '../../core/api';
import { QuizQuestion } from './quiz.models';
export function integer(control: AbstractControl): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}
export function validPoints(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0.01 &&
    value <= 100000 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  );
}
const messages: Record<string, string> = {
  'The Quiz must contain at least one question before it can be published.':
    'This quiz needs at least one question before publishing.',
  'The Quiz has existing attempts and cannot be deleted.':
    'This quiz has past attempts and cannot be deleted.',
  'The question is already included in this Quiz.':
    'This question is already added. Refresh the questions before trying again.',
  'The Quiz is already published.':
    'This quiz is already published. Refresh to see its current state.',
  'The Quiz is already private.': 'This quiz is already a draft. Refresh to see its current state.',
  'Quiz title cannot be empty.': 'Enter a quiz title.',
  'Question points must be greater than zero.': 'Points must be between 0.01 and 100,000.',
  'Unpublish the Quiz before changing its questions.':
    'Unpublish this quiz before changing its questions.',
  'Unpublish the Quiz before changing question points.':
    'Unpublish this quiz before changing points.',
  'Unpublish the Quiz before reordering questions.':
    'Unpublish this quiz before reordering questions.',
  'Unpublish the Quiz before removing questions.': 'Unpublish this quiz before removing questions.',
  'The reorder request must contain every question in the Quiz.':
    'The question list has changed. Refresh it before reordering.',
  'The reorder request must contain exactly the questions currently in the Quiz.':
    'The question list has changed. Refresh it before reordering.',
};
export function quizError(error: unknown, rows: QuizQuestion[] = []): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404)
      return 'This quiz or question is no longer available. Refresh or return to My Quizzes.';
    if (error.status === 403)
      return 'You do not have permission to edit this quiz or reuse this question.';
    const body: unknown = error.error;
    if (
      (error.status === 400 || error.status === 409) &&
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      const detail = body.detail;
      if (messages[detail]) return messages[detail];
      const match = detail.match(
        /^(?:Single Choice question|Multiple Choice question|True\/False question|Question) (\d+) (must contain at least two answers\.|must have exactly one correct answer\.|must have at least one correct answer\.|must contain exactly two answers\.|must contain both True and False answers\.|must have points greater than zero\.|has an unsupported question type\.)$/,
      );
      if (match) {
        const index = rows.findIndex((q) => q.questionId === Number(match[1]));
        return (
          (index >= 0 ? 'Question ' + (index + 1) : 'A question in this quiz') + ' ' + match[2]
        );
      }
    }
  }
  return apiError(error);
}
