import type { Difficulty, PrismaClient } from "@prisma/client";
import {
  aggregateConceptPerformance,
  type AggregatedConceptPerformance,
  type ConceptAttemptSignal,
} from "./concept-performance.js";
import type { ConceptPerformanceRepository } from "./types.js";

type AttemptConceptSignalRow = {
  conceptId: string;
  selectedIndex: number | null;
  correctIndex: number;
  difficulty: Difficulty;
  timeSpentSeconds: number;
  answeredAt: Date;
};

export class PrismaConceptPerformanceRepository implements ConceptPerformanceRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async aggregateSignalsForAttempt(attemptId: string): Promise<AggregatedConceptPerformance[]> {
    const rows = await this.db.$queryRaw<AttemptConceptSignalRow[]>`
      SELECT
        qc."conceptId",
        ar."selectedIndex",
        q."correctIndex",
        q."difficulty",
        ar."timeSpentSeconds",
        ar."createdAt" AS "answeredAt"
      FROM "AttemptResponse" ar
      JOIN "Question" q ON q."id" = ar."questionId"
      JOIN "QuestionConcept" qc ON qc."questionId" = q."id"
      WHERE ar."attemptId" = ${attemptId}
        AND q."deletedAt" IS NULL
    `;

    const signals: ConceptAttemptSignal[] = rows.map((row) => ({
      conceptId: row.conceptId,
      correct: row.selectedIndex !== null && row.selectedIndex === row.correctIndex,
      difficulty: row.difficulty,
      timeSpentSeconds: row.timeSpentSeconds,
      answeredAt: row.answeredAt,
    }));

    return aggregateConceptPerformance(signals);
  }

  public async applyAggregates(userId: string, aggregates: AggregatedConceptPerformance[]): Promise<void> {
    if (aggregates.length === 0) {
      return;
    }

    for (const aggregate of aggregates) {
      await this.db.$executeRaw`
        INSERT INTO "UserConceptPerformance" (
          "userId",
          "conceptId",
          "score",
          "attempts",
          "correctAttempts",
          "incorrectAttempts",
          "averageTimeSeconds",
          "lastAnsweredAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${userId},
          ${aggregate.conceptId},
          ${aggregate.scoreDelta},
          ${aggregate.attemptsDelta},
          ${aggregate.correctAttemptsDelta},
          ${aggregate.incorrectAttemptsDelta},
          ${aggregate.averageTimeSeconds},
          ${aggregate.lastAnsweredAt},
          NOW(),
          NOW()
        )
        ON CONFLICT ("userId", "conceptId") DO UPDATE
        SET
          "score" = "UserConceptPerformance"."score" + EXCLUDED."score",
          "attempts" = "UserConceptPerformance"."attempts" + EXCLUDED."attempts",
          "correctAttempts" = "UserConceptPerformance"."correctAttempts" + EXCLUDED."correctAttempts",
          "incorrectAttempts" = "UserConceptPerformance"."incorrectAttempts" + EXCLUDED."incorrectAttempts",
          "averageTimeSeconds" = (
            (
              "UserConceptPerformance"."averageTimeSeconds" * "UserConceptPerformance"."attempts"
            ) + (
              EXCLUDED."averageTimeSeconds" * EXCLUDED."attempts"
            )
          ) / NULLIF("UserConceptPerformance"."attempts" + EXCLUDED."attempts", 0),
          "lastAnsweredAt" = GREATEST(
            COALESCE("UserConceptPerformance"."lastAnsweredAt", EXCLUDED."lastAnsweredAt"),
            EXCLUDED."lastAnsweredAt"
          ),
          "updatedAt" = NOW()
      `;
    }
  }
}

export class NoopConceptPerformanceRepository implements ConceptPerformanceRepository {
  public async aggregateSignalsForAttempt(_attemptId: string): Promise<AggregatedConceptPerformance[]> {
    return [];
  }

  public async applyAggregates(_userId: string, _aggregates: AggregatedConceptPerformance[]): Promise<void> {}
}
