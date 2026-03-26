import type { AttemptResponse, Question } from "@gyanam/shared";
import { AssessmentService } from "../src/core/assessment/domain/assessment-service.js";
import { computeKnowledgeScore } from "../src/core/mastery/ks.js";
import type {
  AttemptRepository,
  EventRepository,
  PersistedAttempt,
  QuestionRepository,
  TestSetRecord,
  TestSetRepository,
} from "../src/core/assessment/domain/types.js";
import { MasteryService } from "../src/core/mastery/mastery-service.js";
import type {
  MasteryHistoryWrite,
  MasteryRepository,
  RevisionRepository,
  RevisionTaskRecord,
  TopicSignal,
  WeakAreaRepository,
} from "../src/core/mastery/types.js";

type InMemoryQuestion = Question & { correctIndex: number; subjectId: string };

type ArchetypeName =
  | "strong_calibrated"
  | "knowledgeable_reckless"
  | "under_attempter"
  | "inconsistent";

type ArchetypeConfig = {
  name: ArchetypeName;
  userId: string;
  attemptRatio: (attemptIndex: number) => number;
  accuracy: (attemptIndex: number) => number;
};

type StoredResponse = {
  attemptId: string;
  questionId: string;
  selectedIndex: number | null;
  answeredAt: Date;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

class SimulationStore {
  public readonly questions: InMemoryQuestion[];
  public readonly testSets = new Map<string, TestSetRecord>();
  public readonly questionsByTest = new Map<string, InMemoryQuestion[]>();
  public readonly attempts = new Map<string, PersistedAttempt>();
  public readonly responses = new Map<string, StoredResponse[]>();

  private testCounter = 0;
  private attemptCounter = 0;

  public constructor(questions: InMemoryQuestion[]) {
    this.questions = questions;
  }

  public nextTestId(): string {
    this.testCounter += 1;
    return `test-${this.testCounter}`;
  }

  public nextAttemptId(): string {
    this.attemptCounter += 1;
    return `attempt-${this.attemptCounter}`;
  }
}

class InMemoryQuestionRepository implements QuestionRepository {
  public constructor(private readonly store: SimulationStore) {}

  public async findBySubject(subjectId: string): Promise<InMemoryQuestion[]> {
    return this.store.questions.filter((question) => question.subjectId === subjectId);
  }

  public async incrementExposure(_questionIds: string[]): Promise<void> {}
}

class InMemoryTestSetRepository implements TestSetRepository {
  public constructor(private readonly store: SimulationStore) {}

  public async create(input: {
    subjectId: string;
    mode: "practice" | "exam";
    seed: number;
    questionIds: string[];
    questionCount: number;
    createdBy?: string;
  }): Promise<TestSetRecord> {
    const id = this.store.nextTestId();
    const record: TestSetRecord = {
      id,
      subjectId: input.subjectId,
      questionIds: input.questionIds,
      mode: input.mode,
      createdAt: new Date().toISOString(),
      seed: input.seed,
      questionCount: input.questionCount,
    };

    this.store.testSets.set(id, record);
    this.store.questionsByTest.set(
      id,
      input.questionIds
        .map((questionId) => this.store.questions.find((question) => question.id === questionId))
        .filter(Boolean) as InMemoryQuestion[],
    );
    return record;
  }

  public async findById(testId: string): Promise<TestSetRecord | null> {
    return this.store.testSets.get(testId) ?? null;
  }

  public async findQuestionsForTest(testId: string): Promise<InMemoryQuestion[]> {
    return this.store.questionsByTest.get(testId) ?? [];
  }
}

class InMemoryAttemptRepository implements AttemptRepository {
  public constructor(private readonly store: SimulationStore) {}

  public async create(input: { userId: string; testId: string; startedAt: Date }): Promise<PersistedAttempt> {
    const id = this.store.nextAttemptId();
    const attempt: PersistedAttempt = {
      id,
      userId: input.userId,
      testId: input.testId,
      startedAt: input.startedAt.toISOString(),
      startedAtDate: input.startedAt,
    };
    this.store.attempts.set(id, attempt);
    return attempt;
  }

  public async findById(attemptId: string): Promise<PersistedAttempt | null> {
    return this.store.attempts.get(attemptId) ?? null;
  }

  public async saveResponses(attemptId: string, responses: AttemptResponse[]): Promise<void> {
    const attempt = this.store.attempts.get(attemptId);
    if (!attempt) {
      return;
    }

    const stored: StoredResponse[] = responses.map((response) => ({
      attemptId,
      questionId: response.questionId,
      selectedIndex: response.selectedIndex,
      answeredAt: attempt.startedAtDate,
    }));
    this.store.responses.set(attemptId, stored);
  }

  public async completeAttempt(input: {
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
  }): Promise<PersistedAttempt> {
    const current = this.store.attempts.get(input.attemptId);
    if (!current) {
      throw new Error("Attempt not found");
    }

    const updated: PersistedAttempt = {
      ...current,
      completedAt: input.completedAt.toISOString(),
      durationSeconds: input.durationSeconds,
      totalQuestions: input.totalQuestions,
      attemptedCount: input.attemptedCount,
      correctCount: input.correctCount,
      incorrectCount: input.incorrectCount,
      skippedCount: input.skippedCount,
      rawScore: input.rawScore,
    };
    this.store.attempts.set(input.attemptId, updated);
    return updated;
  }
}

class InMemoryEventRepository implements EventRepository {
  public async log(
    _eventName: "test_created" | "attempt_started" | "attempt_submitted",
    _payload: Record<string, unknown>,
  ): Promise<void> {}
}

class InMemoryMasteryRepository implements MasteryRepository {
  public readonly history: MasteryHistoryWrite[] = [];

  public constructor(private readonly store: SimulationStore) {}

  public async getUserTopicSignals(userId: string): Promise<TopicSignal[]> {
    const output: TopicSignal[] = [];
    const attempts = Array.from(this.store.attempts.values()).filter(
      (attempt) => attempt.userId === userId && attempt.completedAt,
    );

    for (const attempt of attempts) {
      const responses = this.store.responses.get(attempt.id) ?? [];
      for (const response of responses) {
        const question = this.store.questions.find((item) => item.id === response.questionId);
        if (!question) {
          continue;
        }
        output.push({
          topicId: question.topicId,
          correct: response.selectedIndex !== null && response.selectedIndex === question.correctIndex,
          difficulty: question.difficulty,
          answeredAt: response.answeredAt,
          attemptId: attempt.id,
          totalQuestions: attempt.totalQuestions ?? 0,
          attemptedCount: attempt.attemptedCount ?? 0,
          incorrectCount: attempt.incorrectCount ?? 0,
        });
      }
    }

    output.sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
    return output;
  }

  public async getAllUserIdsWithAttempts(): Promise<string[]> {
    return Array.from(new Set(Array.from(this.store.attempts.values()).map((attempt) => attempt.userId))).sort();
  }

  public async appendHistory(rows: MasteryHistoryWrite[]): Promise<void> {
    this.history.push(...rows);
  }

  public async hasHistoryForSourceAttempt(userId: string, sourceAttemptId: string): Promise<boolean> {
    return this.history.some(
      (row) => row.userId === userId && row.sourceAttemptId === sourceAttemptId,
    );
  }
}

class InMemoryWeakAreaRepository implements WeakAreaRepository {
  private readonly map = new Map<string, { topicId: string; mastery: number }>();

  public async upsertWeakArea(userId: string, topicId: string, mastery: number): Promise<void> {
    this.map.set(`${userId}:${topicId}`, { topicId, mastery });
  }

  public async deleteWeakAreasNotInList(userId: string, topicIds: string[]): Promise<void> {
    const keep = new Set(topicIds.map((topicId) => `${userId}:${topicId}`));
    for (const key of this.map.keys()) {
      if (key.startsWith(`${userId}:`) && !keep.has(key)) {
        this.map.delete(key);
      }
    }
  }

  public countForUser(userId: string): number {
    return Array.from(this.map.keys()).filter((key) => key.startsWith(`${userId}:`)).length;
  }
}

class InMemoryRevisionRepository implements RevisionRepository {
  public readonly tasks: RevisionTaskRecord[] = [];
  private counter = 0;

  public async createRevisionTask(userId: string, topicId: string, dueAt: Date): Promise<void> {
    this.counter += 1;
    this.tasks.push({
      id: `rt-${this.counter}`,
      userId,
      topicId,
      dueAt,
      completed: false,
      createdAt: new Date(),
    });
  }

  public async findOpenTasks(userId: string): Promise<RevisionTaskRecord[]> {
    return this.tasks.filter((task) => task.userId === userId && !task.completed);
  }

  public async markCompleted(taskId: string): Promise<void> {
    const task = this.tasks.find((item) => item.id === taskId);
    if (task) {
      task.completed = true;
    }
  }

  public async deleteFutureTasksForTopic(userId: string, topicId: string): Promise<void> {
    const now = Date.now();
    for (const task of this.tasks) {
      if (
        task.userId === userId &&
        task.topicId === topicId &&
        !task.completed &&
        task.dueAt.getTime() >= now
      ) {
        task.completed = true;
      }
    }
  }

  public openCountForUser(userId: string): number {
    return this.tasks.filter((task) => task.userId === userId && !task.completed).length;
  }
}

function buildQuestionBank(): InMemoryQuestion[] {
  const topics = ["t1", "t2", "t3", "t4", "t5"];
  const difficulties: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  const questions: InMemoryQuestion[] = [];
  let counter = 0;

  for (const topicId of topics) {
    for (let i = 0; i < 30; i += 1) {
      counter += 1;
      const difficulty = difficulties[i % difficulties.length];
      const correctIndex = i % 4;
      questions.push({
        id: `q-${counter}`,
        subjectId: "s1",
        topicId,
        stem: `${topicId} question ${i + 1}`,
        options: ["A", "B", "C", "D"],
        difficulty,
        tags: [],
        correctIndex,
      });
    }
  }

  return questions;
}

function buildResponses(
  questions: Array<Question & { correctIndex: number }>,
  attemptRatio: number,
  accuracy: number,
): AttemptResponse[] {
  const total = questions.length;
  const attemptedCount = clamp(Math.round(total * attemptRatio), 0, total);
  const correctCount = clamp(Math.round(attemptedCount * accuracy), 0, attemptedCount);

  return questions.map((question, index) => {
    if (index >= attemptedCount) {
      return {
        questionId: question.id,
        selectedIndex: null,
        timeSpentSeconds: 45,
      };
    }

    const isCorrect = index < correctCount;
    const selectedIndex = isCorrect ? question.correctIndex : (question.correctIndex + 1) % question.options.length;
    return {
      questionId: question.id,
      selectedIndex,
      timeSpentSeconds: 45,
    };
  });
}

function archetypes(): ArchetypeConfig[] {
  return [
    {
      name: "strong_calibrated",
      userId: "u-strong",
      attemptRatio: (i) => 0.8 + (i % 3 === 0 ? 0.02 : 0),
      accuracy: () => 0.75,
    },
    {
      name: "knowledgeable_reckless",
      userId: "u-reckless",
      attemptRatio: () => 0.95,
      accuracy: () => 0.6,
    },
    {
      name: "under_attempter",
      userId: "u-under",
      attemptRatio: () => 0.55,
      accuracy: () => 0.8,
    },
    {
      name: "inconsistent",
      userId: "u-inconsistent",
      attemptRatio: (i) => [0.9, 0.7, 0.82, 0.6, 0.88][i % 5],
      accuracy: (i) => [0.85, 0.45, 0.65, 0.5, 0.78][i % 5],
    },
  ];
}

function summarizeUser(
  userId: string,
  history: MasteryHistoryWrite[],
  weakAreas: InMemoryWeakAreaRepository,
  revision: InMemoryRevisionRepository,
) {
  const userRows = history.filter((row) => row.userId === userId);
  const byRun = new Map<string, MasteryHistoryWrite[]>();

  for (const row of userRows) {
    const runKey = `${row.computedAt.toISOString()}::${row.sourceAttemptId ?? "manual"}`;
    const bucket = byRun.get(runKey) ?? [];
    bucket.push(row);
    byRun.set(runKey, bucket);
  }

  const runs = Array.from(byRun.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, rows]) => rows);
  const latest = runs.at(-1) ?? [];
  const first = runs.at(0) ?? [];

  const avg = (rows: MasteryHistoryWrite[], key: "knowledgeScore" | "riskScore" | "finalMastery") =>
    rows.length === 0 ? 0 : rows.reduce((acc, row) => acc + row[key], 0) / rows.length;

  const confidence = latest.reduce<Record<string, number>>((acc, row) => {
    acc[row.confidence] = (acc[row.confidence] ?? 0) + 1;
    return acc;
  }, {});

  return {
    userId,
    ksAvg: round2(avg(latest, "knowledgeScore")),
    rdsAvg: round2(avg(latest, "riskScore")),
    finalMasteryStart: round2(avg(first, "finalMastery")),
    finalMasteryEnd: round2(avg(latest, "finalMastery")),
    trendDelta: round2(avg(latest, "finalMastery") - avg(first, "finalMastery")),
    confidenceLatest: confidence,
    weakAreaCount: weakAreas.countForUser(userId),
    openRevisionTasks: revision.openCountForUser(userId),
  };
}

async function main() {
  const store = new SimulationStore(buildQuestionBank());
  const questionRepo = new InMemoryQuestionRepository(store);
  const testSetRepo = new InMemoryTestSetRepository(store);
  const attemptRepo = new InMemoryAttemptRepository(store);
  const eventRepo = new InMemoryEventRepository();
  const masteryRepo = new InMemoryMasteryRepository(store);
  const weakAreaRepo = new InMemoryWeakAreaRepository();
  const revisionRepo = new InMemoryRevisionRepository();
  const masteryService = new MasteryService({
    repository: masteryRepo,
    weakAreas: weakAreaRepo,
    revision: revisionRepo,
  });

  const assessmentService = new AssessmentService({
    questions: questionRepo,
    testSets: testSetRepo,
    attempts: attemptRepo,
    events: eventRepo,
    mastery: masteryService,
  });

  const today = new Date("2026-03-04T00:00:00.000Z");
  const attemptsPerUser = 12;
  const questionCount = 15;
  const spacingDays = 1;

  for (const archetype of archetypes()) {
    for (let i = 0; i < attemptsPerUser; i += 1) {
      const testDate = new Date(today);
      testDate.setUTCDate(today.getUTCDate() - ((attemptsPerUser - i) * spacingDays));

      const assembled = await assessmentService.createTestSet({
        subjectId: "s1",
        mode: "exam",
        seed: i + archetype.userId.length * 100,
        questionCount,
        userId: archetype.userId,
        requestId: `sim-${archetype.userId}-${i}-assemble`,
      });

      const started = await assessmentService.startAttempt({
        userId: archetype.userId,
        testId: assembled.testSetId,
        startedAt: testDate,
        requestId: `sim-${archetype.userId}-${i}-start`,
      });

      const responses = buildResponses(
        assembled.questions as Array<Question & { correctIndex: number }>,
        clamp(archetype.attemptRatio(i), 0, 1),
        clamp(archetype.accuracy(i), 0, 1),
      );

      await assessmentService.submitAttempt({
        attemptId: started.attemptId,
        responses,
        requestId: `sim-${archetype.userId}-${i}-submit`,
      });
    }
  }

  const summaries = archetypes().map((archetype) =>
    ({
      archetype: archetype.name,
      ...summarizeUser(archetype.userId, masteryRepo.history, weakAreaRepo, revisionRepo),
    }),
  );

  const strongUserId = "u-strong";
  const strongSignals = await masteryRepo.getUserTopicSignals(strongUserId);
  const topicIds = Array.from(new Set(strongSignals.map((signal) => signal.topicId))).sort();
  const diagnosticTopicId = topicIds[0] ?? "t1";
  const diagnosticSignals = strongSignals.filter((signal) => signal.topicId === diagnosticTopicId);

  let ksDebug:
    | {
        numerator: number;
        denominator: number;
        knowledgeRatio: number;
        dampener: number;
        consistencyFactor: number;
        dataPointsUsed: number;
      }
    | undefined;
  const ksResult = computeKnowledgeScore(diagnosticSignals, {
    asOf: new Date(),
    debug: (data) => {
      ksDebug = data;
    },
  });

  const relevantResponses = Array.from(store.responses.entries())
    .filter(([attemptId]) => store.attempts.get(attemptId)?.userId === strongUserId)
    .flatMap(([, responses]) =>
      responses.filter((response) => store.questions.find((question) => question.id === response.questionId)?.topicId === diagnosticTopicId),
    );
  const attemptedResponses = relevantResponses.filter((response) => response.selectedIndex !== null);
  const correctAttempted = attemptedResponses.filter((response) => {
    const question = store.questions.find((item) => item.id === response.questionId);
    return question ? response.selectedIndex === question.correctIndex : false;
  });
  const accuracyPct =
    attemptedResponses.length === 0 ? 0 : (correctAttempted.length / attemptedResponses.length) * 100;

  console.log(
    JSON.stringify(
      {
        summaries,
        diagnostic: {
          archetype: "strong_calibrated",
          topicId: diagnosticTopicId,
          accuracyPct: round2(accuracyPct),
          rawTopicKS: round2((ksDebug?.knowledgeRatio ?? 0) * 100) / 100,
          scaledTopicKS: ksResult.knowledgeScore,
          totalCorrectWeighted: round2(ksDebug?.numerator ?? 0),
          totalPossibleWeighted: round2(ksDebug?.denominator ?? 0),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
