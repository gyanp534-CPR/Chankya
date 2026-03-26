import type { PrismaClient } from "@prisma/client";

export type WeakConceptView = {
  conceptId: string;
  score: number;
  attempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  averageTimeSeconds: number;
  conceptName: string;
};

export async function getWeakConcepts(db: PrismaClient, userId: string): Promise<WeakConceptView[]> {
  return db.$queryRaw<WeakConceptView[]>`
    SELECT
      ucp."conceptId",
      ucp."score",
      ucp."attempts",
      ucp."correctAttempts",
      ucp."incorrectAttempts",
      ucp."averageTimeSeconds",
      c."name" AS "conceptName"
    FROM "UserConceptPerformance" ucp
    JOIN "Concept" c ON c."id" = ucp."conceptId"
    WHERE ucp."userId" = ${userId}
    ORDER BY ucp."score" ASC, ucp."attempts" DESC
    LIMIT 10
  `;
}
