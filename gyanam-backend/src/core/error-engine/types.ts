export type ErrorSeverity = "low" | "medium" | "high" | "very_high";

export type ErrorNode = {
  weight: number;
  cluster: string;
  severity: ErrorSeverity;
  description?: string;
};

export type ErrorEdge = {
  weight: number;
  type?: string;
};

export type ErrorGraph = {
  meta?: Record<string, unknown>;
  nodes: Record<string, ErrorNode>;
  edges: Record<string, Record<string, ErrorEdge>>;
};

export type ErrorAttemptInput = {
  userId: string;
  questionId: string;
  attemptId?: string;
  isCorrect: boolean;
  errorType?: string;
};

export type UserErrorState = {
  userId: string;
  recentErrors: string[];
  errorCounts: Record<string, number>;
  lastUpdated: Date;
};

export type UserState = "stable" | "learning" | "unstable" | "recovering";
export type TransitionType = "improving" | "declining" | "stable";

export type ErrorEngineResult = {
  diagnosis: string | null;
  severity: ErrorSeverity | null;
  nextLikelyError: string | null;
  recommendation: string | null;
  dominantError?: string | null;
  message?: string | null;
  nextFocus?: string | null;
  confidenceScore?: number | null;
  trend?: "improving" | "declining" | "flat" | null;
  confidenceBand?: "low" | "medium" | "high" | null;
  systemAction?: "increase_difficulty" | "maintain_level" | "focus_revision" | "trigger_recovery" | null;
  userState?: UserState | null;
};

export type ErrorEngineUserState = {
  systemAction: "increase_difficulty" | "maintain_level" | "focus_revision" | "trigger_recovery" | null;
  userState: UserState | null;
  confidenceScore: number | null;
  trend: "improving" | "declining" | "flat" | null;
  confidenceBand: "low" | "medium" | "high" | null;
  previousUserState?: UserState | null;
  stateHistory?: UserState[];
  transitionType?: TransitionType | null;
};

export type WeakArea = {
  topicId: string;
  errorType: string | null;
  frequency: number;
  lastSeen: string;
};

export interface ErrorEngineRepository {
  getUserErrorState(userId: string): Promise<UserErrorState | null>;
  upsertUserErrorState(state: UserErrorState): Promise<void>;
  logAttempt(input: ErrorAttemptInput): Promise<void>;
  getRecentAttempts(userId: string, limit: number): Promise<Array<{ isCorrect: boolean; errorType: string | null; createdAt: Date }>>;
  getRecentErrorAttemptsWithTopic(
    userId: string,
    limit: number,
  ): Promise<Array<{ errorType: string | null; topicId: string | null; createdAt: Date }>>;
}
