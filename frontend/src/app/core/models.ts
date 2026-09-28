export type Role = 'User' | 'Administrator';
export interface LoginRequest {
  email: string;
  password: string;
}
export interface RegisterRequest extends LoginRequest {
  fullName: string;
}
export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
}
export interface Session {
  token: string;
  userId: string;
  fullName: string;
  email: string;
  roles: Role[];
  expires: number;
}
export interface PublicQuiz {
  quizId: number;
  title: string;
  description: string | null;
  duration: number;
  creatorName: string;
  questionCount: number;
  totalPoints: number;
  createdAt: string;
}
