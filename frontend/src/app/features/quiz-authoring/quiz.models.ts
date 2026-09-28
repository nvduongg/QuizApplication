import { QuestionType, Visibility } from '../question-banks/content.models';
export interface QuizInput {
  title: string;
  description: string | null;
  duration: number;
}
export interface OwnedQuiz extends QuizInput {
  quizId: number;
  visibility: Visibility;
  createdAt: string;
  creatorId: string;
  creatorName: string;
  questionCount: number;
  totalPoints: number;
}
export interface QuizQuestion {
  quizId: number;
  questionId: number;
  content: string;
  questionType: QuestionType;
  questionOrder: number;
  points: number;
  answerCount: number;
  isOwnedQuestion: boolean;
}
export interface AddQuizQuestion {
  questionId: number;
  points: number;
}
