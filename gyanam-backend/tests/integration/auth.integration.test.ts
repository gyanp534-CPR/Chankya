import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createInMemoryAssessmentService } from "../fixtures/in-memory-assessment.js";
import { InMemoryAuthStore } from "../fixtures/in-memory-auth-store.js";

const testEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gyanam_test",
  JWT_SECRET: "test-secret-123456789",
};

describe("/v1/auth integration", () => {
  it("exposes /health", async () => {
    const { service } = createInMemoryAssessmentService([]);
    const { app } = await createApp({ authStore: new InMemoryAuthStore(), assessmentService: service, envOverrides: testEnv });
    const response = await app.inject({ method: "GET", url: "/health", headers: { "x-request-id": "req-health-1" } });
    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.headers["x-request-id"]).toBe("req-health-1");
    expect(response.json().meta.requestId).toBe("req-health-1");
    await app.close();
  }, 15_000);

  it("supports register -> login -> me -> refresh -> logout", async () => {
    const { service } = createInMemoryAssessmentService([]);
    const { app } = await createApp({ authStore: new InMemoryAuthStore(), assessmentService: service, envOverrides: testEnv });

    const registerResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "flow@example.com", password: "Password123" },
    });

    expect(registerResponse.statusCode).toBe(201);
    const registerBody = registerResponse.json();
    expect(registerBody.success).toBe(true);
    expect(registerResponse.headers["set-cookie"]).toBeDefined();

    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "flow@example.com", password: "Password123" },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginBody = loginResponse.json();
    expect(loginBody.success).toBe(true);
    expect(loginResponse.headers["set-cookie"]).toBeDefined();

    const accessToken = loginBody.data.tokens.accessToken as string;
    const refreshToken = loginBody.data.tokens.refreshToken as string;

    const meResponse = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(meResponse.statusCode).toBe(200);
    const meBody = meResponse.json();
    expect(meBody.success).toBe(true);
    expect(meBody.data.user.email).toBe("flow@example.com");

    const protectedResponse = await app.inject({
      method: "GET",
      url: "/v1/auth/protected",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(protectedResponse.statusCode).toBe(200);
    expect(protectedResponse.json().success).toBe(true);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshBody = refreshResponse.json();
    expect(refreshBody.success).toBe(true);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      payload: { refreshToken: refreshBody.data.tokens.refreshToken },
    });

    expect(logoutResponse.statusCode).toBe(204);
    await app.close();
  });

  it("returns envelope error for invalid access token", async () => {
    const { service } = createInMemoryAssessmentService([]);
    const { app } = await createApp({ authStore: new InMemoryAuthStore(), assessmentService: service, envOverrides: testEnv });

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: "Bearer invalid" },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_INVALID_ACCESS");

    await app.close();
  });

  it("rejects revoked refresh token", async () => {
    const { service } = createInMemoryAssessmentService([]);
    const { app } = await createApp({ authStore: new InMemoryAuthStore(), assessmentService: service, envOverrides: testEnv });

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "revoke@example.com", password: "Password123" },
    });

    const firstRefreshToken = register.json().data.tokens.refreshToken as string;

    const rotate = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: firstRefreshToken },
    });

    expect(rotate.statusCode).toBe(200);

    const revokedTry = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: firstRefreshToken },
    });

    expect(revokedTry.statusCode).toBe(401);
    expect(revokedTry.json().error.code).toBe("AUTH_REFRESH_REVOKED");

    await app.close();
  });

  it("denies login for soft-deleted users", async () => {
    const store = new InMemoryAuthStore();
    const { service } = createInMemoryAssessmentService([]);
    const { app } = await createApp({ authStore: store, assessmentService: service, envOverrides: testEnv });

    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "deleted@example.com", password: "Password123" },
    });

    store.softDeleteUserByEmail("deleted@example.com");

    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "deleted@example.com", password: "Password123" },
    });

    expect(loginResponse.statusCode).toBe(401);
    expect(loginResponse.json().error.code).toBe("AUTH_INVALID_CREDENTIALS");
    await app.close();
  });
});
