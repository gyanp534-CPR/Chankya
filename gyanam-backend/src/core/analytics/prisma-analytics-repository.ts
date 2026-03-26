import type { PrismaClient } from "@prisma/client";
import type { AnalyticsRepository, LatestTopicMastery, RevisionDueItem } from "./types.js";

type TopicMasteryRow = {
  topicId: string;
  subjectId: string;
  mastery: number;
  confidence: string;
};

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async getLatestTopicMastery(userId: string): Promise<LatestTopicMastery[]> {
    const rows = await this.db.$queryRaw<TopicMasteryRow[]>`
      WITH latest AS (
        SELECT
          mih."topicId",
          mih."finalMastery" AS "mastery",
          mih."confidence",
          mih."computedAt",
          mih."createdAt",
          ROW_NUMBER() OVER (
            PARTITION BY mih."topicId"
            ORDER BY mih."computedAt" DESC, mih."createdAt" DESC, mih."id" DESC
          ) AS rn
        FROM "MasteryIndexHistory" mih
        WHERE mih."userId" = ${userId}
      )
      SELECT
        latest."topicId",
        t."subjectId",
        latest."mastery",
        latest."confidence"
      FROM latest
      JOIN "Topic" t ON t."id" = latest."topicId"
      WHERE latest.rn = 1
      ORDER BY latest."topicId" ASC
    `;

    return rows.map((row) => ({
      topicId: row.topicId,
      subjectId: row.subjectId,
      mastery: row.mastery,
      confidence:
        row.confidence === "high" ? "high" : row.confidence === "medium" ? "medium" : "low",
    }));
  }

  public async getWeakTopicIds(userId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ topicId: string }>>`
      SELECT "topicId"
      FROM "WeakArea"
      WHERE "userId" = ${userId}
      ORDER BY "topicId" ASC
    `;
    return rows.map((row) => row.topicId);
  }

  public async getOpenRevisionTasks(userId: string): Promise<RevisionDueItem[]> {
    const rows = await this.db.$queryRaw<Array<{ taskId: string; topicId: string; dueAt: Date }>>`
      SELECT
        "id" AS "taskId",
        "topicId",
        "dueAt"
      FROM "RevisionTask"
      WHERE "userId" = ${userId} AND "completed" = false
      ORDER BY "dueAt" ASC
    `;

    return rows.map((row) => ({
      taskId: row.taskId,
      topicId: row.topicId,
      dueAt: row.dueAt.toISOString(),
    }));
  }
}
