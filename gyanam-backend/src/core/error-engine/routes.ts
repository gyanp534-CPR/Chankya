import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../shared/errors/error-codes.js";
import { ok } from "../../shared/envelope/http.js";
import type { ErrorEngineService } from "./error-engine-service.js";

const attemptSchema = z.object({
  userId: z.string().min(1).optional(),
  attemptId: z.string().min(1).optional(),
  questionId: z.string().min(1),
  isCorrect: z.boolean(),
  errorType: z.string().min(1).optional().nullable(),
});

function getBearerToken(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(ERROR_CODES.authMissingToken, "Authorization token is missing.", 401);
  }

  return authorization.slice("Bearer ".length);
}

function getAccessToken(request: {
  headers: { authorization?: string };
  cookies?: Record<string, string | undefined>;
}): string | null {
  if (request.headers.authorization?.startsWith("Bearer ")) {
    return getBearerToken(request.headers.authorization);
  }

  const cookieToken = request.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

function resolveUserId(request: {
  headers: { authorization?: string };
  cookies?: Record<string, string | undefined>;
  server: { jwt: { verify: <T>(token: string) => T } };
}, fallbackUserId?: string): string {
  const token = getAccessToken(request);
  if (token) {
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

  if (fallbackUserId) {
    return fallbackUserId;
  }

  throw new AppError(ERROR_CODES.authMissingToken, "Authorization token is missing.", 401);
}

export const errorEngineRoutes = (errorEngineService: ErrorEngineService): FastifyPluginAsync => {
  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.post("/attempt", async (request) => {
      const parsed = attemptSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid attempt payload.", 400, parsed.error.flatten());
      }

      const userId = resolveUserId(request, parsed.data.userId);
      const result = await errorEngineService.recordAttempt({
        userId,
        questionId: parsed.data.questionId,
        attemptId: parsed.data.attemptId,
        isCorrect: parsed.data.isCorrect,
        errorType: parsed.data.errorType ?? undefined,
      });

      return ok(result, { requestId: request.requestId });
    });
  };

  return plugin;
};
