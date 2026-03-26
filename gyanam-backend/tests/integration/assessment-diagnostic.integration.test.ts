import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createInMemoryAssessmentService } from "../fixtures/in-memory-assessment.js";
import { InMemoryAuthStore } from "../fixtures/in-memory-auth-store.js";

const testEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gyanam_test",
  JWT_SECRET: "test-secret-123456789",
};

const questionPool = [
  { id: "q1", subjectId: "s1", topicId: "t1", stem: "Q1", options: ["A", "B", "C", "D"], difficulty: "easy" as const, tags: [], correctIndex: 1 },
  { id: "q2", subjectId: "s1", topicId: "t1", stem: "Q2", options: ["A", "B", "C", "D"], difficulty: "medium" as const, tags: [], correctIndex: 0 },
  { id: "q3", subjectId: "s1", topicId: "t2", stem: "Q3", options: ["A", "B", "C", "D"], difficulty: "hard" as const, tags: [], correctIndex: 2 },
  { id: "q4", subjectId: "s1", topicId: "t2", stem: "Q4", options: ["A", "B", "C", "D"], difficulty: "easy" as const, tags: [], correctIndex: 3 },
];

const mixedQuestionPool = [
  { id: "p-e-1", subjectId: "polity", topicId: "p-t1", stem: "P E1", options: ["A", "B"], difficulty: "easy" as const, tags: [], correctIndex: 0 },
  { id: "p-m-1", subjectId: "polity", topicId: "p-t1", stem: "P M1", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 0 },
  { id: "p-m-2", subjectId: "polity", topicId: "p-t2", stem: "P M2", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 1 },
  { id: "p-h-1", subjectId: "polity", topicId: "p-t2", stem: "P H1", options: ["A", "B"], difficulty: "hard" as const, tags: [], correctIndex: 1 },

  { id: "e-e-1", subjectId: "economy", topicId: "e-t1", stem: "E E1", options: ["A", "B"], difficulty: "easy" as const, tags: [], correctIndex: 0 },
  { id: "e-m-1", subjectId: "economy", topicId: "e-t1", stem: "E M1", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 0 },
  { id: "e-m-2", subjectId: "economy", topicId: "e-t2", stem: "E M2", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 1 },
  { id: "e-h-1", subjectId: "economy", topicId: "e-t2", stem: "E H1", options: ["A", "B"], difficulty: "hard" as const, tags: [], correctIndex: 1 },

  { id: "h-e-1", subjectId: "history", topicId: "h-t1", stem: "H E1", options: ["A", "B"], difficulty: "easy" as const, tags: [], correctIndex: 0 },
  { id: "h-m-1", subjectId: "history", topicId: "h-t1", stem: "H M1", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 0 },
  { id: "h-m-2", subjectId: "history", topicId: "h-t2", stem: "H M2", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 1 },
  { id: "h-h-1", subjectId: "history", topicId: "h-t2", stem: "H H1", options: ["A", "B"], difficulty: "hard" as const, tags: [], correctIndex: 1 },

  { id: "g-e-1", subjectId: "geography", topicId: "g-t1", stem: "G E1", options: ["A", "B"], difficulty: "easy" as const, tags: [], correctIndex: 0 },
  { id: "g-m-1", subjectId: "geography", topicId: "g-t1", stem: "G M1", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 0 },
  { id: "g-m-2", subjectId: "geography", topicId: "g-t2", stem: "G M2", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 1 },
  { id: "g-h-1", subjectId: "geography", topicId: "g-t2", stem: "G H1", options: ["A", "B"], difficulty: "hard" as const, tags: [], correctIndex: 1 },

  { id: "en-e-1", subjectId: "environment", topicId: "en-t1", stem: "EN E1", options: ["A", "B"], difficulty: "easy" as const, tags: [], correctIndex: 0 },
  { id: "en-m-1", subjectId: "environment", topicId: "en-t1", stem: "EN M1", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 0 },
  { id: "en-m-2", subjectId: "environment", topicId: "en-t2", stem: "EN M2", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 1 },
  { id: "en-h-1", subjectId: "environment", topicId: "en-t2", stem: "EN H1", options: ["A", "B"], difficulty: "hard" as const, tags: [], correctIndex: 1 },
];

describe("diagnostic assessment flow", () => {
  it("requires auth and runs assemble -> session -> submit", async () => {
    const { service } = createInMemoryAssessmentService(questionPool);
    const { app } = await createApp({
      authStore: new InMemoryAuthStore(),
      assessmentService: service,
      envOverrides: testEnv,
    });

    const unauthAssemble = await app.inject({
      method: "POST",
      url: "/v1/tests/assemble",
      payload: { mode: "diagnostic", questionCount: 3 },
    });
    expect(unauthAssemble.statusCode).toBe(401);

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "diag@example.com", password: "Password123" },
    });
    expect(register.statusCode).toBe(201);
    const setCookie = register.headers["set-cookie"];
    const cookieHeader = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .flatMap((value) => (typeof value === "string" ? [value] : []))
      .map((value) => value.split(";")[0])
      .join("; ");

    const assemble = await app.inject({
      method: "POST",
      url: "/v1/tests/assemble",
      headers: { cookie: cookieHeader },
      payload: { mode: "diagnostic", questionCount: 3 },
    });
    expect(assemble.statusCode).toBe(200);
    expect(assemble.json().data.questions).toHaveLength(3);
    expect(assemble.json().data.questions[0].correctIndex).toBeUndefined();
    const attemptId = assemble.json().data.attemptId as string;

    const session = await app.inject({
      method: "GET",
      url: `/v1/tests/session/${attemptId}`,
      headers: { cookie: cookieHeader },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().data.questions).toHaveLength(3);
    expect(session.json().data.questions[0].correctIndex).toBeUndefined();

    const evaluate = await app.inject({
      method: "POST",
      url: "/v1/tests/session/evaluate",
      headers: { cookie: cookieHeader },
      payload: {
        attemptId,
        questionId: session.json().data.questions[0].id,
        selectedIndex: 0,
      },
    });
    expect(evaluate.statusCode).toBe(200);
    expect(typeof evaluate.json().data.isCorrect).toBe("boolean");

    const submit = await app.inject({
      method: "POST",
      url: "/v1/tests/submit",
      headers: { cookie: cookieHeader },
      payload: {
        attemptId,
        answers: session.json().data.questions.map((q: { id: string }) => ({
          questionId: q.id,
          selectedIndex: 0,
        })),
      },
    });
    expect(submit.statusCode).toBe(200);
    expect(typeof submit.json().data.rawScore).toBe("number");

    await app.close();
  });

  it("assembles a mixed diagnostic with balanced subject spread", async () => {
    const { service } = createInMemoryAssessmentService(mixedQuestionPool);
    const { app } = await createApp({
      authStore: new InMemoryAuthStore(),
      assessmentService: service,
      envOverrides: testEnv,
    });

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "mixed@example.com", password: "Password123" },
    });
    const setCookie = register.headers["set-cookie"];
    const cookieHeader = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .flatMap((value) => (typeof value === "string" ? [value] : []))
      .map((value) => value.split(";")[0])
      .join("; ");

    const assemble = await app.inject({
      method: "POST",
      url: "/v1/tests/assemble",
      headers: { cookie: cookieHeader },
      payload: { mode: "diagnostic_mixed", questionCount: 20, seed: 101 },
    });
    expect(assemble.statusCode).toBe(200);
    const questions = assemble.json().data.questions as Array<{ id: string }>;
    expect(questions).toHaveLength(20);

    const prefixes = questions.map((question) => question.id.split("-")[0] ?? "unknown");
    const bySubject = prefixes.reduce<Record<string, number>>((acc, key) => {
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySubject).toEqual({
      p: 4,
      e: 4,
      h: 4,
      g: 4,
      en: 4,
    });

    await app.close();
  });
});
