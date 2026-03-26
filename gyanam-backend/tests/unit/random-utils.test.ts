import { describe, expect, it } from "vitest";
import { seededShuffle } from "../../src/utils/random.js";

describe("seededShuffle", () => {
  it("returns deterministic output for same seed", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const a = seededShuffle(input, 123);
    const b = seededShuffle(input, 123);

    expect(a).toEqual(b);
    expect(a).not.toEqual(input);
  });
});
