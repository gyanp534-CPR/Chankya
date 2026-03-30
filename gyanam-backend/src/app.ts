import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { authRoutes, AuthService, PrismaAuthStore, type AuthStore } from "./core/auth/index.js";
import {
  assessmentRoutes,
  AssessmentService,
  PrismaAttemptRepository,
  PrismaEventRepository,
  PrismaQuestionRepository,
  PrismaTestSetRepository,
} from "./core/assessment/index.js";
import {
  ConceptPerformanceService,
  MasteryService,
  NoopConceptPerformanceRepository,
  PrismaConceptPerformanceRepository,
  PrismaMasteryRepository,
  PrismaWeakAreaRepository,
} from "./core/mastery/index.js";
import { PrismaRevisionRepository } from "./core/revision/index.js";
import { analyticsRoutes, AnalyticsService, NoopAnalyticsRepository, PrismaAnalyticsRepository } from "./core/analytics/index.js";
import {
  errorEngineRoutes,
  ErrorEngineService,
  loadErrorGraph,
  PrismaErrorEngineRepository,
} from "./core/error-engine/index.js";
import { loadEnv, type Env } from "./config/env.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { prismaPlugin } from "./plugins/prisma.js";
import requestIdPlugin from "./plugins/request-id.js";
import { APP_CONSTANTS } from "./config/constants.js";
import { ERROR_CODES } from "./shared/errors/error-codes.js";
import { fail, ok } from "./shared/envelope/http.js";
import { AppError } from "./shared/errors/app-error.js";

export type CreateAppOptions = {
  authStore?: AuthStore;
  assessmentService?: AssessmentService;
  masteryService?: MasteryService;
  analyticsService?: AnalyticsService;
  errorEngineService?: ErrorEngineService;
  envOverrides?: Partial<Record<keyof Env, string | number>>;
};

export async function createApp(options: CreateAppOptions = {}) {
  const env = loadEnv(options.envOverrides);
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : true,
    disableRequestLogging: env.NODE_ENV === "test",
  });

  const corsOrigins = env.CORS_ORIGIN
    .split(",")
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter((value) => value.length > 0);

  const corsMatchers = corsOrigins
    .filter((value) => value.includes("*"))
    .map((value) => new RegExp(`^${value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`));

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes("*")) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (corsMatchers.some((regex) => regex.test(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-guest-id"],
  });
  await app.register(cookie);
  await app.register(helmet);
  await app.register(sensible);
  await app.register(requestIdPlugin);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: ERROR_CODES.authRateLimited,
        message: `Rate limit exceeded. Retry in ${context.after}.`,
      },
    }),
    max: APP_CONSTANTS.authRateLimitMax,
    timeWindow: APP_CONSTANTS.authRateLimitWindow,
  });
  const needsPrisma = !options.authStore || !options.assessmentService;
  if (needsPrisma) {
    await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  }
  await app.register(jwtPlugin, { jwtSecret: env.JWT_SECRET });

  const authStore = options.authStore ?? new PrismaAuthStore(app.prisma);
  const masteryService =
    options.masteryService ??
    (needsPrisma
      ? new MasteryService({
          repository: new PrismaMasteryRepository(app.prisma),
          weakAreas: new PrismaWeakAreaRepository(app.prisma),
          revision: new PrismaRevisionRepository(app.prisma),
        })
      : undefined);
  const conceptPerformanceService =
    needsPrisma
      ? new ConceptPerformanceService({
          repository: new PrismaConceptPerformanceRepository(app.prisma),
        })
      : new ConceptPerformanceService({
          repository: new NoopConceptPerformanceRepository(),
        });
  const errorEngineService =
    options.errorEngineService ??
    (needsPrisma
      ? new ErrorEngineService({
          repository: new PrismaErrorEngineRepository(app.prisma),
          graph: loadErrorGraph(),
        })
      : undefined);
  if (!errorEngineService) {
    throw new Error("ErrorEngineService is required when prisma is disabled.");
  }
  const assessmentService =
    options.assessmentService ??
    new AssessmentService({
      questions: new PrismaQuestionRepository(app.prisma),
      testSets: new PrismaTestSetRepository(app.prisma),
      attempts: new PrismaAttemptRepository(app.prisma),
      events: new PrismaEventRepository(app.prisma),
      conceptPerformance: conceptPerformanceService,
      mastery: masteryService,
      errorEngine: errorEngineService,
    });
  const analyticsService =
    options.analyticsService ??
    new AnalyticsService({
      repository: needsPrisma ? new PrismaAnalyticsRepository(app.prisma) : new NoopAnalyticsRepository(),
    });
  const authService = new AuthService({
    store: authStore,
    jwt: {
      sign: (payload, signOptions) => app.jwt.sign(payload, signOptions),
      verify: <T>(token: string) => app.jwt.verify(token) as T,
    },
    accessTtl: env.ACCESS_TOKEN_TTL,
    refreshTtl: env.REFRESH_TOKEN_TTL,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.statusCode)
        .send(fail(error.code, error.message, { requestId: request.requestId, details: error.details }));
    }

    app.log.error(error);
    return reply
      .code(500)
      .send(fail(ERROR_CODES.internalServerError, "An unexpected error occurred.", { requestId: request.requestId }));
  });

  app.get("/health", async (request) => ok({ status: "ok" }, { requestId: request.requestId }));

  await app.register(async (v1) => {
    await v1.register(authRoutes(authService, { secureCookies: env.NODE_ENV === "production" }), { prefix: "/auth" });
    await v1.register(assessmentRoutes(assessmentService));
    await v1.register(analyticsRoutes(analyticsService));
    await v1.register(errorEngineRoutes(errorEngineService));
  }, { prefix: "/v1" });

  return { app, env, masteryService, analyticsService };
}
