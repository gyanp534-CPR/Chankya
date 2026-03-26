import { describe, expect, it } from "vitest";
import { computeMasteryResults } from "../../src/core/mastery/mastery-engine.js";
import type { TopicSignal } from "../../src/core/mastery/types.js";

function signal(input: Partial<TopicSignal>): TopicSignal {
  return {
    topicId: input.topicId ?? "t1",
    correct: input.correct ?? true,
    difficulty: input.difficulty ?? "medium",
    answeredAt: input.answeredAt ?? new Date("2026-03-03T00:00:00.000Z"),
    attemptId: input.attemptId ?? "a1",
    totalQuestions: input.totalQuestions ?? 10,
    attemptedCount: input.attemptedCount ?? 8,
    incorrectCount: input.incorrectCount ?? 2,
  };
}

describe("computeMasteryResults", () => {
  it("produces deterministic topic mastery outputs", () => {
    const input: TopicSignal[] = [
      signal({ topicId: "t1", attemptId: "a1", correct: true, difficulty: "easy" }),
      signal({ topicId: "t1", attemptId: "a1", correct: false, difficulty: "hard" }),
      signal({ topicId: "t1", attemptId: "a2", correct: true, difficulty: "medium" }),
      signal({ topicId: "t2", attemptId: "b1", correct: true, difficulty: "hard" }),
      signal({ topicId: "t2", attemptId: "b1", correct: true, difficulty: "medium" }),
    ];

    const asOf = new Date("2026-03-04T00:00:00.000Z");
    const a = computeMasteryResults({ signals: input, options: { asOf } });
    const b = computeMasteryResults({ signals: input, options: { asOf } });

    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    for (const result of a) {
      expect(result.knowledgeScore).toBeGreaterThanOrEqual(0);
      expect(result.knowledgeScore).toBeLessThanOrEqual(100);
      expect(result.riskScore).toBeGreaterThanOrEqual(0.5);
      expect(result.riskScore).toBeLessThanOrEqual(1);
      expect(result.finalMastery).toBeGreaterThanOrEqual(0);
      expect(result.finalMastery).toBeLessThanOrEqual(100);
    }
  });
});
