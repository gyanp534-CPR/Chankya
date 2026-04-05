import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { AuthService } from "../../src/core/auth/domain/auth-service.js";
import { InMemoryAuthStore } from "../fixtures/in-memory-auth-store.js";

function encode(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decode<T>(token: string): T {
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as T;
}

describe("auth jwt and refresh rotation", () => {
  it("issues access and rotates refresh token", async () => {
    const store = new InMemoryAuthStore();
    let seq = 0;
    const jwt = {
      sign: (payload: Record<string, unknown>) => {
        seq += 1;
        return encode({ ...payload, seq });
      },
      verify: <T>(token: string) => decode<T>(token),
    };

    const service = new AuthService({
      store,
      jwt,
      accessTtl: "15m",
      refreshTtl: "7d",
      otpMailer: {
        sendSignupOtp: async () => undefined,
      },
    });

    const register = await service.register("test@example.com", "Password123");
    const meFromToken = service.verifyAccessToken(register.tokens.accessToken);
    expect(meFromToken.sub).toBe(register.user.id);

    const refreshed = await service.refresh(register.tokens.refreshToken);
    expect(refreshed.tokens.refreshToken).not.toEqual(register.tokens.refreshToken);

    await expect(service.refresh(register.tokens.refreshToken)).rejects.toThrowError();
  });
});
