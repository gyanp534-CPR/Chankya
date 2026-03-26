CREATE TABLE "Concept" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "topicGroup" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "frequencyScore" INTEGER NOT NULL DEFAULT 1,
  "frequencyVersion" TEXT NOT NULL DEFAULT 'pyq_v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Concept_subjectId_idx" ON "Concept" ("subjectId");
CREATE INDEX "Concept_subjectId_topicGroup_idx" ON "Concept" ("subjectId", "topicGroup");
CREATE INDEX "Concept_frequencyScore_idx" ON "Concept" ("frequencyScore");

ALTER TABLE "Concept"
ADD CONSTRAINT "Concept_subjectId_fkey"
FOREIGN KEY ("subjectId")
REFERENCES "Subject"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
