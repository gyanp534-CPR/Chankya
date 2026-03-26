CREATE TABLE "WeakArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeakArea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeakArea_userId_topicId_key" ON "WeakArea"("userId", "topicId");
CREATE INDEX "WeakArea_userId_idx" ON "WeakArea"("userId");
CREATE INDEX "WeakArea_topicId_idx" ON "WeakArea"("topicId");

ALTER TABLE "WeakArea" ADD CONSTRAINT "WeakArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeakArea" ADD CONSTRAINT "WeakArea_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
