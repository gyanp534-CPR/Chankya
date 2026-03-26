export { assessmentRoutes } from "./api/routes.js";
export { AssessmentService } from "./domain/assessment-service.js";
export { scoreAttempt } from "./domain/scoring.js";
export { assembleDeterministicTest } from "./domain/test-assembly.js";
export type {
  AttemptRepository,
  EventRepository,
  QuestionRepository,
  TestSetRepository,
} from "./domain/types.js";
export {
  PrismaAttemptRepository,
  PrismaEventRepository,
  PrismaQuestionRepository,
  PrismaTestSetRepository,
} from "./infra/prisma-assessment-repositories.js";
