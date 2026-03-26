import type { AttemptResponse, Question } from "@gyanam/shared";
import { AssessmentService } from "../../src/core/assessment/domain/assessment-service.js";
import type {
  AttemptRepository,
  EventRepository,
  PersistedAttempt,
  QuestionRepository,
  TestSetRepository,
  TestSetRecord,
} from "../../src/core/assessment/domain/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

type InMemoryQuestion = Question & { correctIndex: number; subjectId: string };

export class InMemoryQuestionRepository implements QuestionRepository {
  public constructor(private readonly questions: InMemoryQuestion[]) {}

  public async findDiagnosticSubjectId(): Promise<string | null> {
    const ids = await this.findDiagnosticSubjectIds(1);
    return ids[0] ?? null;
  }

  public async findDiagnosticSubjectIds(limit: number): Promise<string[]> {
    return Array.from(new Set(this.questions.map((question) => question.subjectId)))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, Math.max(1, limit));
  }

  public async findBySubject(subjectId: string): Promise<InMemoryQuestion[]> {
    return this.questions.filter((question) => question.subjectId === subjectId);
  }

  public async incrementExposure(questionIds: string[]): Promise<void> {
    for (const question of this.questions) {
      if (questionIds.includes(question.id)) {
        // no-op counter placeholder for tests
      }
    }
  }
}

export class InMemoryTestSetRepository implements TestSetRepository {
  private readonly testSets = new Map<string, TestSetRecord>();
  private readonly questionsByTest = new Map<string, InMemoryQuestion[]>();

  public constructor(private readonly questions: InMemoryQuestion[]) {}

  public async create(input: {
    subjectId: string;
    mode: "practice" | "exam";
    seed: number;
    questionIds: string[];
    questionCount: number;
    createdBy?: string;
  }): Promise<TestSetRecord> {
    const id = nextId("test");
    const record: TestSetRecord = {
      id,
      subjectId: input.subjectId,
      questionIds: input.questionIds,
      mode: input.mode,
      createdAt: new Date().toISOString(),
      seed: input.seed,
      questionCount: input.questionCount,
    };

    this.testSets.set(id, record);
    this.questionsByTest.set(
      id,
      input.questionIds.map((questionId) => this.questions.find((question) => question.id === questionId)).filter(Boolean) as InMemoryQuestion[],
    );

    return record;
  }

  public async findById(testId: string): Promise<TestSetRecord | null> {
    return this.testSets.get(testId) ?? null;
  }

  public async findQuestionsForTest(testId: string): Promise<InMemoryQuestion[]> {
    return this.questionsByTest.get(testId) ?? [];
  }
}

export class InMemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, PersistedAttempt>();
  private readonly responses = new Map<string, AttemptResponse[]>();

  public async create(input: { userId: string; testId: string; startedAt: Date }): Promise<PersistedAttempt> {
    const id = nextId("attempt");
    const attempt: PersistedAttempt = {
      id,
      userId: input.userId,
      testId: input.testId,
      startedAt: input.startedAt.toISOString(),
      startedAtDate: input.startedAt,
    };

    this.attempts.set(id, attempt);
    return attempt;
  }

  public async findById(attemptId: string): Promise<PersistedAttempt | null> {
    return this.attempts.get(attemptId) ?? null;
  }

  public async saveResponses(attemptId: string, responses: AttemptResponse[]): Promise<void> {
    this.responses.set(attemptId, responses);
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
    const current = this.attempts.get(input.attemptId);
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

    this.attempts.set(input.attemptId, updated);
    return updated;
  }
}

export class InMemoryEventRepository implements EventRepository {
  public readonly events: Array<{ eventName: string; payload: Record<string, unknown> }> = [];

  public async log(eventName: "test_created" | "attempt_started" | "attempt_submitted", payload: Record<string, unknown>): Promise<void> {
    this.events.push({ eventName, payload });
  }
}

export function createInMemoryAssessmentService(questions: InMemoryQuestion[]): {
  service: AssessmentService;
  events: InMemoryEventRepository;
} {
  const questionRepo = new InMemoryQuestionRepository(questions);
  const testSetRepo = new InMemoryTestSetRepository(questions);
  const attemptRepo = new InMemoryAttemptRepository();
  const eventRepo = new InMemoryEventRepository();

  return {
    service: new AssessmentService({
      questions: questionRepo,
      testSets: testSetRepo,
      attempts: attemptRepo,
      events: eventRepo,
    }),
    events: eventRepo,
  };
}
