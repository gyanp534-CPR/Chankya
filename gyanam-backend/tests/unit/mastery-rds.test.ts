import { describe, expect, it } from "vitest";
import { computeRiskDisciplineScore } from "../../src/core/mastery/rds.js";
import type { TopicAttemptMetric } from "../../src/core/mastery/types.js";

describe("computeRiskDisciplineScore", () => {
  it("rewards calibrated attempt behavior", () => {
    const calibrated: TopicAttemptMetric[] = Array.from({ length: 8 }, (_, index) => ({
      attemptId: `a${index}`,
      attemptRatio: 0.8,
      incorrectRate: 0.2,
    }));

    const score = computeRiskDisciplineScore(calibrated);
    expect(score).toBeGreaterThanOrEqual(0.9);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("penalizes reckless over-attempt and high incorrect rates", () => {
    const reckless: TopicAttemptMetric[] = Array.from({ length: 8 }, (_, index) => ({
      attemptId: `r${index}`,
      attemptRatio: 0.98,
      incorrectRate: 0.6,
    }));

    const disciplined: TopicAttemptMetric[] = Array.from({ length: 8 }, (_, index) => ({
      attemptId: `d${index}`,
      attemptRatio: 0.8,
      incorrectRate: 0.2,
    }));

    expect(computeRiskDisciplineScore(reckless)).toBeLessThan(computeRiskDisciplineScore(disciplined));
  });

  it("returns neutral value with no history", () => {
    expect(computeRiskDisciplineScore([])).toBe(0.75);
  });
});
