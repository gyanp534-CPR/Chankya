CREATE TABLE "UserConceptPerformance" (
  "userId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL,
  "correctAttempts" INTEGER NOT NULL DEFAULT 0,
  "incorrectAttempts" INTEGER NOT NULL DEFAULT 0,
  "averageTimeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastAnsweredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserConceptPerformance_pkey" PRIMARY KEY ("userId","conceptId")
);

CREATE INDEX "UserConceptPerformance_userId_score_idx" ON "UserConceptPerformance"("userId", "score");
CREATE INDEX "UserConceptPerformance_conceptId_idx" ON "UserConceptPerformance"("conceptId");

ALTER TABLE "UserConceptPerformance"
ADD CONSTRAINT "UserConceptPerformance_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "Users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "UserConceptPerformance"
ADD CONSTRAINT "UserConceptPerformance_conceptId_fkey"
FOREIGN KEY ("conceptId")
REFERENCES "Concept"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
