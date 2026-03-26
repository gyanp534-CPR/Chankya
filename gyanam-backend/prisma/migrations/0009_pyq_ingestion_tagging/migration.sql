ALTER TABLE "Question"
ADD COLUMN "year" INTEGER,
ADD COLUMN "examStage" TEXT,
ADD COLUMN "source" TEXT;

CREATE INDEX "Question_year_examStage_idx" ON "Question"("year", "examStage");

CREATE TABLE "QuestionConcept" (
  "questionId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "source" TEXT NOT NULL DEFAULT 'manual_tag_v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionConcept_pkey" PRIMARY KEY ("questionId", "conceptId")
);

CREATE INDEX "QuestionConcept_conceptId_idx" ON "QuestionConcept"("conceptId");

ALTER TABLE "QuestionConcept"
ADD CONSTRAINT "QuestionConcept_questionId_fkey"
FOREIGN KEY ("questionId")
REFERENCES "Question"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "QuestionConcept"
ADD CONSTRAINT "QuestionConcept_conceptId_fkey"
FOREIGN KEY ("conceptId")
REFERENCES "Concept"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
