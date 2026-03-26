import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { AnalyticsService } from "../../src/core/analytics/analytics-service.js";
import type { AnalyticsRepository } from "../../src/core/analytics/types.js";
import { createInMemoryAssessmentService } from "../fixtures/in-memory-assessment.js";
import { InMemoryAuthStore } from "../fixtures/in-memory-auth-store.js";

const testEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gyanam_test",
  JWT_SECRET: "test-secret-123456789",
};

const questionPool = [
  { id: "q1", subjectId: "s1", topicId: "t1", stem: "Q1", options: ["A", "B"], difficulty: "easy" as const, tags: [], correctIndex: 0 },
  { id: "q2", subjectId: "s1", topicId: "t2", stem: "Q2", options: ["A", "B"], difficulty: "medium" as const, tags: [], correctIndex: 1 },
];

class StubAnalyticsRepository implements AnalyticsRepository {
  public async getLatestTopicMastery(_userId: string) {
    return [
      { topicId: "t1", subjectId: "s1", mastery: 38.83, confidence: "medium" as const },
      { topicId: "t2", subjectId: "s1", mastery: 72.2, confidence: "high" as const },
    ];
  }

  public async getWeakTopicIds(_userId: string) {
    return ["t1"];
  }

  public async getOpenRevisionTasks(_userId: string) {
    return [
      { taskId: "rt-past", topicId: "t1", dueAt: "2026-03-01T00:00:00.000Z" },
      { taskId: "rt-future", topicId: "t2", dueAt: "2099-01-01T00:00:00.000Z" },
    ];
  }
}

describe("analytics api", () => {
  it("serves summary, topics, and due revision contracts", async () => {
    const { service: assessmentService } = createInMemoryAssessmentService(questionPool);
    const analyticsService = new AnalyticsService({ repository: new StubAnalyticsRepository() });
    const { app } = await createApp({
      authStore: new InMemoryAuthStore(),
      assessmentService,
      analyticsService,
      envOverrides: testEnv,
    });

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "analytics@example.com", password: "Password123" },
    });
    expect(register.statusCode).toBe(201);
    const setCookieHeader = register.headers["set-cookie"];
    const cookieValues = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const cookieHeader = cookieValues
      .flatMap((value) => (typeof value === "string" ? [value] : []))
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookieHeader).toContain("accessToken=");

    const summary = await app.inject({
      method: "GET",
      url: "/v1/analytics/summary",
      headers: { cookie: cookieHeader },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().data.globalMastery).toBe(55.52);
    expect(summary.json().data.globalSkillBand).toBe("Developing");
    expect(summary.json().data.subjects).toEqual([
      { subjectId: "s1", mastery: 55.52, skillBand: "Developing" },
    ]);

    const topics = await app.inject({
      method: "GET",
      url: "/v1/analytics/topics",
      headers: { cookie: cookieHeader },
    });
    expect(topics.statusCode).toBe(200);
    expect(topics.json().data).toEqual([
      {
        topicId: "t1",
        mastery: 38.83,
        skillBand: "Emerging",
        confidence: "medium",
        isWeak: true,
        frequencyScore: 1,
        priorityScore: 61,
      },
      {
        topicId: "t2",
        mastery: 72.2,
        skillBand: "Proficient",
        confidence: "high",
        isWeak: false,
        frequencyScore: 1,
        priorityScore: 28,
      },
    ]);

    const due = await app.inject({
      method: "GET",
      url: "/v1/revision/due",
      headers: { cookie: cookieHeader },
    });
    expect(due.statusCode).toBe(200);
    expect(due.json().data).toEqual([
      {
        taskId: "rt-past",
        topicId: "t1",
        dueAt: "2026-03-01T00:00:00.000Z",
      },
    ]);

    await app.close();
  });

  it("rejects analytics access without bearer token", async () => {
    const { service: assessmentService } = createInMemoryAssessmentService(questionPool);
    const analyticsService = new AnalyticsService({ repository: new StubAnalyticsRepository() });
    const { app } = await createApp({
      authStore: new InMemoryAuthStore(),
      assessmentService,
      analyticsService,
      envOverrides: testEnv,
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/analytics/summary",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("AUTH_MISSING_TOKEN");
    await app.close();
  });
});
