import { describe, expect, it } from "vitest";
import { SeededRng } from "../../src/shared/random/seeded-rng.js";

describe("seeded rng", () => {
  it("produces deterministic sequence for same seed", () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);

    const seqA = [a.nextInt(1, 100), a.nextInt(1, 100), a.nextInt(1, 100)];
    const seqB = [b.nextInt(1, 100), b.nextInt(1, 100), b.nextInt(1, 100)];

    expect(seqA).toEqual(seqB);
  });

  it("shuffles deterministically with same seed", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const a = new SeededRng(123);
    const b = new SeededRng(123);

    expect(a.shuffle(input)).toEqual(b.shuffle(input));
  });
});
