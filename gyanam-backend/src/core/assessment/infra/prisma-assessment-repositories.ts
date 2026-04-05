import type { Prisma, PrismaClient } from "@prisma/client";
import type { AttemptResponse, Question } from "@gyanam/shared";
import type {
  AttemptRepository,
  EventRepository,
  QuestionRepository,
  TestSetRepository,
  PersistedAttempt,
  TestSetRecord,
} from "../domain/types.js";

const REQUIRED_PAPER_TAG = "paper:GS1";

function normalizeInlineLists(text: string): string {
  let next = text.replace(/(\d+\.)([A-Za-z])/g, "$1 $2");
  next = next.replace(/(?<!\d)(\d+\.\s*[A-Za-z])/g, "\n$1");
  next = next.replace(/(?<![A-Za-z])([IVX]+\.\s*[A-Za-z])/g, "\n$1");
  next = next.replace(/\s([IVX]+\.\s)/g, "\n$1");
  next = next.replace(/\n{2,}/g, "\n");
  return next.trim();
}

function hasCodeStyleOptions(options: string[]): boolean {
  return options.some((option) =>
    /^(?:\d+(?:\s*,\s*\d+)*(?:\s+and\s+\d+)?(?:\s+only)?|both|neither)/i.test(
      option.trim(),
    ),
  );
}

function numberSentenceList(text: string): string | null {
  const parts = text
    .split(/(?<=[.?!])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/[.?!]$/, "").trim());

  if (parts.length < 3 || parts.length > 6) {
    return null;
  }

  if (parts.some((part) => part.length < 8)) {
    return null;
  }

  return parts.map((part, index) => `${index + 1}. ${part}`).join("\n");
}

function numberCapitalizedClauses(text: string): string | null {
  const parts = text
    .split(/\s(?=[A-Z][a-z]+(?:\s+[a-z]+){0,5}\s(?:of|on|in|to|for|by|with)\b)/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/^[,;:-]\s*/, "").replace(/[.?!]$/, "").trim());

  if (parts.length < 3 || parts.length > 6) {
    return null;
  }

  if (parts.some((part) => part.length < 6)) {
    return null;
  }

  return parts.map((part, index) => `${index + 1}. ${part}`).join("\n");
}

function cleanStemText(stem: string, options: string[]): string {
  let text = stem
    .replace(/\s+/g, " ")
    .replace(/[\uFFFD]/g, "")
    .trim();

  const codeStyle = hasCodeStyleOptions(options);
  const hasNumbering = /\b1[\.\)]\s*[A-Za-z]/.test(text);

  if (codeStyle && !hasNumbering) {
    const withPrefixList = text.match(/^(.*?:)\s*(.+)$/);
    if (withPrefixList?.[1] && withPrefixList[2]) {
      const [, prefix, body] = withPrefixList;
      const numbered = numberSentenceList(body);
      if (numbered) {
        text = `${prefix}\n${numbered}`;
      }
    }

    const selectMatch = text.match(
      /^(.*?\?)\s*(.*?)\s*(Select the correct answer using the code given below\.?)$/i,
    );
    if (selectMatch?.[1] && selectMatch[2] && selectMatch[3]) {
      const [, prompt, clauseBlob, instruction] = selectMatch;
      const numbered =
        numberSentenceList(clauseBlob) ?? numberCapitalizedClauses(clauseBlob);
      if (numbered) {
        text = `${prompt}\n${numbered}\n${instruction}`;
      }
    }
  }

  if (
    /Consider the following|Which of the above|Select the correct answer using the code/i.test(
      text,
    )
  ) {
    return normalizeInlineLists(text);
  }

  const hasInlineList = /\d+\.\s*\w+.*\d+\./.test(text);
  const normalized = hasInlineList ? normalizeInlineLists(text) : text;
  return normalized.length > 0 ? normalized : "Question text unavailable.";
}

function cleanOptionText(option: string): string {
  const original = option
    .replace(/\s+/g, " ")
    .replace(/[\uFFFD]/g, "")
    .trim();

  let text = option
    .replace(/\s+/g, " ")
    .replace(/[\uFFFD]/g, "")
    .trim();

  text = text.replace(/This passage relates to[\s\S]*$/i, "").trim();
  text = text.replace(/Read the following\s+.*?passages[\s\S]*$/i, "").trim();
  text = text.replace(/Your answers\s+.*?passages only[\s\S]*$/i, "").trim();
  text = text.replace(/Directions?\s+for\s+the\s+following[\s\S]*$/i, "").trim();
  text = text.replace(/Directions:\s*Read the following[\s\S]*$/i, "").trim();
  text = text.replace(/\bPage\s+\d+\b[\s\S]*$/i, "").trim();

  const passageMarkerIndex = text.search(/\bPassage\s*[-–—]?\d+\b/i);
  if (passageMarkerIndex > 20) {
    text = text.slice(0, passageMarkerIndex).trim();
  }

  return text.length > 0 ? text : (original.length > 0 ? original : "Option unavailable");
}

function toQuestion(row: {
  id: string;
  topicId: string;
  topic?: { subjectId: string };
  stem: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  correctIndex: number;
  trapType?: string | null;
  explanation?: unknown;
  concepts?: Array<{ concept: { id: string; name: string } }>;
}): Question & {
  correctIndex: number;
  conceptNames?: string[];
  conceptIds?: string[];
  explanation?: unknown;
  subjectId?: string;
  trapType?: string | null;
} {
  const conceptNames = row.concepts?.map((item) => item.concept.name) ?? [];
  const conceptIds = row.concepts?.map((item) => item.concept.id) ?? [];
  const cleanedStem = cleanStemText(row.stem, row.options);
  const cleanedOptions = row.options.map(cleanOptionText);
  return {
    id: row.id,
    topicId: row.topicId,
    subjectId: row.topic?.subjectId,
    stem: cleanedStem,
    options: cleanedOptions,
    difficulty: row.difficulty,
    tags: row.tags,
    correctIndex: row.correctIndex,
    conceptNames,
    conceptIds,
    trapType: row.trapType ?? null,
    explanation: row.explanation ?? null,
  };
}

export class PrismaQuestionRepository implements QuestionRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findDiagnosticSubjectId(): Promise<string | null> {
    const subjectIds = await this.findDiagnosticSubjectIds(1);
    return subjectIds[0] ?? null;
  }

  public async findDiagnosticSubjectIds(limit: number): Promise<string[]> {
    const subjects = await this.db.subject.findMany({
      where: {
        deletedAt: null,
        topics: {
          some: {
            deletedAt: null,
            questions: {
              some: {
                deletedAt: null,
                tags: { has: REQUIRED_PAPER_TAG },
              },
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true },
      take: Math.max(1, limit),
    });

    return subjects.map((subject) => subject.id);
  }

  public async findBySubject(subjectId: string): Promise<(Question & { correctIndex: number })[]> {
    const rows = await this.db.question.findMany({
      where: {
        deletedAt: null,
        tags: { has: REQUIRED_PAPER_TAG },
        NOT: [{ tags: { has: "demo" } }, { stem: { startsWith: "Demo Question" } }],
        topic: {
          subjectId,
          deletedAt: null,
          subject: {
            deletedAt: null,
          },
        },
      },
      orderBy: [{ difficulty: "asc" }, { id: "asc" }],
      include: {
        concepts: {
          select: {
            concept: { select: { id: true, name: true } },
          },
        },
        topic: {
          select: { subjectId: true },
        },
      },
    });

    return rows.map(toQuestion);
  }

  public async findByFocus(input: {
    conceptId?: string;
    trapType?: string | null;
    limit: number;
  }): Promise<(Question & { correctIndex: number })[]> {
    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      tags: { has: REQUIRED_PAPER_TAG },
      NOT: [{ tags: { has: "demo" } }, { stem: { startsWith: "Demo Question" } }],
    };

    if (input.trapType) {
      where.trapType = input.trapType;
    }
    if (input.conceptId) {
      where.concepts = {
        some: { conceptId: input.conceptId },
      };
    }

    const rows = await this.db.question.findMany({
      where,
      orderBy: [{ difficulty: "asc" }, { id: "asc" }],
      take: Math.max(1, input.limit),
      include: {
        concepts: {
          select: {
            concept: { select: { id: true, name: true } },
          },
        },
        topic: {
          select: { subjectId: true },
        },
      },
    });

    return rows.map(toQuestion);
  }

  public async incrementExposure(questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) {
      return;
    }

    await this.db.question.updateMany({
      where: { id: { in: questionIds } },
      data: { exposureCount: { increment: 1 } },
    });
  }

  public async getTopicLabels(topicIds: string[]): Promise<Record<string, string>> {
    if (topicIds.length === 0) {
      return {};
    }

    const rows = await this.db.topic.findMany({
      where: { id: { in: topicIds }, deletedAt: null, subject: { deletedAt: null } },
      select: {
        id: true,
        name: true,
        subject: { select: { name: true } },
      },
    });

    return Object.fromEntries(
      rows.map((row) => [row.id, `${row.subject.name} - ${row.name}`]),
    );
  }

  public async getConceptIdsByName(
    names: string[],
  ): Promise<Record<string, { id: string; name: string }>> {
    const trimmed = names.map((name) => name.trim()).filter((name) => name.length > 0);
    if (trimmed.length === 0) {
      return {};
    }
    const rows = await this.db.concept.findMany({
      where: { name: { in: trimmed } },
      select: { id: true, name: true },
    });
    return Object.fromEntries(rows.map((row) => [row.name, { id: row.id, name: row.name }]));
  }

  public async getConceptNamesById(
    ids: string[],
  ): Promise<Record<string, { id: string; name: string }>> {
    const unique = [...new Set(ids.filter((id) => id.trim().length > 0))];
    if (unique.length === 0) {
      return {};
    }
    const rows = await this.db.concept.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return Object.fromEntries(rows.map((row) => [row.id, { id: row.id, name: row.name }]));
  }
}

export class PrismaTestSetRepository implements TestSetRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async create(input: {
    subjectId: string;
    mode: "practice" | "exam";
    seed: number;
    questionIds: string[];
    questionCount: number;
    createdBy?: string;
  }): Promise<TestSetRecord> {
    const created = await this.db.testSet.create({
      data: {
        subjectId: input.subjectId,
        mode: input.mode,
        seed: input.seed,
        questionCount: input.questionCount,
        createdBy: input.createdBy,
        questions: {
          createMany: {
            data: input.questionIds.map((questionId, index) => ({
              questionId,
              sortOrder: index,
            })),
          },
        },
      },
      include: {
        questions: true,
      },
    });

    const normalizedMode = created.mode === "practicexz" ? "practice" : created.mode;
    return {
      id: created.id,
      subjectId: created.subjectId,
      questionIds: created.questions.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.questionId),
      mode: normalizedMode,
      createdAt: created.createdAt.toISOString(),
      seed: created.seed,
      questionCount: created.questionCount,
    };
  }

  public async findById(testId: string): Promise<TestSetRecord | null> {
    const row = await this.db.testSet.findFirst({
      where: {
        id: testId,
        deletedAt: null,
      },
      include: {
        questions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!row) {
      return null;
    }

    const normalizedMode = row.mode === "practicexz" ? "practice" : row.mode;
    return {
      id: row.id,
      subjectId: row.subjectId,
      questionIds: row.questions.map((q) => q.questionId),
      mode: normalizedMode,
      createdAt: row.createdAt.toISOString(),
      seed: row.seed,
      questionCount: row.questionCount,
    };
  }

  public async findQuestionsForTest(testId: string): Promise<(Question & { correctIndex: number })[]> {
    const rows = await this.db.testSetQuestion.findMany({
      where: {
        testSetId: testId,
        question: {
          deletedAt: null,
          tags: { has: REQUIRED_PAPER_TAG },
          NOT: [{ tags: { has: "demo" } }, { stem: { startsWith: "Demo Question" } }],
        },
      },
      include: { question: true },
      orderBy: { sortOrder: "asc" },
    });

    return rows.map((row) => toQuestion(row.question));
  }
}

export class PrismaAttemptRepository implements AttemptRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async create(input: { userId: string; testId: string; startedAt: Date }): Promise<PersistedAttempt> {
    const row = await this.db.testAttempt.create({
      data: {
        userId: input.userId,
        testId: input.testId,
        startedAt: input.startedAt,
      },
    });

    return {
      id: row.id,
      userId: row.userId,
      testId: row.testId,
      startedAt: row.startedAt.toISOString(),
      startedAtDate: row.startedAt,
      completedAt: row.completedAt?.toISOString(),
      durationSeconds: row.durationSeconds ?? undefined,
    };
  }

  public async findById(attemptId: string): Promise<PersistedAttempt | null> {
    const row = await this.db.testAttempt.findFirst({
      where: { id: attemptId, deletedAt: null },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.userId,
      testId: row.testId,
      startedAt: row.startedAt.toISOString(),
      startedAtDate: row.startedAt,
      completedAt: row.completedAt?.toISOString(),
      durationSeconds: row.durationSeconds ?? undefined,
    };
  }

  public async saveResponses(attemptId: string, responses: AttemptResponse[]): Promise<void> {
    if (responses.length === 0) {
      return;
    }

    await this.db.$transaction(async (tx) => {
      for (const response of responses) {
        await tx.attemptResponse.upsert({
          where: {
            attemptId_questionId: {
              attemptId,
              questionId: response.questionId,
            },
          },
          create: {
            attemptId,
            questionId: response.questionId,
            selectedIndex: response.selectedIndex,
            timeSpentSeconds: response.timeSpentSeconds,
            exposureCount: 1,
          },
          update: {
            selectedIndex: response.selectedIndex,
            timeSpentSeconds: response.timeSpentSeconds,
            exposureCount: { increment: 1 },
          },
        });
      }
    });
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
    const row = await this.db.testAttempt.update({
      where: { id: input.attemptId },
      data: {
        completedAt: input.completedAt,
        durationSeconds: input.durationSeconds,
        totalQuestions: input.totalQuestions,
        attemptedCount: input.attemptedCount,
        correctCount: input.correctCount,
        incorrectCount: input.incorrectCount,
        skippedCount: input.skippedCount,
        rawScore: input.rawScore,
        pauseEvents: input.pauseEvents as Prisma.InputJsonValue | undefined,
      },
    });

    return {
      id: row.id,
      userId: row.userId,
      testId: row.testId,
      startedAt: row.startedAt.toISOString(),
      startedAtDate: row.startedAt,
      completedAt: row.completedAt?.toISOString(),
      durationSeconds: row.durationSeconds ?? undefined,
    };
  }
}

export class PrismaEventRepository implements EventRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async log(
    eventName:
      | "test_created"
      | "attempt_started"
      | "attempt_submitted"
      | "override_used"
      | "mentor_feedback_generated"
      | "learning_path_generated"
      | "learning_path_clicked"
      | "question_attempted_from_focus"
      | "improvement_after_focus",
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.eventLog.create({
      data: {
        eventName,
        requestId: typeof payload.requestId === "string" ? payload.requestId : null,
        userId: typeof payload.userId === "string" ? payload.userId : null,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }
}
