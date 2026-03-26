import type { PrismaClient } from "@prisma/client";
import type { ErrorAttemptInput, ErrorEngineRepository, UserErrorState } from "./types.js";

export class PrismaErrorEngineRepository implements ErrorEngineRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async getUserErrorState(userId: string): Promise<UserErrorState | null> {
    const row = await this.db.userErrorState.findUnique({ where: { userId } });
    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      recentErrors: (row.recentErrors as string[]) ?? [],
      errorCounts: (row.errorCounts as Record<string, number>) ?? {},
      lastUpdated: row.lastUpdated,
    };
  }

  public async upsertUserErrorState(state: UserErrorState): Promise<void> {
    await this.db.userErrorState.upsert({
      where: { userId: state.userId },
      update: {
        recentErrors: state.recentErrors,
        errorCounts: state.errorCounts,
        lastUpdated: state.lastUpdated,
      },
      create: {
        userId: state.userId,
        recentErrors: state.recentErrors,
        errorCounts: state.errorCounts,
        lastUpdated: state.lastUpdated,
      },
    });
  }

  public async logAttempt(input: ErrorAttemptInput): Promise<void> {
    await this.db.errorAttemptLog.create({
      data: {
        userId: input.userId,
        questionId: input.questionId,
        attemptId: input.attemptId ?? null,
        isCorrect: input.isCorrect,
        errorType: input.errorType ?? null,
      },
    });
  }

  public async getRecentAttempts(
    userId: string,
    limit: number,
  ): Promise<Array<{ isCorrect: boolean; errorType: string | null; createdAt: Date }>> {
    const rows = await this.db.errorAttemptLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        isCorrect: true,
        errorType: true,
        createdAt: true,
      },
    });

    return rows.reverse();
  }

  public async getRecentErrorAttemptsWithTopic(
    userId: string,
    limit: number,
  ): Promise<Array<{ errorType: string | null; topicId: string | null; createdAt: Date }>> {
    const rows = await this.db.errorAttemptLog.findMany({
      where: { userId, isCorrect: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        errorType: true,
        createdAt: true,
        question: { select: { topicId: true } },
      },
    });

    return rows
      .map((row) => ({
        errorType: row.errorType,
        topicId: row.question?.topicId ?? null,
        createdAt: row.createdAt,
      }))
      .reverse();
  }
}
