import { type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { RevisionRepository, RevisionTaskRecord } from "../mastery/types.js";

export class PrismaRevisionRepository implements RevisionRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async createRevisionTask(userId: string, topicId: string, dueAt: Date): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO "RevisionTask" ("id", "userId", "topicId", "dueAt", "completed", "createdAt")
      VALUES (${randomUUID()}, ${userId}, ${topicId}, ${dueAt}, false, NOW())
    `;
  }

  public async findOpenTasks(userId: string): Promise<RevisionTaskRecord[]> {
    const rows = await this.db.$queryRaw<Array<RevisionTaskRecord>>`
      SELECT "id", "userId", "topicId", "dueAt", "completed", "createdAt"
      FROM "RevisionTask"
      WHERE "userId" = ${userId} AND "completed" = false
      ORDER BY "dueAt" ASC
    `;
    return rows;
  }

  public async markCompleted(taskId: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE "RevisionTask"
      SET "completed" = true
      WHERE "id" = ${taskId}
    `;
  }

  public async deleteFutureTasksForTopic(userId: string, topicId: string, asOf: Date = new Date()): Promise<void> {
    await this.db.$executeRaw`
      DELETE FROM "RevisionTask"
      WHERE "userId" = ${userId}
        AND "topicId" = ${topicId}
        AND "completed" = false
        AND "dueAt" >= ${asOf}
    `;
  }
}

export class NoopRevisionRepository implements RevisionRepository {
  public async createRevisionTask(_userId: string, _topicId: string, _dueAt: Date): Promise<void> {}

  public async findOpenTasks(_userId: string): Promise<RevisionTaskRecord[]> {
    return [];
  }

  public async markCompleted(_taskId: string): Promise<void> {}

  public async deleteFutureTasksForTopic(_userId: string, _topicId: string, _asOf?: Date): Promise<void> {}
}
