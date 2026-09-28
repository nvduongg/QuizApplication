import { AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from '../../core/api';
import { Answer, AnswerInput, QuestionType } from './content.models';
export function nonBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}
export function validId(value: string | null): number {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
export function answerProblem(
  type: QuestionType,
  answers: Answer[],
  input: AnswerInput,
  editingId?: number,
): string {
  const siblings = answers.filter((a) => a.answerId !== editingId);
  const content = input.content.trim().toLowerCase();
  if (!content) return 'Enter an answer.';
  if (siblings.some((a) => a.content.trim().toLowerCase() === content))
    return 'This answer already exists for the question.';
  if (type === QuestionType.TrueFalse && !['true', 'false'].includes(content))
    return 'Choose True or False.';
  if (type === QuestionType.TrueFalse && siblings.length >= 2)
    return 'A True / False question can contain only two answers.';
  if (type !== QuestionType.MultipleChoice && input.isCorrect && siblings.some((a) => a.isCorrect))
    return 'Unmark the existing correct answer before choosing another.';
  return '';
}
const safeDetails = new Set([
  'Question Bank name cannot be empty.',
  'You already have a Question Bank with this name.',
  'You already have another Question Bank with this name.',
  'Question content cannot be empty.',
  'Question type cannot be changed while the question contains answers. Delete the answers first.',
  'This answer already exists for the question.',
  'A Single Choice question can have only one correct answer.',
  'A True/False question can have only one correct answer.',
  'A True/False question can contain only two answers.',
  "True/False questions can contain only 'True' and 'False' answers.",
  'Answer content cannot be empty.',
]);
export function contentError(error: unknown, resource = 'content', deleting = false): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404)
      return 'This ' + resource + ' is no longer available. Return to the list and refresh.';
    if (error.status === 409 && deleting)
      return resource === 'question bank'
        ? 'One or more questions from this bank are used in a quiz or a past attempt. This bank cannot be deleted.'
        : resource === 'question'
          ? 'This question is used in a quiz or a past attempt and cannot be deleted.'
          : 'This answer is used in a past quiz attempt and cannot be deleted.';
    const body: unknown = error.error;
    if (
      (error.status === 400 || error.status === 409) &&
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string' &&
      safeDetails.has(body.detail)
    )
      return body.detail;
  }
  return apiError(error);
}
