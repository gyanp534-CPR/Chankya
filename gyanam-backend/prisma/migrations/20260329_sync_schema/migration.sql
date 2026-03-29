-- AlterEnum (non-destructive)
ALTER TYPE "TestMode" ADD VALUE IF NOT EXISTS 'practice';
ALTER TYPE "TestMode" ADD VALUE IF NOT EXISTS 'practicexz';

-- CreateTable
CREATE TABLE "ErrorAttemptLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorAttemptLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserErrorState" (
    "userId" TEXT NOT NULL,
    "recentErrors" JSONB NOT NULL,
    "errorCounts" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserErrorState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserErrorMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "strength" INTEGER NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserErrorMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorAttemptLog_userId_createdAt_idx" ON "ErrorAttemptLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorAttemptLog_questionId_idx" ON "ErrorAttemptLog"("questionId");

-- CreateIndex
CREATE INDEX "ErrorAttemptLog_attemptId_idx" ON "ErrorAttemptLog"("attemptId");

-- CreateIndex
CREATE INDEX "UserErrorState_lastUpdated_idx" ON "UserErrorState"("lastUpdated");

-- CreateIndex
CREATE INDEX "UserErrorMemory_userId_idx" ON "UserErrorMemory"("userId");

-- CreateIndex
CREATE INDEX "UserErrorMemory_lastSeenAt_idx" ON "UserErrorMemory"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserErrorMemory_userId_key_key" ON "UserErrorMemory"("userId", "key");

-- AddForeignKey
ALTER TABLE "ErrorAttemptLog" ADD CONSTRAINT "ErrorAttemptLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorAttemptLog" ADD CONSTRAINT "ErrorAttemptLog_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorAttemptLog" ADD CONSTRAINT "ErrorAttemptLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserErrorState" ADD CONSTRAINT "UserErrorState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserErrorMemory" ADD CONSTRAINT "UserErrorMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
