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

-- CreateIndex
CREATE INDEX "ErrorAttemptLog_userId_createdAt_idx" ON "ErrorAttemptLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorAttemptLog_questionId_idx" ON "ErrorAttemptLog"("questionId");

-- CreateIndex
CREATE INDEX "ErrorAttemptLog_attemptId_idx" ON "ErrorAttemptLog"("attemptId");

-- AddForeignKey
ALTER TABLE "ErrorAttemptLog" ADD CONSTRAINT "ErrorAttemptLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorAttemptLog" ADD CONSTRAINT "ErrorAttemptLog_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorAttemptLog" ADD CONSTRAINT "ErrorAttemptLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
