export type Difficulty = "easy" | "medium" | "hard";

export interface Subject {
  id: string;
  name: string;
  order: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  weight: number;
}

export interface Question {
  id: string;
  topicId: string;
  stem: string;
  options: string[];
  difficulty: Difficulty;
  tags: string[];
}

export interface TestSet {
  id: string;
  subjectId: string;
  questionIds: string[];
  mode: "practice" | "exam";
}

export interface TestAttempt {
  id: string;
  userId: string;
  testId: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  totalQuestions?: number;
  attemptedCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  skippedCount?: number;
  rawScore?: number;
}

export interface AttemptResponse {
  questionId: string;
  selectedIndex: number | null;
  timeSpentSeconds: number;
}
