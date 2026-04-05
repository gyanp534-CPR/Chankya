import type { AuthUser, Session } from "@shared/types/auth.js";
import type { UserRole } from "@shared/types/role.js";

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  role: UserRole;
};

export type CreateSessionInput = {
  id?: string;
  userId: string;
  refreshTokenHash: string;
  deviceMeta?: string | null;
  expiresAt: Date;
};

export type AuthStore = {
  createUser(input: CreateUserInput): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createSession(input: CreateSessionInput): Promise<Session>;
  findSessionById(id: string): Promise<Session | null>;
  updateSessionHash(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  createSignupOtpChallenge(input: { email: string; otpHash: string; expiresAt: Date }): Promise<void>;
  findLatestActiveSignupOtpChallenge(email: string, now: Date): Promise<{
    id: string;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    createdAt: Date;
  } | null>;
  incrementSignupOtpAttempts(challengeId: string): Promise<void>;
  consumeSignupOtpChallenge(challengeId: string): Promise<void>;
};
