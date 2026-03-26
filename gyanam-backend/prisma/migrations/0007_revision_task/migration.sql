CREATE TABLE "RevisionTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RevisionTask_userId_dueAt_idx" ON "RevisionTask"("userId", "dueAt");

ALTER TABLE "RevisionTask" ADD CONSTRAINT "RevisionTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionTask" ADD CONSTRAINT "RevisionTask_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
