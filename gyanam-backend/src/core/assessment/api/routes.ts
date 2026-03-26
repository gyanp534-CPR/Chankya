import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../../shared/errors/error-codes.js";
import { ok } from "../../../shared/envelope/http.js";
import type { AssessmentService } from "../domain/assessment-service.js";

const legacyTestAssemblySchema = z.object({
  subjectId: z.string().min(1),
  mode: z.enum(["practice", "exam"]),
  seed: z.number().int(),
  questionCount: z.number().int().min(1).max(200),
  systemAction: z.enum(["increase_difficulty", "maintain_level", "focus_revision", "trigger_recovery"]).optional(),
  userId: z.string().min(1).optional(),
});

const diagnosticAssemblySchema = z.object({
  mode: z.enum(["diagnostic", "diagnostic_mixed"]),
  questionCount: z.number().int().min(1).max(200),
  seed: z.number().int().optional(),
});

const startAttemptSchema = z.object({
  userId: z.string().min(1),
  testId: z.string().min(1),
  startedAt: z.string().datetime().optional(),
});

const submitAttemptSchema = z.object({
  attemptId: z.string().min(1),
  pauseEvents: z.unknown().optional(),
  responses: z.array(
    z.object({
      questionId: z.string().min(1),
      selectedIndex: z.number().int().nullable(),
      timeSpentSeconds: z.number().int().min(0),
    }),
  ),
});

const testSubmitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      selectedIndex: z.number().int().nullable(),
      timeSpentSeconds: z.number().int().min(0).optional(),
    }),
  ),
});

const sessionParamsSchema = z.object({
  attemptId: z.string().min(1),
});

const evaluateAnswerSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  selectedIndex: z.number().int().nullable(),
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

function sanitizeQuestions<T extends object>(questions: T[]): Array<Omit<T, "correctIndex">> {
  return questions.map((question) => {
    const { correctIndex: _ignored, ...rest } = question as T & { correctIndex?: number };
    return rest as Omit<T, "correctIndex">;
  });
}

export const assessmentRoutes = (assessmentService: AssessmentService): FastifyPluginAsync => {
  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.post("/tests/assemble", async (request) => {
      const diagnostic = diagnosticAssemblySchema.safeParse(request.body);
      if (diagnostic.success) {
        const userId = getAuthenticatedUserId(request);
        const result =
          diagnostic.data.mode === "diagnostic_mixed"
            ? await assessmentService.startMixedDiagnosticAttempt({
                userId,
                questionCount: diagnostic.data.questionCount,
                seed: diagnostic.data.seed,
                requestId: request.requestId,
              })
            : await assessmentService.startDiagnosticAttempt({
                userId,
                questionCount: diagnostic.data.questionCount,
                seed: diagnostic.data.seed,
                requestId: request.requestId,
              });

        return ok(
          {
            ...result,
            questions: sanitizeQuestions(result.questions),
          },
          { requestId: request.requestId },
        );
      }

      const parsed = legacyTestAssemblySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid test assembly payload.", 400, parsed.error.flatten());
      }

      const result = await assessmentService.createTestSet({
        ...parsed.data,
        requestId: request.requestId,
      });

      return ok(
        {
          ...result,
          questions: sanitizeQuestions(result.questions),
        },
        { requestId: request.requestId },
      );
    });

    fastify.get("/tests/session/:attemptId", async (request) => {
      const paramsParsed = sessionParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid session params.", 400, paramsParsed.error.flatten());
      }

      const userId = getAuthenticatedUserId(request);
      const session = await assessmentService.getAttemptSession({
        userId,
        attemptId: paramsParsed.data.attemptId,
      });

      return ok(
        {
          ...session,
          questions: sanitizeQuestions(session.questions),
        },
        { requestId: request.requestId },
      );
    });

    fastify.post("/tests/session/evaluate", async (request) => {
      const parsed = evaluateAnswerSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid evaluate payload.", 400, parsed.error.flatten());
      }

      const userId = getAuthenticatedUserId(request);
      const result = await assessmentService.evaluateAttemptAnswer({
        userId,
        attemptId: parsed.data.attemptId,
        questionId: parsed.data.questionId,
        selectedIndex: parsed.data.selectedIndex,
      });

      return ok(result, { requestId: request.requestId });
    });

    fastify.post("/tests/submit", async (request) => {
      const parsed = testSubmitSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid test submit payload.", 400, parsed.error.flatten());
      }

      const userId = getAuthenticatedUserId(request);
      const result = await assessmentService.submitAttempt({
        attemptId: parsed.data.attemptId,
        userId,
        responses: parsed.data.answers.map((answer) => ({
          questionId: answer.questionId,
          selectedIndex: answer.selectedIndex,
          timeSpentSeconds: answer.timeSpentSeconds ?? 0,
        })),
        requestId: request.requestId,
      });

      return ok(result, { requestId: request.requestId });
    });

    fastify.post("/attempts/start", async (request) => {
      const parsed = startAttemptSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid attempt start payload.", 400, parsed.error.flatten());
      }

      const result = await assessmentService.startAttempt({
        userId: parsed.data.userId,
        testId: parsed.data.testId,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : undefined,
        requestId: request.requestId,
      });

      return ok(result, { requestId: request.requestId });
    });

    fastify.post("/attempts/submit", async (request) => {
      const parsed = submitAttemptSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(ERROR_CODES.authInvalidPayload, "Invalid attempt submit payload.", 400, parsed.error.flatten());
      }

      const result = await assessmentService.submitAttempt({
        attemptId: parsed.data.attemptId,
        responses: parsed.data.responses,
        pauseEvents: parsed.data.pauseEvents,
        requestId: request.requestId,
      });

      return ok(result, { requestId: request.requestId });
    });
  };

  return plugin;
};
