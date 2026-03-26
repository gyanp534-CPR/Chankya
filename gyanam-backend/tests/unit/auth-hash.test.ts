import { describe, expect, it } from "vitest";
import { compareSecret, hashSecret } from "../../src/core/auth/domain/hash.js";

describe("auth hash", () => {
  it("hashes and verifies password", async () => {
    const password = "StrongPass123!";
    const hash = await hashSecret(password);

    expect(hash).not.toEqual(password);
    await expect(compareSecret(password, hash)).resolves.toBe(true);
    await expect(compareSecret("wrong-pass", hash)).resolves.toBe(false);
  });
});
