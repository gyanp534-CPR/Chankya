CREATE TABLE "MasteryIndexHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "knowledgeScore" DOUBLE PRECISION NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "finalMastery" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "dataPointsUsed" INTEGER NOT NULL,
    "sourceAttemptId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasteryIndexHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MasteryIndexHistory_userId_topicId_computedAt_idx" ON "MasteryIndexHistory"("userId", "topicId", "computedAt");
CREATE INDEX "MasteryIndexHistory_userId_computedAt_idx" ON "MasteryIndexHistory"("userId", "computedAt");
CREATE UNIQUE INDEX "MasteryIndexHistory_userId_topicId_sourceAttemptId_key" ON "MasteryIndexHistory"("userId", "topicId", "sourceAttemptId");

ALTER TABLE "MasteryIndexHistory" ADD CONSTRAINT "MasteryIndexHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MasteryIndexHistory" ADD CONSTRAINT "MasteryIndexHistory_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
