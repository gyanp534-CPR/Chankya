import { AppError } from "../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../shared/errors/error-codes.js";
import type {
  ErrorAttemptInput,
  ErrorEngineRepository,
  ErrorEngineResult,
  ErrorEngineUserState,
  ErrorGraph,
  TransitionType,
  UserState,
  WeakArea,
} from "./types.js";
import { pickNextLikelyError } from "./error-graph.js";
import {
  computeConfidenceBand,
  computeConfidenceSignals,
  computeSystemAction,
  computeTrend,
  computeUserState,
  CONFIDENCE_RECENT_WINDOW,
} from "./logic/index.js";

const RECENT_ERRORS_MAX = 5;
const WEAK_AREA_WINDOW = 50;
const STATE_HISTORY_MAX = 5;

const RECOMMENDATIONS: Record<string, string> = {
  "Memory Gap": "Strengthen recall with short, spaced reviews and flashcards.",
  "Partial Knowledge Trap": "Tighten concept boundaries and practice elimination-heavy MCQs.",
  "Concept Confusion": "Rebuild the core concept first, then retry basic questions.",
  "Fact Misassociation": "Create comparison tables to separate similar facts and entities.",
  "Incomplete Inference": "Practice multi-step reasoning with brief written justifications.",
  Overgeneralization: "Look for scope limits and exceptions before locking an answer.",
  Misreading: "Slow down on stems and options; underline qualifiers and negatives.",
  "Equation Setup Error": "Focus on translating words to equations before solving.",
  "State Construction Failure": "Sketch the state/diagram first, then proceed to steps.",
  "Step Skipping": "Write each step explicitly to avoid hidden jumps.",
};

export type ErrorEngineServiceDeps = {
  repository: ErrorEngineRepository;
  graph: ErrorGraph;
};

export class ErrorEngineService {
  public constructor(private readonly deps: ErrorEngineServiceDeps) {}

  public async getLatestUserState(userId: string): Promise<ErrorEngineUserState | null> {
    const { repository } = this.deps;
    const recentAttempts = await repository.getRecentAttempts(userId, CONFIDENCE_RECENT_WINDOW);
    if (recentAttempts.length === 0) {
      return null;
    }

    const confidenceSignals = computeConfidenceSignals(recentAttempts);
    const confidenceScore = confidenceSignals?.score ?? null;
    const trend = computeTrend(recentAttempts);
    const confidenceBand = computeConfidenceBand(confidenceSignals, recentAttempts.length);

    const currentState = await repository.getUserErrorState(userId);
    const recentErrors = currentState?.recentErrors ?? [];
    const lastError = recentErrors[recentErrors.length - 1] ?? null;
    const dominantError = lastError ? this.getDominantError(recentErrors, lastError) : null;

    const userState = computeUserState(confidenceScore, trend, dominantError);
    const systemAction = computeSystemAction(confidenceBand, confidenceScore, trend, dominantError, userState);
    const previousUserState = this.computePreviousUserState(recentAttempts, recentErrors);
    const stateHistory = this.computeStateHistory(recentAttempts);
    const transitionType = this.computeTransitionType(previousUserState, userState);

    return {
      systemAction,
      userState,
      confidenceScore,
      trend,
      confidenceBand,
      previousUserState,
      stateHistory,
      transitionType,
    };
  }

  public async recordAttempt(input: ErrorAttemptInput): Promise<ErrorEngineResult> {
    const { graph, repository } = this.deps;

    if (!input.isCorrect && !input.errorType) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Error type is required for incorrect attempts.", 400);
    }

    if (input.errorType && !graph.nodes[input.errorType]) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Unknown error type.", 400, {
        errorType: input.errorType,
      });
    }

    await repository.logAttempt({
      ...input,
      errorType: input.isCorrect ? undefined : input.errorType,
    });

    const now = new Date();
    const currentState = (await repository.getUserErrorState(input.userId)) ?? {
      userId: input.userId,
      recentErrors: [],
      errorCounts: {},
      lastUpdated: now,
    };

    const updatedState = this.applyStateUpdate(currentState, input, now);
    await repository.upsertUserErrorState(updatedState);

    const recentAttempts = await repository.getRecentAttempts(input.userId, CONFIDENCE_RECENT_WINDOW);
    const confidenceSignals = computeConfidenceSignals(recentAttempts);
    const confidenceScore = confidenceSignals?.score ?? null;
    const trend = computeTrend(recentAttempts);
    const confidenceBand = computeConfidenceBand(confidenceSignals, recentAttempts.length);

    const lastError = updatedState.recentErrors[updatedState.recentErrors.length - 1] ?? null;
    if (input.isCorrect) {
      const dominantError = null;
      const userState = computeUserState(confidenceScore, trend, dominantError);
      const systemAction = computeSystemAction(confidenceBand, confidenceScore, trend, dominantError, userState);
      return {
        diagnosis: null,
        severity: null,
        nextLikelyError: null,
        recommendation: null,
        dominantError: null,
        message: "Good accuracy. Maintain consistency.",
        nextFocus: "Increase difficulty",
        confidenceScore,
        trend,
        confidenceBand,
        systemAction,
        userState,
      };
    }

    if (!lastError) {
      const dominantError = null;
      const userState = computeUserState(confidenceScore, trend, dominantError);
      const systemAction = computeSystemAction(confidenceBand, confidenceScore, trend, dominantError, userState);
      return {
        diagnosis: null,
        severity: null,
        nextLikelyError: null,
        recommendation: null,
        dominantError: null,
        confidenceScore,
        trend,
        confidenceBand,
        systemAction,
        userState,
      };
    }

    const severity = graph.nodes[lastError]?.severity ?? null;
    const nextLikelyError = pickNextLikelyError(graph, lastError);
    const dominantError = this.getDominantError(updatedState.recentErrors, lastError);
    const diagnosis = this.buildDiagnosis(dominantError, lastError);
    const recommendation = this.buildRecommendation(lastError, nextLikelyError, severity, dominantError);
    const userState = computeUserState(confidenceScore, trend, dominantError);
    const systemAction = computeSystemAction(confidenceBand, confidenceScore, trend, dominantError, userState);

    return {
      diagnosis,
      severity,
      nextLikelyError,
      recommendation,
      dominantError,
      message: null,
      nextFocus: null,
      confidenceScore,
      trend,
      confidenceBand,
      systemAction,
      userState,
    };
  }

  private applyStateUpdate(state: { userId: string; recentErrors: string[]; errorCounts: Record<string, number>; lastUpdated: Date }, input: ErrorAttemptInput, now: Date) {
    const recentErrors = [...state.recentErrors];
    const errorCounts = { ...state.errorCounts };

    if (!input.isCorrect && input.errorType) {
      recentErrors.push(input.errorType);
      if (recentErrors.length > RECENT_ERRORS_MAX) {
        recentErrors.splice(0, recentErrors.length - RECENT_ERRORS_MAX);
      }

      errorCounts[input.errorType] = (errorCounts[input.errorType] ?? 0) + 1;
    }

    return {
      userId: state.userId,
      recentErrors,
      errorCounts,
      lastUpdated: now,
    };
  }

  private getDominantError(recentErrors: string[], lastError: string): string | null {
    if (recentErrors.length < 3) {
      return null;
    }
    const lastThree = recentErrors.slice(-3);
    const isDominant = lastThree.every((error) => error === lastError);
    return isDominant ? lastError : null;
  }

  private buildDiagnosis(dominantError: string | null, lastError: string): string {
    if (dominantError) {
      return `You are repeatedly falling into ${dominantError}.`;
    }
    return `Your last error was ${lastError}.`;
  }

  private buildRecommendation(
    lastError: string,
    nextLikelyError: string | null,
    severity: string | null,
    dominantError: string | null,
  ): string {
    if (lastError === "Partial Knowledge Trap" && nextLikelyError === "Overgeneralization") {
      return "Focus on boundary-based elimination questions to reduce overreach.";
    }

    if (dominantError) {
      return `Pause and fix ${dominantError} first before increasing difficulty.`;
    }

    if (severity === "very_high") {
      return "Rebuild the core concept and retry with easier questions.";
    }

    return RECOMMENDATIONS[lastError] ?? "Review the core concept and retry similar questions.";
  }

  private computePreviousUserState(
    recentAttempts: Array<{ isCorrect: boolean; errorType: string | null; createdAt: Date }>,
    recentErrors: string[],
  ): UserState | null {
    if (recentAttempts.length <= 1) {
      return null;
    }

    const previousAttempts = recentAttempts.slice(0, -1);
    const previousSignals = computeConfidenceSignals(previousAttempts);
    const previousScore = previousSignals?.score ?? null;
    const previousTrend = computeTrend(previousAttempts);
    const previousErrors = recentErrors.slice(0, -1);
    const previousLastError = previousErrors[previousErrors.length - 1] ?? null;
    const previousDominant = previousLastError ? this.getDominantError(previousErrors, previousLastError) : null;

    return computeUserState(previousScore, previousTrend, previousDominant);
  }

  private computeStateHistory(
    recentAttempts: Array<{ isCorrect: boolean; errorType: string | null; createdAt: Date }>,
  ): UserState[] {
    if (recentAttempts.length === 0) {
      return [];
    }

    const states: Array<UserState | null> = [];
    const errorWindow: string[] = [];

    for (let index = 0; index < recentAttempts.length; index += 1) {
      const attempt = recentAttempts[index];
      if (!attempt) {
        continue;
      }
      if (!attempt.isCorrect && attempt.errorType) {
        errorWindow.push(attempt.errorType);
        if (errorWindow.length > RECENT_ERRORS_MAX) {
          errorWindow.splice(0, errorWindow.length - RECENT_ERRORS_MAX);
        }
      }

      const slice = recentAttempts.slice(0, index + 1);
      const signals = computeConfidenceSignals(slice);
      const score = signals?.score ?? null;
      const trend = computeTrend(slice);
      const lastError = errorWindow[errorWindow.length - 1] ?? null;
      const dominant = lastError ? this.getDominantError(errorWindow, lastError) : null;

      states.push(computeUserState(score, trend, dominant));
    }

    return states.filter((state): state is UserState => state !== null).slice(-STATE_HISTORY_MAX);
  }

  private computeTransitionType(previousUserState: UserState | null, userState: UserState | null): TransitionType | null {
    if (!previousUserState || !userState) {
      return null;
    }
    if (previousUserState === userState) {
      return "stable";
    }

    const rank = (state: UserState): number => {
      switch (state) {
        case "unstable":
          return 0;
        case "recovering":
          return 1;
        case "learning":
          return 2;
        case "stable":
          return 3;
        default:
          return 0;
      }
    };

    return rank(userState) > rank(previousUserState) ? "improving" : "declining";
  }

  public async getWeakAreas(userId: string, limit: number = 3): Promise<WeakArea[]> {
    const { repository } = this.deps;
    const recentErrors = await repository.getRecentErrorAttemptsWithTopic(userId, WEAK_AREA_WINDOW);
    if (recentErrors.length === 0) {
      return [];
    }

    const buckets = new Map<string, { topicId: string; errorType: string | null; frequency: number; lastSeen: Date }>();
    for (const entry of recentErrors) {
      if (!entry.topicId) {
        continue;
      }
      const key = `${entry.topicId}::${entry.errorType ?? "unknown"}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.frequency += 1;
        if (entry.createdAt > existing.lastSeen) {
          existing.lastSeen = entry.createdAt;
        }
      } else {
        buckets.set(key, {
          topicId: entry.topicId,
          errorType: entry.errorType ?? null,
          frequency: 1,
          lastSeen: entry.createdAt,
        });
      }
    }

    return [...buckets.values()]
      .sort((a, b) => {
        if (b.frequency !== a.frequency) {
          return b.frequency - a.frequency;
        }
        return b.lastSeen.getTime() - a.lastSeen.getTime();
      })
      .slice(0, Math.max(1, limit))
      .map((entry) => ({
        topicId: entry.topicId,
        errorType: entry.errorType,
        frequency: entry.frequency,
        lastSeen: entry.lastSeen.toISOString(),
      }));
  }

}
