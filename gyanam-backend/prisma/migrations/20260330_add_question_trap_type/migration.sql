-- AddColumn (non-destructive)
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "trapType" TEXT;
