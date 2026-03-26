import type { AttemptResponse, Question } from "@gyanam/shared";
import { describe, expect, it } from "vitest";
import { scoreAttempt } from "../../src/core/assessment/domain/scoring.js";

describe("scoreAttempt", () => {
  it("scores correct, incorrect, and unattempted with negative marking", () => {
    const questions: Question[] = [
      { id: "q1", topicId: "t1", stem: "Q1", options: ["A", "B"], difficulty: "easy", tags: ["correct:1"] },
      { id: "q2", topicId: "t1", stem: "Q2", options: ["A", "B"], difficulty: "medium", tags: ["correct:0"] },
      { id: "q3", topicId: "t1", stem: "Q3", options: ["A", "B"], difficulty: "hard", tags: ["correct:0"] },
    ];

    const responses: AttemptResponse[] = [
      { questionId: "q1", selectedIndex: 1, timeSpentSeconds: 40 },
      { questionId: "q2", selectedIndex: 1, timeSpentSeconds: 20 },
      { questionId: "q3", selectedIndex: null, timeSpentSeconds: 10 },
    ];

    const result = scoreAttempt(questions, responses);
    expect(result.rawScore).toBe(1.34);
    expect(result.maxScore).toBe(6);
    expect(result.totalQuestions).toBe(3);
    expect(result.attemptedCount).toBe(2);
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it("ignores questions without answer key metadata", () => {
    const questions: Question[] = [
      { id: "q1", topicId: "t1", stem: "Q1", options: ["A", "B"], difficulty: "easy", tags: [] },
    ];

    const responses: AttemptResponse[] = [{ questionId: "q1", selectedIndex: 1, timeSpentSeconds: 5 }];
    const result = scoreAttempt(questions, responses);
    expect(result.rawScore).toBe(0);
    expect(result.maxScore).toBe(2);
  });

  it("uses internal correctIndex fallback when present", () => {
    const questions = [
      {
        id: "q1",
        topicId: "t1",
        stem: "Q1",
        options: ["A", "B"],
        difficulty: "easy" as const,
        tags: [],
        correctIndex: 0,
      },
    ];

    const responses: AttemptResponse[] = [{ questionId: "q1", selectedIndex: 0, timeSpentSeconds: 7 }];
    const result = scoreAttempt(questions, responses);
    expect(result.rawScore).toBe(2);
  });
});
