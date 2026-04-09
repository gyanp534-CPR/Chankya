import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../../shared/errors/error-codes.js";
import { ok } from "../../../shared/envelope/http.js";
import { APP_CONSTANTS } from "../../../config/constants.js";
import type { AuthService } from "../domain/auth-service.js";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8).max(72);

const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const requestOtpSchema = z.object({
  email: emailSchema,
});

const verifyOtpSignupSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().regex(/^\d{6}$/),
  password: passwordSchema,
});

const authRateLimit = {
  max: APP_CONSTANTS.authRateLimitMax,
  timeWindow: APP_CONSTANTS.authRateLimitWindow,
};

type AuthRouteOptions = {
  secureCookies?: boolean;
};

function setAuthCookies(
  reply: {
    setCookie: (
      name: string,
      value: string,
      options: { httpOnly: boolean; secure: boolean; sameSite: "lax" | "none"; path: string; maxAge: number },
    ) => unknown;
  },
  tokens: { accessToken: string; refreshToken: string },
  secureCookies: boolean,
): void {
  // Cross-origin frontend/backend deployments require SameSite=None + Secure.
  const sameSite: "lax" | "none" = secureCookies ? "none" : "lax";
  reply.setCookie("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite,
    path: "/",
    maxAge: 60 * 15,
  });

  reply.setCookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

function getBearerToken(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(ERROR_CODES.authMissingToken, "Authorization token is missing.", 401);
  }

  return authorization.slice("Bearer ".length);
}

export const authRoutes = (authService: AuthService, options: AuthRouteOptions = {}): FastifyPluginAsync => {
  const secureCookies = options.secureCookies ?? false;
  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.post("/register", async (request, reply) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid register payload.", 400, parsed.error.flatten());
      }

      const result = await authService.register(parsed.data.email, parsed.data.password);
      setAuthCookies(reply, result.tokens, secureCookies);
      return reply.code(201).send(
        ok({
          user: result.user,
          tokens: result.tokens,
        }),
      );
    });

    fastify.post("/login", { config: { rateLimit: authRateLimit } }, async (request, reply) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid login payload.", 400, parsed.error.flatten());
      }

      const result = await authService.login(parsed.data.email, parsed.data.password);
      setAuthCookies(reply, result.tokens, secureCookies);
      return reply.send(
        ok({
          user: result.user,
          tokens: result.tokens,
        }),
      );
    });

    fastify.post("/signup/request-otp", { config: { rateLimit: authRateLimit } }, async (request) => {
      const parsed = requestOtpSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid signup OTP request payload.", 400, parsed.error.flatten());
      }

      const result = await authService.requestSignupOtp(parsed.data.email);
      return ok(result);
    });

    fastify.post("/signup/verify-otp", { config: { rateLimit: authRateLimit } }, async (request, reply) => {
      const parsed = verifyOtpSignupSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid signup OTP verification payload.", 400, parsed.error.flatten());
      }

      const result = await authService.verifySignupOtpAndRegister(parsed.data);
      setAuthCookies(reply, result.tokens, secureCookies);
      return reply.code(201).send(
        ok({
          user: result.user,
          tokens: result.tokens,
        }),
      );
    });

    fastify.post("/refresh", async (request) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid refresh payload.", 400, parsed.error.flatten());
      }

      const result = await authService.refresh(parsed.data.refreshToken);
      return ok({
        user: result.user,
        tokens: result.tokens,
      });
    });

    fastify.post("/logout", async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid logout payload.", 400, parsed.error.flatten());
      }

      await authService.logout(parsed.data.refreshToken);
      return reply.code(204).send();
    });

    fastify.get("/me", async (request) => {
      const token = getBearerToken(request.headers.authorization);
      const payload = authService.verifyAccessToken(token);
      const user = await authService.me(payload.sub);
      return ok({ user });
    });

    fastify.get("/protected", async (request) => {
      const token = getBearerToken(request.headers.authorization);
      const payload = authService.verifyAccessToken(token);
      return ok({ userId: payload.sub, role: payload.role });
    });

    fastify.get("/admin/signups", async (request) => {
      const adminKey = process.env.ADMIN_METRICS_KEY;
      if (!adminKey) {
        throw new AppError(ERROR_CODES.internalServerError, "Admin metrics key is not configured.", 503);
      }

      const providedHeader = request.headers["x-admin-key"];
      const provided = Array.isArray(providedHeader) ? providedHeader[0] : providedHeader;
      if (provided !== adminKey) {
        throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid admin key.", 403);
      }

      const totalUsers = await fastify.prisma.users.count({
        where: { deletedAt: null },
      });

      const dailyRows = await fastify.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Users"
        WHERE "deletedAt" IS NULL
        GROUP BY DATE("createdAt")
        ORDER BY day DESC
        LIMIT 30
      `;

      return ok({
        totalUsers,
        dailySignups: dailyRows.map((row) => ({
          day: row.day.toISOString().slice(0, 10),
          count: Number(row.count),
        })),
      });
    });
  };

  return plugin;
};
