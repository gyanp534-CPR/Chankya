-- Non-destructive patch for quick attempt persistence.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS "QuickAttemptResponse" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "selectedOption" TEXT NOT NULL,
  "correctOption" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "scoreDelta" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "QuickAttemptResponse_userId_createdAt_idx"
  ON "QuickAttemptResponse" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "QuickAttemptResponse_questionId_idx"
  ON "QuickAttemptResponse" ("questionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'QuickAttemptResponse_userId_fkey'
  ) THEN
    ALTER TABLE "QuickAttemptResponse"
      ADD CONSTRAINT "QuickAttemptResponse_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "Users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'QuickAttemptResponse_questionId_fkey'
  ) THEN
    ALTER TABLE "QuickAttemptResponse"
      ADD CONSTRAINT "QuickAttemptResponse_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "Question"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

