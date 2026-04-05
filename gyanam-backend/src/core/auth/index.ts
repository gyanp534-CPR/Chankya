export { authRoutes } from "./api/routes.js";
export { AuthService } from "./domain/auth-service.js";
export { DevConsoleOtpMailer, SmtpOtpMailer } from "./domain/otp-mailer.js";
export type { AuthStore } from "./infra/auth-store.js";
export { PrismaAuthStore } from "./infra/prisma-auth-store.js";
