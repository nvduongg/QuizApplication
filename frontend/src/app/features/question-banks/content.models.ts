export enum Visibility {
  Private = 1,
  Public = 2,
}
export enum QuestionType {
  MultipleChoice = 1,
  SingleChoice = 2,
  TrueFalse = 3,
}
export const visibilityLabels: Record<Visibility, string> = { 1: 'Private', 2: 'Public' };
export const questionTypeLabels: Record<QuestionType, string> = {
  1: 'Multiple Choice',
  2: 'Single Choice',
  3: 'True / False',
};
export const questionTypes = [
  QuestionType.SingleChoice,
  QuestionType.MultipleChoice,
  QuestionType.TrueFalse,
];
export function questionTypeLabel(type: string): string {
  const value = questionTypes.find((value) => QuestionType[value] === type);
  return value === undefined ? 'Unsupported type' : questionTypeLabels[value];
}
export interface BankInput {
  name: string;
  description: string | null;
  visibility: Visibility;
}
export interface QuestionBank extends BankInput {
  questionBankId: number;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  questionCount: number;
}
export interface QuestionInput {
  content: string;
  questionType: QuestionType;
}
export interface QuestionSummary extends QuestionInput {
  questionId: number;
  questionBankId: number;
  createdAt: string;
  answerCount: number;
}
export interface QuestionDetail extends QuestionInput {
  questionId: number;
  questionBankId: number;
  createdAt: string;
  answers: Answer[];
}
export interface AnswerInput {
  content: string;
  isCorrect: boolean;
}
export interface Answer extends AnswerInput {
  answerId: number;
  questionId: number;
}
