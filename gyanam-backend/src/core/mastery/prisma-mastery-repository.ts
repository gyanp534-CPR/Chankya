import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { MasteryHistoryWrite, MasteryRepository, TopicSignal } from "./types.js";

export class PrismaMasteryRepository implements MasteryRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async getUserTopicSignals(userId: string): Promise<TopicSignal[]> {
    const rows = await this.db.attemptResponse.findMany({
      where: {
        attempt: {
          userId,
          deletedAt: null,
          completedAt: { not: null },
        },
        question: {
          deletedAt: null,
          topic: { deletedAt: null, subject: { deletedAt: null } },
        },
      },
      select: {
        attemptId: true,
        selectedIndex: true,
        createdAt: true,
        question: {
          select: {
            topicId: true,
            difficulty: true,
            correctIndex: true,
          },
        },
        attempt: {
          select: {
            totalQuestions: true,
            attemptedCount: true,
            incorrectCount: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      topicId: row.question.topicId,
      correct: row.selectedIndex !== null && row.selectedIndex === row.question.correctIndex,
      difficulty: row.question.difficulty,
      answeredAt: row.createdAt,
      attemptId: row.attemptId,
      totalQuestions: row.attempt.totalQuestions ?? 0,
      attemptedCount: row.attempt.attemptedCount ?? 0,
      incorrectCount: row.attempt.incorrectCount ?? 0,
    }));
  }

  public async getAllUserIdsWithAttempts(): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT "userId"
      FROM "TestAttempt"
      WHERE "deletedAt" IS NULL AND "completedAt" IS NOT NULL
      ORDER BY "userId" ASC
    `;

    return rows.map((row) => row.userId);
  }

  public async appendHistory(rows: MasteryHistoryWrite[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.db.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.$executeRaw`
          INSERT INTO "MasteryIndexHistory"
            ("id", "userId", "topicId", "knowledgeScore", "riskScore", "finalMastery", "confidence", "dataPointsUsed", "modelVersion", "recomputeReason", "sourceAttemptId", "computedAt", "createdAt", "updatedAt")
          VALUES
            (${randomUUID()}, ${row.userId}, ${row.topicId}, ${row.knowledgeScore}, ${row.riskScore}, ${row.finalMastery}, ${row.confidence}, ${row.dataPointsUsed}, ${row.modelVersion}, ${row.recomputeReason ?? null}, ${row.sourceAttemptId ?? null}, ${row.computedAt}, NOW(), NOW())
        `;
      }
    });
  }

  public async hasHistoryForSourceAttempt(userId: string, sourceAttemptId: string): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 as "exists"
      FROM "MasteryIndexHistory"
      WHERE "userId" = ${userId} AND "sourceAttemptId" = ${sourceAttemptId}
      LIMIT 1
    `;

    return rows.length > 0;
  }
}

export class NoopMasteryRepository implements MasteryRepository {
  public async getUserTopicSignals(_userId: string): Promise<TopicSignal[]> {
    return [];
  }

  public async getAllUserIdsWithAttempts(): Promise<string[]> {
    return [];
  }

  public async appendHistory(_rows: MasteryHistoryWrite[]): Promise<void> {}

  public async hasHistoryForSourceAttempt(_userId: string, _sourceAttemptId: string): Promise<boolean> {
    return false;
  }
}
