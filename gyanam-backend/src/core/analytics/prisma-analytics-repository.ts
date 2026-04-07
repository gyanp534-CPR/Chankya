import type { PrismaClient } from "@prisma/client";
import type { AnalyticsRepository, LatestTopicMastery, RevisionDueItem } from "./types.js";

type TopicMasteryRow = {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  mastery: number;
  dataPointsUsed: number;
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
        t."name" AS "topicName",
        t."subjectId",
        s."name" AS "subjectName",
        latest."mastery",
        latest."dataPointsUsed"
      FROM latest
      JOIN "Topic" t ON t."id" = latest."topicId"
      JOIN "Subject" s ON s."id" = t."subjectId"
      WHERE latest.rn = 1
      ORDER BY latest."topicId" ASC
    `;

    return rows.map((row) => ({
      topicId: row.topicId,
      topicName: row.topicName,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      mastery: row.mastery,
      dataPointsUsed: row.dataPointsUsed,
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
    const rows = await this.db.$queryRaw<Array<{ taskId: string; topicId: string; topicName: string; subjectName: string; dueAt: Date }>>`
      SELECT
        rt."id" AS "taskId",
        rt."topicId",
        t."name" AS "topicName",
        s."name" AS "subjectName",
        rt."dueAt"
      FROM "RevisionTask" rt
      JOIN "Topic" t ON t."id" = rt."topicId"
      JOIN "Subject" s ON s."id" = t."subjectId"
      WHERE rt."userId" = ${userId} AND rt."completed" = false
      ORDER BY rt."dueAt" ASC
    `;

    return rows.map((row) => ({
      taskId: row.taskId,
      topicId: row.topicId,
      topicName: row.topicName,
      subjectName: row.subjectName,
      dueAt: row.dueAt.toISOString(),
    }));
  }
}
