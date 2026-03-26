import { describe, expect, it } from "vitest";
import { aggregateConceptPerformance } from "../../src/core/mastery/concept-performance.js";

describe("aggregateConceptPerformance", () => {
  it("aggregates score, attempts, and time per concept", () => {
    const result = aggregateConceptPerformance([
      {
        conceptId: "POL-PAR-004",
        correct: true,
        difficulty: "medium",
        timeSpentSeconds: 15,
        answeredAt: new Date("2026-03-10T10:00:00.000Z"),
      },
      {
        conceptId: "POL-PAR-004",
        correct: false,
        difficulty: "hard",
        timeSpentSeconds: 75,
        answeredAt: new Date("2026-03-10T10:05:00.000Z"),
      },
      {
        conceptId: "ECO-MON-003",
        correct: true,
        difficulty: "easy",
        timeSpentSeconds: 30,
        answeredAt: new Date("2026-03-10T10:03:00.000Z"),
      },
    ]);

    expect(result).toHaveLength(2);

    const polity = result.find((item) => item.conceptId === "POL-PAR-004");
    expect(polity).toEqual({
      conceptId: "POL-PAR-004",
      scoreDelta: -1,
      attemptsDelta: 2,
      correctAttemptsDelta: 1,
      incorrectAttemptsDelta: 1,
      averageTimeSeconds: 45,
      lastAnsweredAt: new Date("2026-03-10T10:05:00.000Z"),
    });

    const economy = result.find((item) => item.conceptId === "ECO-MON-003");
    expect(economy).toEqual({
      conceptId: "ECO-MON-003",
      scoreDelta: 1,
      attemptsDelta: 1,
      correctAttemptsDelta: 1,
      incorrectAttemptsDelta: 0,
      averageTimeSeconds: 30,
      lastAnsweredAt: new Date("2026-03-10T10:03:00.000Z"),
    });
  });
});
