import type { AttemptResponse, Question } from "@gyanam/shared";
import { AppError } from "../../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../../shared/errors/error-codes.js";
import { scoreAttempt } from "./scoring.js";
import { assembleDeterministicTest } from "./test-assembly.js";
import { seededShuffle } from "../../../utils/random.js";
import { resolveAdaptiveStrategy } from "./adaptive/adaptive-selector.js";
import { buildMentorFeedback } from "./mentor-feedback.js";
import type {
  AttemptRepository,
  ConceptPerformanceOrchestrator,
  CreateTestSetInput,
  ErrorEngineStateProvider,
  EventRepository,
  MasteryOrchestrator,
  QuestionRepository,
  StartAttemptInput,
  SubmitAttemptInput,
  TestSetRepository,
} from "./types.js";

export type AssessmentServiceDeps = {
  questions: QuestionRepository;
  testSets: TestSetRepository;
  attempts: AttemptRepository;
  events: EventRepository;
  mastery?: MasteryOrchestrator;
  conceptPerformance?: ConceptPerformanceOrchestrator;
  errorEngine?: ErrorEngineStateProvider;
};

export class AssessmentService {
  public constructor(private readonly deps: AssessmentServiceDeps) {}

  private selectMixedDiagnosticQuestions(
    poolsBySubject: Map<string, (Question & { correctIndex: number })[]>,
    seed: number,
    totalCount: number,
  ): (Question & { correctIndex: number })[] {
    const selected: (Question & { correctIndex: number })[] = [];
    const used = new Set<string>();
    const perSubject = Math.max(1, Math.floor(totalCount / Math.max(1, poolsBySubject.size)));

    const subjectIds = [...poolsBySubject.keys()].sort((a, b) => a.localeCompare(b));
    for (const [subjectIndex, subjectId] of subjectIds.entries()) {
      const pool = poolsBySubject.get(subjectId) ?? [];
      const easy = seededShuffle(pool.filter((question) => question.difficulty === "easy"), seed + subjectIndex * 31 + 1);
      const medium = seededShuffle(pool.filter((question) => question.difficulty === "medium"), seed + subjectIndex * 31 + 3);
      const hard = seededShuffle(pool.filter((question) => question.difficulty === "hard"), seed + subjectIndex * 31 + 5);

      const targetEasy = Math.min(1, perSubject);
      const targetMedium = Math.min(2, Math.max(0, perSubject - targetEasy));
      const targetHard = Math.min(1, Math.max(0, perSubject - targetEasy - targetMedium));

      const subjectPick: (Question & { correctIndex: number })[] = [];
      subjectPick.push(...easy.slice(0, targetEasy));
      subjectPick.push(...medium.slice(0, targetMedium));
      subjectPick.push(...hard.slice(0, targetHard));

      if (subjectPick.length < perSubject) {
        const leftovers = seededShuffle(
          [...easy.slice(targetEasy), ...medium.slice(targetMedium), ...hard.slice(targetHard)],
          seed + subjectIndex * 31 + 11,
        );
        subjectPick.push(...leftovers.slice(0, perSubject - subjectPick.length));
      }

      for (const question of subjectPick) {
        if (!used.has(question.id)) {
          used.add(question.id);
          selected.push(question);
        }
      }
    }

    if (selected.length < totalCount) {
      const leftovers = seededShuffle(
        [...poolsBySubject.values()].flat().filter((question) => !used.has(question.id)),
        seed + 101,
      );
      selected.push(...leftovers.slice(0, totalCount - selected.length));
    }

    return seededShuffle(selected, seed + 151).slice(0, totalCount);
  }

  public async startDiagnosticAttempt(input: {
    userId: string;
    questionCount: number;
    seed?: number;
    startedAt?: Date;
    requestId?: string;
  }): Promise<{ attemptId: string; startedAt: string; testSetId: string; questions: Question[] }> {
    const subjectId = await this.deps.questions.findDiagnosticSubjectId();
    if (!subjectId) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "No questions available for diagnostic.", 400);
    }

    const assembled = await this.createTestSet({
      subjectId,
      mode: "practice",
      seed: input.seed ?? Math.floor(Date.now() % 2147483647),
      questionCount: input.questionCount,
      userId: input.userId,
      requestId: input.requestId,
    });

    const started = await this.startAttempt({
      userId: input.userId,
      testId: assembled.testSetId,
      startedAt: input.startedAt,
      requestId: input.requestId,
    });

    return {
      attemptId: started.attemptId,
      startedAt: started.startedAt,
      testSetId: assembled.testSetId,
      questions: assembled.questions,
    };
  }

  public async startMixedDiagnosticAttempt(input: {
    userId: string;
    questionCount: number;
    seed?: number;
    startedAt?: Date;
    requestId?: string;
  }): Promise<{ attemptId: string; startedAt: string; testSetId: string; questions: Question[] }> {
    const subjectIds = await this.deps.questions.findDiagnosticSubjectIds(5);
    if (subjectIds.length === 0) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "No questions available for mixed diagnostic.", 400);
    }

    const pools = await Promise.all(subjectIds.map(async (subjectId) => ({
      subjectId,
      questions: await this.deps.questions.findBySubject(subjectId),
    })));

    const poolsBySubject = new Map<string, (Question & { correctIndex: number })[]>(
      pools.map((entry) => [entry.subjectId, entry.questions]),
    );
    const seed = input.seed ?? Math.floor(Date.now() % 2147483647);
    const selected = this.selectMixedDiagnosticQuestions(poolsBySubject, seed, input.questionCount);

    if (selected.length === 0) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "No questions available for mixed diagnostic.", 400);
    }

    const anchorSubjectId = subjectIds[0] ?? subjectIds.at(0);
    if (!anchorSubjectId) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "No subjects available for mixed diagnostic.", 400);
    }
    const created = await this.deps.testSets.create({
      subjectId: anchorSubjectId,
      mode: "practice",
      seed,
      questionIds: selected.map((question) => question.id),
      questionCount: selected.length,
      createdBy: input.userId,
    });

    await this.deps.questions.incrementExposure(selected.map((question) => question.id));
    await this.deps.events.log("test_created", {
      requestId: input.requestId,
      userId: input.userId,
      testId: created.id,
      subjectId: anchorSubjectId,
      mode: "practice",
      diagnosticType: "mixed",
      questionCount: selected.length,
      seed,
      subjectIds,
    });

    const started = await this.startAttempt({
      userId: input.userId,
      testId: created.id,
      startedAt: input.startedAt,
      requestId: input.requestId,
    });

    return {
      attemptId: started.attemptId,
      startedAt: started.startedAt,
      testSetId: created.id,
      questions: selected,
    };
  }

  public async getAttemptSession(input: { userId: string; attemptId: string }): Promise<{ attemptId: string; testSetId: string; questions: Question[] }> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (!attempt || attempt.userId !== input.userId) {
      throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid attempt access.", 401);
    }

    const questions = await this.deps.testSets.findQuestionsForTest(attempt.testId);
    return {
      attemptId: attempt.id,
      testSetId: attempt.testId,
      questions,
    };
  }

  public async evaluateAttemptAnswer(input: {
    userId: string;
    attemptId: string;
    questionId: string;
    selectedIndex: number | null;
  }): Promise<{ isCorrect: boolean; topicId: string }> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (!attempt || attempt.userId !== input.userId) {
      throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid attempt access.", 401);
    }

    const questions = await this.deps.testSets.findQuestionsForTest(attempt.testId);
    const question = questions.find((item) => item.id === input.questionId);
    if (!question) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid question for attempt.", 400);
    }

    return {
      isCorrect: input.selectedIndex !== null && input.selectedIndex === question.correctIndex,
      topicId: question.topicId,
    };
  }

  public async createTestSet(input: CreateTestSetInput): Promise<{
    testSetId: string;
    questions: Question[];
    adaptiveDebug?: {
      systemAction: "increase_difficulty" | "maintain_level" | "focus_revision" | "trigger_recovery" | null;
      userState: string | null;
      previousUserState: string | null;
      stateHistory: string[];
      transitionType: "improving" | "declining" | "stable" | null;
      strategy: ReturnType<typeof resolveAdaptiveStrategy>;
    };
  }> {
    const questionPool = await this.deps.questions.findBySubject(input.subjectId);
    if (questionPool.length === 0) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "No questions available for subject.", 400);
    }

    const derivedState = input.userId && this.deps.errorEngine
      ? await this.deps.errorEngine.getLatestUserState(input.userId)
      : null;
    const backendAction = derivedState?.systemAction ?? null;
    const allowOverride = process.env.NODE_ENV !== "production";
    const hasClientOverride = input.systemAction !== undefined;
    // systemAction is derived from backend (error-engine) as source of truth.
    // Client-provided systemAction is allowed ONLY in non-production environments
    // for debugging and simulation purposes.
    // In production, all adaptive behavior must originate from user state.
    const systemAction = allowOverride && hasClientOverride ? input.systemAction ?? null : backendAction;
    if (allowOverride && hasClientOverride && input.systemAction !== backendAction) {
      await this.deps.events.log("override_used", {
        requestId: input.requestId,
        userId: input.userId,
        client: input.systemAction,
        backend: backendAction,
      });
    }
    const weakAreas = systemAction === "focus_revision" && input.userId && this.deps.errorEngine
      ? await this.deps.errorEngine.getWeakAreas(input.userId, 3)
      : undefined;
    const strategy = resolveAdaptiveStrategy({
      systemAction,
      weakAreas,
    });
    const selected = assembleDeterministicTest(questionPool, input.mode, input.seed, input.questionCount, strategy);
    const created = await this.deps.testSets.create({
      subjectId: input.subjectId,
      mode: input.mode,
      seed: input.seed,
      questionIds: selected.map((question) => question.id),
      questionCount: selected.length,
      createdBy: input.userId,
    });

    await this.deps.questions.incrementExposure(selected.map((question) => question.id));
    await this.deps.events.log("test_created", {
      requestId: input.requestId,
      userId: input.userId,
      testId: created.id,
      subjectId: input.subjectId,
      mode: input.mode,
      questionCount: selected.length,
      seed: input.seed,
    });

    return {
      testSetId: created.id,
      questions: selected,
      adaptiveDebug: allowOverride
        ? {
            systemAction,
            userState: derivedState?.userState ?? null,
            previousUserState: derivedState?.previousUserState ?? null,
            stateHistory: derivedState?.stateHistory ?? [],
            transitionType: derivedState?.transitionType ?? null,
            strategy,
          }
        : undefined,
    };
  }

  public async startAttempt(input: StartAttemptInput): Promise<{ attemptId: string; startedAt: string }> {
    const testSet = await this.deps.testSets.findById(input.testId);
    if (!testSet) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid test id.", 400);
    }

    const startedAt = input.startedAt ?? new Date();
    const attempt = await this.deps.attempts.create({
      userId: input.userId,
      testId: input.testId,
      startedAt,
    });

    await this.deps.events.log("attempt_started", {
      requestId: input.requestId,
      userId: input.userId,
      testId: input.testId,
      subjectId: testSet.subjectId,
      mode: testSet.mode,
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
    });

    return { attemptId: attempt.id, startedAt: attempt.startedAt };
  }

  public async submitAttempt(input: SubmitAttemptInput): Promise<{
    rawScore: number;
    maxScore: number;
    durationSeconds: number;
    totalQuestions: number;
    attemptedCount: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    mentorFeedback?: {
      headline: string;
      message: string;
      mode: "challenge" | "stabilize" | "revision" | "recovery";
      focus?: Array<{ topicId: string; topicLabel?: string; errorType: string | null }>;
      nextAction?: string;
    };
  }> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (!attempt) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid attempt id.", 400);
    }
    if (input.userId && attempt.userId !== input.userId) {
      throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid attempt access.", 401);
    }

    const testSet = await this.deps.testSets.findById(attempt.testId);
    if (!testSet) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid test id.", 400);
    }

    const questions = await this.deps.testSets.findQuestionsForTest(attempt.testId);
    const result = scoreAttempt(questions, input.responses);

    const completedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((completedAt.getTime() - attempt.startedAtDate.getTime()) / 1000));

    await this.deps.attempts.saveResponses(input.attemptId, input.responses);
    await this.deps.attempts.completeAttempt({
      attemptId: input.attemptId,
      completedAt,
      durationSeconds,
      totalQuestions: result.totalQuestions,
      attemptedCount: result.attemptedCount,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      skippedCount: result.skippedCount,
      rawScore: result.rawScore,
      pauseEvents: input.pauseEvents,
    });

    await this.deps.events.log("attempt_submitted", {
      requestId: input.requestId,
      userId: attempt.userId,
      testId: attempt.testId,
      subjectId: testSet.subjectId,
      mode: testSet.mode,
      attemptId: input.attemptId,
      durationSeconds,
      totalQuestions: result.totalQuestions,
      attemptedCount: result.attemptedCount,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      skippedCount: result.skippedCount,
      totalScore: result.rawScore,
      rawScore: result.rawScore,
      maxScore: result.maxScore,
    });
    try {
      await this.deps.conceptPerformance?.updateForAttempt(attempt.userId, input.attemptId);
    } catch {
      // Concept aggregation is best-effort and should not block attempt submission.
    }
    try {
      await this.deps.mastery?.recomputeForUser(attempt.userId, "attempt_submission", {
        computedAt: completedAt,
        sourceAttemptId: input.attemptId,
      });
    } catch {
      // Mastery recompute is best-effort and should not block attempt submission.
    }

    const derivedState = this.deps.errorEngine
      ? await this.deps.errorEngine.getLatestUserState(attempt.userId)
      : null;
    const weakAreas = derivedState && this.deps.errorEngine
      ? await this.deps.errorEngine.getWeakAreas(attempt.userId, 3)
      : [];
    const topicLabels = weakAreas.length > 0 && this.deps.questions
      ? await this.deps.questions.getTopicLabels(weakAreas.map((area) => area.topicId))
      : {};
    const mentorFeedback = derivedState
      ? buildMentorFeedback({
          state: derivedState,
          weakAreas: weakAreas.map((area) => ({
            topicId: area.topicId,
            topicLabel: topicLabels[area.topicId] ?? area.topicId,
            errorType: area.errorType,
          })),
        })
      : undefined;

    return {
      rawScore: result.rawScore,
      maxScore: result.maxScore,
      durationSeconds,
      totalQuestions: result.totalQuestions,
      attemptedCount: result.attemptedCount,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      skippedCount: result.skippedCount,
      mentorFeedback,
    };
  }
}
