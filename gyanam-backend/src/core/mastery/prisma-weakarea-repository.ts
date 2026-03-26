import { Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { WeakAreaRepository } from "./types.js";

export class PrismaWeakAreaRepository implements WeakAreaRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async upsertWeakArea(userId: string, topicId: string, mastery: number): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO "WeakArea" ("id", "userId", "topicId", "mastery", "updatedAt")
      VALUES (${randomUUID()}, ${userId}, ${topicId}, ${mastery}, NOW())
      ON CONFLICT ("userId", "topicId")
      DO UPDATE SET "mastery" = EXCLUDED."mastery", "updatedAt" = NOW()
    `;
  }

  public async deleteWeakAreasNotInList(userId: string, topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) {
      await this.db.$executeRaw`
        DELETE FROM "WeakArea"
        WHERE "userId" = ${userId}
      `;
      return;
    }

    await this.db.$executeRaw(
      Prisma.sql`
        DELETE FROM "WeakArea"
        WHERE "userId" = ${userId}
          AND "topicId" NOT IN (${Prisma.join(topicIds)})
      `,
    );
  }
}

export class NoopWeakAreaRepository implements WeakAreaRepository {
  public async upsertWeakArea(_userId: string, _topicId: string, _mastery: number): Promise<void> {}

  public async deleteWeakAreasNotInList(_userId: string, _topicIds: string[]): Promise<void> {}
}
