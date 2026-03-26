import type { AttemptResponse, Difficulty, Question, TestAttempt, TestSet } from "@gyanam/shared";
import type { ErrorEngineUserState } from "../../error-engine/index.js";

export type ScoreableQuestion = Question & { correctIndex: number };

export type AssessmentMode = "practice" | "exam";

export type CreateTestSetInput = {
  subjectId: string;
  mode: AssessmentMode;
  seed: number;
  questionCount: number;
  systemAction?: "increase_difficulty" | "maintain_level" | "focus_revision" | "trigger_recovery" | null;
  userId?: string;
  requestId?: string;
};

export type StartAttemptInput = {
  userId: string;
  testId: string;
  startedAt?: Date;
  requestId?: string;
};

export type SubmitAttemptInput = {
  attemptId: string;
  responses: AttemptResponse[];
  userId?: string;
  pauseEvents?: unknown;
  requestId?: string;
};

export type PersistedAttempt = TestAttempt & {
  startedAtDate: Date;
};

export interface MasteryOrchestrator {
  recomputeForUser(
    userId: string,
    recomputeReason?: "attempt_submission" | "manual_recompute" | "model_update",
    context?: {
      computedAt?: Date;
      sourceAttemptId?: string;
    },
  ): Promise<unknown>;
}

export interface ConceptPerformanceOrchestrator {
  updateForAttempt(userId: string, attemptId: string): Promise<void>;
}

export type TestSetRecord = TestSet & {
  createdAt: string;
  seed: number;
  questionCount: number;
};

type EventName = "test_created" | "attempt_started" | "attempt_submitted" | "override_used";

export interface QuestionRepository {
  findBySubject(subjectId: string): Promise<ScoreableQuestion[]>;
  findDiagnosticSubjectId(): Promise<string | null>;
  findDiagnosticSubjectIds(limit: number): Promise<string[]>;
  incrementExposure(questionIds: string[]): Promise<void>;
  getTopicLabels(topicIds: string[]): Promise<Record<string, string>>;
}

export interface TestSetRepository {
  create(input: {
    subjectId: string;
    mode: AssessmentMode;
    seed: number;
    questionIds: string[];
    questionCount: number;
    createdBy?: string;
  }): Promise<TestSetRecord>;
  findById(testId: string): Promise<TestSetRecord | null>;
  findQuestionsForTest(testId: string): Promise<ScoreableQuestion[]>;
}

export interface AttemptRepository {
  create(input: { userId: string; testId: string; startedAt: Date }): Promise<PersistedAttempt>;
  findById(attemptId: string): Promise<PersistedAttempt | null>;
  saveResponses(attemptId: string, responses: AttemptResponse[]): Promise<void>;
  completeAttempt(input: {
    attemptId: string;
    completedAt: Date;
    durationSeconds: number;
    totalQuestions: number;
    attemptedCount: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    rawScore: number;
    pauseEvents?: unknown;
  }): Promise<PersistedAttempt>;
}

export interface EventRepository {
  log(eventName: EventName, payload: Record<string, unknown>): Promise<void>;
}

export interface ErrorEngineStateProvider {
  getLatestUserState(userId: string): Promise<ErrorEngineUserState | null>;
  getWeakAreas(userId: string, limit?: number): Promise<Array<{
    topicId: string;
    errorType: string | null;
    frequency: number;
    lastSeen: string;
  }>>;
}
