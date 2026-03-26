import { describe, expect, it } from "vitest";
import { computeKnowledgeScore } from "../../src/core/mastery/ks.js";
import type { TopicSignal } from "../../src/core/mastery/types.js";

function buildSignal(input: Partial<TopicSignal> = {}): TopicSignal {
  return {
    topicId: input.topicId ?? "t1",
    correct: input.correct ?? true,
    difficulty: input.difficulty ?? "medium",
    answeredAt: input.answeredAt ?? new Date("2026-03-01T00:00:00.000Z"),
    attemptId: input.attemptId ?? "a1",
    totalQuestions: input.totalQuestions ?? 10,
    attemptedCount: input.attemptedCount ?? 8,
    incorrectCount: input.incorrectCount ?? 2,
  };
}

describe("computeKnowledgeScore", () => {
  it("returns bounded score and metadata", () => {
    const asOf = new Date("2026-03-04T00:00:00.000Z");
    const signals: TopicSignal[] = [
      buildSignal({ correct: true, difficulty: "easy", attemptId: "a1" }),
      buildSignal({ correct: false, difficulty: "medium", attemptId: "a1" }),
      buildSignal({ correct: true, difficulty: "hard", attemptId: "a2", answeredAt: new Date("2026-03-03T00:00:00.000Z") }),
      buildSignal({ correct: false, difficulty: "hard", attemptId: "a2", answeredAt: new Date("2026-03-03T00:00:00.000Z") }),
    ];

    const result = computeKnowledgeScore(signals, { asOf });
    expect(result.knowledgeScore).toBeGreaterThanOrEqual(0);
    expect(result.knowledgeScore).toBeLessThanOrEqual(100);
    expect(result.dataPointsUsed).toBe(4);
    expect(result.recencyDensity).toBe(1);
  });

  it("weights recent signals higher than old signals", () => {
    const asOf = new Date("2026-03-04T00:00:00.000Z");
    const recentCorrect = buildSignal({
      correct: true,
      difficulty: "hard",
      attemptId: "a2",
      answeredAt: new Date("2026-03-03T00:00:00.000Z"),
    });
    const oldIncorrect = buildSignal({
      correct: false,
      difficulty: "hard",
      attemptId: "a1",
      answeredAt: new Date("2025-12-01T00:00:00.000Z"),
    });

    const withDecay = computeKnowledgeScore([recentCorrect, oldIncorrect], { asOf, lambda: 0.03 });
    const withoutDecay = computeKnowledgeScore([recentCorrect, oldIncorrect], { asOf, lambda: 0 });
    expect(withDecay.knowledgeScore).toBeGreaterThan(withoutDecay.knowledgeScore);
  });
});
