ALTER TABLE "MasteryIndexHistory"
ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT 'v1.0',
ADD COLUMN "recomputeReason" TEXT;
