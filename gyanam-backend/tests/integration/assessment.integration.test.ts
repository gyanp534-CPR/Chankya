import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createInMemoryAssessmentService } from "../fixtures/in-memory-assessment.js";
import { InMemoryAuthStore } from "../fixtures/in-memory-auth-store.js";

const testEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gyanam_test",
  JWT_SECRET: "test-secret-123456789",
};

const questionPool = [
  { id: "q1", subjectId: "s1", topicId: "t1", stem: "Q1", options: ["A", "B", "C", "D"], difficulty: "easy" as const, tags: ["correct:1"], correctIndex: 1 },
  { id: "q2", subjectId: "s1", topicId: "t1", stem: "Q2", options: ["A", "B", "C", "D"], difficulty: "medium" as const, tags: ["correct:0"], correctIndex: 0 },
  { id: "q3", subjectId: "s1", topicId: "t2", stem: "Q3", options: ["A", "B", "C", "D"], difficulty: "hard" as const, tags: ["correct:2"], correctIndex: 2 },
  { id: "q4", subjectId: "s1", topicId: "t2", stem: "Q4", options: ["A", "B", "C", "D"], difficulty: "easy" as const, tags: ["correct:3"], correctIndex: 3 },
  { id: "q5", subjectId: "s1", topicId: "t2", stem: "Q5", options: ["A", "B", "C", "D"], difficulty: "medium" as const, tags: ["correct:0"], correctIndex: 0 },
  { id: "q6", subjectId: "s1", topicId: "t3", stem: "Q6", options: ["A", "B", "C", "D"], difficulty: "hard" as const, tags: ["correct:1"], correctIndex: 1 },
];

describe("assessment flow", () => {
  it("assembles, starts, submits, scores, and logs events", async () => {
    const { service, events } = createInMemoryAssessmentService(questionPool);
    const { app } = await createApp({
      authStore: new InMemoryAuthStore(),
      assessmentService: service,
      envOverrides: testEnv,
    });

    const assemble = await app.inject({
      method: "POST",
      url: "/v1/tests/assemble",
      payload: {
        subjectId: "s1",
        mode: "exam",
        seed: 77,
        questionCount: 6,
        userId: "u1",
      },
    });

    expect(assemble.statusCode).toBe(200);
    const assembled = assemble.json();
    expect(assembled.success).toBe(true);
    expect(assembled.data.questions).toHaveLength(6);

    const start = await app.inject({
      method: "POST",
      url: "/v1/attempts/start",
      payload: {
        userId: "u1",
        testId: assembled.data.testSetId,
        startedAt: "2026-03-04T10:00:00.000Z",
      },
    });
    expect(start.statusCode).toBe(200);

    const submit = await app.inject({
      method: "POST",
      url: "/v1/attempts/submit",
      payload: {
        attemptId: start.json().data.attemptId,
        pauseEvents: [{ at: "2026-03-04T10:05:00.000Z", type: "pause" }],
        responses: assembled.data.questions.map((q: { id: string }, idx: number) => ({
          questionId: q.id,
          selectedIndex: idx % 2 === 0 ? 0 : null,
          timeSpentSeconds: 30,
        })),
      },
    });

    expect(submit.statusCode).toBe(200);
    expect(submit.json().data.maxScore).toBe(12);
    expect(submit.json().data.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(submit.json().data.totalQuestions).toBe(6);
    expect(submit.json().data.skippedCount).toBe(3);

    const emitted = events.events.map((item) => item.eventName);
    expect(emitted).toEqual(["test_created", "attempt_started", "attempt_submitted"]);
    const submittedEvent = events.events.at(-1);
    expect(submittedEvent?.payload.subjectId).toBe("s1");
    expect(submittedEvent?.payload.mode).toBe("exam");
    expect(typeof submittedEvent?.payload.totalScore).toBe("number");

    await app.close();
  });
});
