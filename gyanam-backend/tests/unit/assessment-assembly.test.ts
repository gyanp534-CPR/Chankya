import type { Question } from "@gyanam/shared";
import { describe, expect, it } from "vitest";
import { assembleDeterministicTest } from "../../src/core/assessment/domain/test-assembly.js";

const sampleQuestions: Question[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, topicId: "t1", stem: `E${i}`, options: ["A", "B"], difficulty: "easy" as const, tags: ["correct:0"] })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, topicId: "t1", stem: `M${i}`, options: ["A", "B"], difficulty: "medium" as const, tags: ["correct:0"] })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, topicId: "t1", stem: `H${i}`, options: ["A", "B"], difficulty: "hard" as const, tags: ["correct:0"] })),
];

describe("assembleDeterministicTest", () => {
  it("is deterministic for same seed", () => {
    const a = assembleDeterministicTest(sampleQuestions, "exam", 99, 9).map((q) => q.id);
    const b = assembleDeterministicTest(sampleQuestions, "exam", 99, 9).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("changes ordering across different seeds", () => {
    const a = assembleDeterministicTest(sampleQuestions, "exam", 41, 9).map((q) => q.id);
    const b = assembleDeterministicTest(sampleQuestions, "exam", 42, 9).map((q) => q.id);
    expect(a).not.toEqual(b);
  });

  it("balances exam mode difficulty", () => {
    const assembled = assembleDeterministicTest(sampleQuestions, "exam", 11, 9);
    const counts = assembled.reduce(
      (acc, q) => {
        acc[q.difficulty] += 1;
        return acc;
      },
      { easy: 0, medium: 0, hard: 0 },
    );

    expect(counts.easy).toBe(3);
    expect(counts.medium).toBe(3);
    expect(counts.hard).toBe(3);
  });

  it("weights practice mode toward easier questions", () => {
    const assembled = assembleDeterministicTest(sampleQuestions, "practice", 11, 10);
    const counts = assembled.reduce(
      (acc, q) => {
        acc[q.difficulty] += 1;
        return acc;
      },
      { easy: 0, medium: 0, hard: 0 },
    );

    expect(counts.easy).toBeGreaterThanOrEqual(counts.medium);
    expect(counts.medium).toBeGreaterThanOrEqual(counts.hard);
  });
});
