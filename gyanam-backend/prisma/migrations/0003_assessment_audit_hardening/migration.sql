ALTER TABLE "TestAttempt"
ADD COLUMN "totalQuestions" INTEGER,
ADD COLUMN "attemptedCount" INTEGER,
ADD COLUMN "correctCount" INTEGER,
ADD COLUMN "incorrectCount" INTEGER,
ADD COLUMN "skippedCount" INTEGER,
ADD COLUMN "rawScore" DOUBLE PRECISION;
