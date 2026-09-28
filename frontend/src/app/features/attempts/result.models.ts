import { AttemptStatus, AttemptAnswer } from './attempt.service';
import { QuestionType } from '../question-banks/content.models';
export enum QuestionOutcome {
  Correct = 1,
  Incorrect = 2,
  Unanswered = 3,
}
export interface SubmissionReceipt {
  quizAttemptId: number;
  status: AttemptStatus;
  submittedAt: string;
}
export interface AttemptHistoryItem {
  quizAttemptId: number;
  quizId: number;
  quizTitle: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  totalPoints: number;
  percentage: number | null;
}
export interface ResultQuestion {
  questionId: number;
  content: string;
  questionType: QuestionType;
  questionOrder: number;
  earnedPoints: number;
  maxPoints: number;
  outcome: QuestionOutcome;
  selectedAnswerIds: number[];
  correctAnswerIds: number[];
  answers: AttemptAnswer[];
}
export interface QuizAttemptResult extends AttemptHistoryItem {
  reviewAvailable: boolean;
  questions: ResultQuestion[];
}
