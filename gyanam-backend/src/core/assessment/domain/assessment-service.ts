import type { AttemptResponse, Question } from "@gyanam/shared";
import { AppError } from "../../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../../shared/errors/error-codes.js";
import { scoreAttempt } from "./scoring.js";
import { assembleDeterministicTest } from "./test-assembly.js";
import { seededShuffle } from "../../../utils/random.js";
import { resolveAdaptiveStrategy } from "./adaptive/adaptive-selector.js";
import { buildMentorFeedback } from "./mentor-feedback.js";
import { getConceptsForTopicLabel } from "./concept-map.js";
import { buildAttemptFeedback, type QuestionExplanation } from "./attempt-feedback.js";
import { getDailyFocus } from "../../mentor-engine/index.js";
import {
  runMentorEngine,
  type ErrorSignal,
  type ModeExplanation,
  type NextAction,
  type PracticeMode,
  type UserErrorState,
  trapReadable,
  trapToStrategy,
} from "../../mentor-engine/index.js";
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

const MENTOR_ENGINE_ENABLED = process.env.MENTOR_ENGINE_ENABLED !== "false";

function mapUserStateToMode(state: "stable" | "learning" | "unstable" | "recovering" | null | undefined): PracticeMode | null {
  switch (state) {
    case "recovering":
      return "recovery";
    case "stable":
      return "stabilize";
    case "learning":
      return "revision";
    case "unstable":
      return "recovery";
    default:
      return null;
  }
}

function mapErrorTypeToSignal(errorType: string | null): ErrorSignal["type"] {
  if (!errorType) {
    return "concept";
  }
  const lowered = errorType.toLowerCase();
  if (lowered.includes("misread")) {
    return "misreading";
  }
  if (lowered.includes("calculation") || lowered.includes("equation") || lowered.includes("arithmetic")) {
    return "calculation";
  }
  if (lowered.includes("time")) {
    return "time-pressure";
  }
  return "concept";
}

function buildBasicPostAttempt(params: {
  headline?: string;
  message?: string;
  focus: string[];
  mode?: PracticeMode;
  accuracy: number;
  trend: "up" | "down" | "flat";
}): {
  headline: string;
  message: string;
  focus: string[];
  nextAction: NextAction;
  mode: PracticeMode;
  explanation: ModeExplanation;
} {
  const mode = params.mode ?? "revision";
  return {
    headline: params.headline ?? "Attempt complete",
    message: params.message ?? "Review your weak areas and keep going.",
    focus: params.focus,
    nextAction: {
      label: "Revise weak topics",
      actionType: "practice",
    },
    mode,
    explanation: {
      reason: "Deterministic baseline feedback",
      signals: {
        accuracy: params.accuracy,
        weakTopics: params.focus.length,
        trend: params.trend,
      },
    },
  };
}

export class AssessmentService {
  public constructor(private readonly deps: AssessmentServiceDeps) {}

  private buildLearningPathLabel(params: {
    trapType?: string | null;
    topic: string;
    conceptName?: string | null;
  }): string {
    const target = params.conceptName
      ? `${params.conceptName} (${params.topic})`
      : params.topic;
    if (params.trapType) {
      const trap = trapReadable(params.trapType as any);
      const variants = [
        `Focus on ${trap} mistakes in ${target}`,
        `Work on avoiding ${trap} mistakes in ${target}`,
        `Practice identifying ${trap} cues in ${target}`,
      ];
      return variants[Math.floor(Math.random() * variants.length)] ?? variants[0]!;
    }
    return `Focus on ${target}`;
  }

  private buildLearningPathAction(params: {
    item: Awaited<ReturnType<typeof getDailyFocus>>[number];
    conceptName?: string | null;
  }): NextAction {
    const { item, conceptName } = params;
    return {
      label: this.buildLearningPathLabel({
        trapType: item.trapType,
        topic: item.topic,
        conceptName,
      }),
      actionType: item.priority === "urgent" ? "revise" : "practice",
      topic: item.topic,
      concept: conceptName ?? undefined,
      conceptId: item.conceptId,
      trapType: item.trapType ?? undefined,
      strategy: item.trapType ? trapToStrategy(item.trapType) : undefined,
      severity: item.priority === "urgent" ? "high" : "medium",
    };
  }

  private async fetchLearningPathItems(userId: string) {
    const derivedState = this.deps.errorEngine
      ? await this.deps.errorEngine.getLatestUserState(userId)
      : null;
    const items = this.deps.errorEngine
      ? await getDailyFocus({
          userId,
          repository: this.deps.errorEngine,
          trend: derivedState?.trend ?? null,
          confidenceBand: derivedState?.confidenceBand ?? null,
        })
      : [];

    const conceptIds = items.map((item) => item.conceptId).filter((id): id is string => Boolean(id));
    const conceptNameMap = conceptIds.length > 0
      ? await this.deps.questions.getConceptNamesById(conceptIds)
      : {};

    const enriched = items.map((item) => {
      const conceptName = item.conceptId ? conceptNameMap[item.conceptId]?.name : undefined;
      return {
        ...item,
        concept: conceptName ?? undefined,
        nextAction: this.buildLearningPathAction({ item, conceptName }),
      };
    });

    return {
      items: enriched,
      derivedState,
    };
  }

  public async getLearningPath(userId: string) {
    const { items } = await this.fetchLearningPathItems(userId);
    const missingConceptIds = items.filter((item) => !item.conceptId && item.key !== "mixed_revision");
    await this.deps.events.log("learning_path_generated", {
      userId,
      items: items.map((item) => ({
        key: item.key,
        priority: item.priority,
        strength: item.strength ?? null,
        lastSeenAt: item.lastSeenAt ?? null,
      })),
      missingConceptIds: missingConceptIds.map((item) => item.key),
    });
    return items;
  }

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

  public async startLearningPathAttempt(input: {
    userId: string;
    focusKey?: string | null;
    questionCount?: number;
    seed?: number;
    startedAt?: Date;
    requestId?: string;
  }): Promise<{ attemptId: string; startedAt: string; testSetId: string; focusKey: string }> {
    if (!this.deps.errorEngine) {
      throw new AppError(
        ERROR_CODES.internalServerError,
        "Learning path is unavailable without the error engine configured.",
        500,
      );
    }

    const { items } = await this.fetchLearningPathItems(input.userId);
    const focus = input.focusKey
      ? items.find((item) => item.key === input.focusKey)
      : items[0];
    const questionCount = Math.max(5, input.questionCount ?? 10);

    if (!focus || focus.key === "mixed_revision") {
      const fallback = await this.startMixedDiagnosticAttempt({
        userId: input.userId,
        questionCount,
        seed: input.seed,
        startedAt: input.startedAt,
        requestId: input.requestId,
      });
      await this.deps.events.log("learning_path_clicked", {
        userId: input.userId,
        focusKey: focus?.key ?? "mixed_revision",
        priority: focus?.priority ?? "reinforce",
      });
      return {
        attemptId: fallback.attemptId,
        startedAt: fallback.startedAt,
        testSetId: fallback.testSetId,
        focusKey: focus?.key ?? "mixed_revision",
      };
    }

    const seed = input.seed ?? Math.floor(Date.now() % 2147483647);
    const limit = Math.max(questionCount * 3, questionCount);
    let candidates = await this.deps.questions.findByFocus({
      conceptId: focus.conceptId,
      trapType: focus.trapType ?? undefined,
      limit,
    });
    if (candidates.length === 0 && focus.conceptId) {
      candidates = await this.deps.questions.findByFocus({
        conceptId: focus.conceptId,
        limit,
      });
    }
    if (candidates.length === 0 && focus.trapType) {
      candidates = await this.deps.questions.findByFocus({
        trapType: focus.trapType,
        limit,
      });
    }

    if (candidates.length === 0) {
      const fallback = await this.startMixedDiagnosticAttempt({
        userId: input.userId,
        questionCount,
        seed,
        startedAt: input.startedAt,
        requestId: input.requestId,
      });
      await this.deps.events.log("learning_path_clicked", {
        userId: input.userId,
        focusKey: focus.key,
        priority: focus.priority,
        conceptId: focus.conceptId ?? null,
        trapType: focus.trapType ?? null,
      });
      return {
        attemptId: fallback.attemptId,
        startedAt: fallback.startedAt,
        testSetId: fallback.testSetId,
        focusKey: focus.key,
      };
    }

    const selected = seededShuffle(candidates, seed).slice(0, questionCount);
    const subjectId = selected[0]?.subjectId ?? (await this.deps.questions.findDiagnosticSubjectId());
    if (!subjectId) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "No subject available for learning path.", 400);
    }

    const created = await this.deps.testSets.create({
      subjectId,
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
      subjectId,
      mode: "practice",
      questionCount: selected.length,
      seed,
      focusKey: focus.key,
      conceptId: focus.conceptId ?? null,
      trapType: focus.trapType ?? null,
    });

    const started = await this.startAttempt({
      userId: input.userId,
      testId: created.id,
      startedAt: input.startedAt,
      requestId: input.requestId,
    });

    await this.deps.events.log("learning_path_clicked", {
      userId: input.userId,
      focusKey: focus.key,
      priority: focus.priority,
      conceptId: focus.conceptId ?? null,
      trapType: focus.trapType ?? null,
    });

    return {
      attemptId: started.attemptId,
      startedAt: started.startedAt,
      testSetId: created.id,
      focusKey: focus.key,
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
  }): Promise<{ isCorrect: boolean; topicId: string; feedback?: ReturnType<typeof buildAttemptFeedback> }> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (!attempt || attempt.userId !== input.userId) {
      throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid attempt access.", 401);
    }

    const questions = await this.deps.testSets.findQuestionsForTest(attempt.testId);
    const question = questions.find((item) => item.id === input.questionId);
    if (!question) {
      throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid question for attempt.", 400);
    }

    const isCorrect = input.selectedIndex !== null && input.selectedIndex === question.correctIndex;
    const feedback = !isCorrect
      ? buildAttemptFeedback({
          options: question.options,
          selectedIndex: input.selectedIndex,
          correctIndex: question.correctIndex ?? null,
          explanation: (question as { explanation?: QuestionExplanation | null }).explanation ?? null,
          trapType: (question as { trapType?: string | null }).trapType as any,
        })
      : undefined;

    return {
      isCorrect,
      topicId: question.topicId,
      feedback,
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
    const topicLabels = weakAreas && weakAreas.length > 0 && this.deps.questions
      ? await this.deps.questions.getTopicLabels(weakAreas.map((area) => area.topicId))
      : {};
    const conceptHints = weakAreas
      ? weakAreas.flatMap((area) => getConceptsForTopicLabel(topicLabels[area.topicId] ?? ""))
      : [];
    const conceptLookup = conceptHints.length > 0
      ? await this.deps.questions.getConceptIdsByName([...new Set(conceptHints)])
      : {};
    const conceptIds = Object.values(conceptLookup).map((entry) => entry.id);
    const strategy = resolveAdaptiveStrategy({
      systemAction,
      weakAreas,
      conceptIds: conceptIds.length > 0 ? conceptIds : undefined,
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
    postAttempt?: {
      headline: string;
      message: string;
      focus: string[];
      nextAction: NextAction;
      mode: PracticeMode;
      explanation: ModeExplanation;
      mentorFeedback?: {
        focus: string[];
      };
    };
    userErrorState?: UserErrorState[];
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

    const normalizeTopicLabel = (topicId: string) => {
      const label = topicLabels[topicId];
      if (!label || label.toLowerCase().includes("unknown")) {
        return "General";
      }
      if (label.toLowerCase().includes("pyq ingested")) {
        return "General Aptitude";
      }
      return label;
    };
    const weakTopicLabels = weakAreas.map((area) => normalizeTopicLabel(area.topicId));
    const conceptHints = weakAreas.flatMap((area) => getConceptsForTopicLabel(normalizeTopicLabel(area.topicId)));
    const conceptLookup = conceptHints.length > 0
      ? await this.deps.questions.getConceptIdsByName([...new Set(conceptHints)])
      : {};
    const headline = mentorFeedback?.headline ?? "Attempt complete";
    const message = mentorFeedback?.message ?? "Review your weak areas and keep going.";
    const focus =
      mentorFeedback?.focus?.map((area) => area.topicLabel ?? area.topicId) ?? weakTopicLabels;
    const recentTrend =
      derivedState?.trend === "improving"
        ? "up"
        : derivedState?.trend === "declining"
          ? "down"
          : "flat";
    const accuracy = result.totalQuestions > 0 ? (result.correctCount / result.totalQuestions) * 100 : 0;

    if (!MENTOR_ENGINE_ENABLED) {
      const postAttempt = buildBasicPostAttempt({
        headline,
        message,
        focus,
        mode: mentorFeedback?.mode ?? "revision",
        accuracy,
        trend: recentTrend,
      });
      await this.deps.events.log("mentor_feedback_generated", {
        userId: attempt.userId,
        mode: postAttempt.mode,
        nextAction: postAttempt.nextAction.label,
        severity: postAttempt.nextAction.severity ?? null,
        patternDetected: postAttempt.explanation.pattern ?? null,
        topErrorKey: null,
        confidenceBand: derivedState?.confidenceBand ?? null,
      });
      if (input.focusKey) {
        await this.deps.events.log("question_attempted_from_focus", {
          userId: attempt.userId,
          focusKey: input.focusKey,
          attemptId: input.attemptId,
          correctCount: result.correctCount,
          incorrectCount: result.incorrectCount,
          accuracy,
        });
        await this.deps.events.log("improvement_after_focus", {
          userId: attempt.userId,
          focusKey: input.focusKey,
          accuracy,
          trend: derivedState?.trend ?? null,
          confidenceBand: derivedState?.confidenceBand ?? null,
        });
      }
      return {
        rawScore: result.rawScore,
        maxScore: result.maxScore,
        durationSeconds,
        totalQuestions: result.totalQuestions,
        attemptedCount: result.attemptedCount,
        correctCount: result.correctCount,
        incorrectCount: result.incorrectCount,
        skippedCount: result.skippedCount,
        postAttempt,
        mentorFeedback,
      };
    }

    if (!this.deps.errorEngine) {
      throw new AppError(
        ERROR_CODES.internalServerError,
        "Mentor engine is enabled but error engine is not configured.",
        500,
      );
    }

    const errorSignals: ErrorSignal[] = weakAreas.flatMap((area) => {
      const count = Math.min(area.frequency ?? 1, 3);
      const topic = normalizeTopicLabel(area.topicId);
      const concepts = getConceptsForTopicLabel(topic);
      const conceptName = concepts[0];
      const conceptId = conceptName ? conceptLookup[conceptName]?.id : undefined;
      return Array.from({ length: count }, () => ({
        type: mapErrorTypeToSignal(area.errorType),
        topic,
        conceptId,
        conceptName,
      }));
    });
    let prevMode = mapUserStateToMode(derivedState?.previousUserState);
    if (derivedState?.previousUserState === "unstable" && derivedState?.trend === "improving") {
      prevMode = "recovery";
    }
    const mentorResult = await runMentorEngine({
      userId: attempt.userId,
      metrics: {
        accuracy,
        correct: result.correctCount,
        incorrect: result.incorrectCount,
        total: result.totalQuestions,
        weakTopics: weakTopicLabels,
        errorCount: result.incorrectCount,
        recentTrend,
        confidenceBand: derivedState?.confidenceBand ?? null,
      },
      prevMode,
      errorSignals,
      repository: this.deps.errorEngine,
    });

    await this.deps.events.log("mentor_feedback_generated", {
      userId: attempt.userId,
      mode: mentorResult.mode,
      nextAction: mentorResult.nextAction.label,
      severity: mentorResult.nextAction.severity ?? null,
      patternDetected: mentorResult.explanation.pattern ?? null,
      topErrorKey: mentorResult.sessionErrors[0]?.key ?? null,
      confidenceBand: derivedState?.confidenceBand ?? null,
    });

    if (input.focusKey) {
      await this.deps.events.log("question_attempted_from_focus", {
        userId: attempt.userId,
        focusKey: input.focusKey,
        attemptId: input.attemptId,
        correctCount: result.correctCount,
        incorrectCount: result.incorrectCount,
        accuracy,
      });

      await this.deps.events.log("improvement_after_focus", {
        userId: attempt.userId,
        focusKey: input.focusKey,
        accuracy,
        trend: derivedState?.trend ?? null,
        confidenceBand: derivedState?.confidenceBand ?? null,
      });
    }

    return {
      rawScore: result.rawScore,
      maxScore: result.maxScore,
      durationSeconds,
      totalQuestions: result.totalQuestions,
      attemptedCount: result.attemptedCount,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      skippedCount: result.skippedCount,
      postAttempt: {
        headline,
        message,
        focus,
        nextAction: mentorResult.nextAction,
        mode: mentorResult.mode,
        explanation: mentorResult.explanation,
        mentorFeedback: {
          focus,
        },
      },
      userErrorState: mentorResult.userErrorState,
      mentorFeedback,
    };
  }
}
