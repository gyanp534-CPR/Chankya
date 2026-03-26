import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../shared/errors/error-codes.js";
import { ok } from "../../shared/envelope/http.js";
import type { AnalyticsService } from "./analytics-service.js";

function getBearerToken(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(ERROR_CODES.authMissingToken, "Authorization token is missing.", 401);
  }

  return authorization.slice("Bearer ".length);
}

function getAccessToken(request: {
  headers: { authorization?: string };
  cookies?: Record<string, string | undefined>;
}): string {
  if (request.headers.authorization?.startsWith("Bearer ")) {
    return getBearerToken(request.headers.authorization);
  }

  const cookieToken = request.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  throw new AppError(ERROR_CODES.authMissingToken, "Authorization token is missing.", 401);
}

function getAuthenticatedUserId(request: {
  headers: { authorization?: string };
  cookies?: Record<string, string | undefined>;
  server: { jwt: { verify: <T>(token: string) => T } };
}): string {
  const token = getAccessToken(request);
  try {
    const payload = request.server.jwt.verify<{ sub: string; type: string }>(token);
    if (payload.type !== "access") {
      throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid access token type.", 401);
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid access token.", 401);
  }
}

export const analyticsRoutes = (analyticsService: AnalyticsService): FastifyPluginAsync => {
  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.get("/analytics/summary", async (request) => {
      const userId = getAuthenticatedUserId(request);
      const result = await analyticsService.getSummary(userId);
      return ok(result, { requestId: request.requestId });
    });

    fastify.get("/analytics/topics", async (request) => {
      const userId = getAuthenticatedUserId(request);
      const result = await analyticsService.getTopics(userId);
      return ok(result, { requestId: request.requestId });
    });

    fastify.get("/revision/due", async (request) => {
      const userId = getAuthenticatedUserId(request);
      const result = await analyticsService.getRevisionDue(userId, new Date());
      return ok(result, { requestId: request.requestId });
    });
  };

  return plugin;
};
