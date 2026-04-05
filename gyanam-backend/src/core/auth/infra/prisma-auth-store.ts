import type { PrismaClient } from "@prisma/client";
import type { AuthStore, CreateSessionInput, CreateUserInput } from "./auth-store.js";
import type { AuthUser, Session } from "../../../shared/types/auth.js";

function toAuthUser(user: {
  id: string;
  email: string;
  role: "student" | "admin";
  createdAt: Date;
  updatedAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toSession(session: {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceMeta: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): Session {
  return {
    id: session.id,
    userId: session.userId,
    refreshTokenHash: session.refreshTokenHash,
    deviceMeta: session.deviceMeta,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export class PrismaAuthStore implements AuthStore {
  public constructor(private readonly db: PrismaClient) {}

  public async createUser(input: CreateUserInput): Promise<AuthUser> {
    const user = await this.db.users.create({ data: input });
    return toAuthUser(user);
  }

  public async findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | null> {
    const user = await this.db.users.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      return null;
    }

    return {
      ...toAuthUser(user),
      passwordHash: user.passwordHash,
    };
  }

  public async findUserById(id: string): Promise<AuthUser | null> {
    const user = await this.db.users.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      return null;
    }

    return toAuthUser(user);
  }

  public async createSession(input: CreateSessionInput): Promise<Session> {
    const session = await this.db.authSessions.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        deviceMeta: input.deviceMeta ?? null,
        expiresAt: input.expiresAt,
      },
    });

    return toSession(session);
  }

  public async findSessionById(id: string): Promise<Session | null> {
    const session = await this.db.authSessions.findUnique({ where: { id } });
    if (!session) {
      return null;
    }

    return toSession(session);
  }

  public async updateSessionHash(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.authSessions.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        expiresAt,
      },
    });
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.db.authSessions.delete({ where: { id: sessionId } });
  }

  public async createSignupOtpChallenge(input: { email: string; otpHash: string; expiresAt: Date }): Promise<void> {
    await this.db.emailOtpChallenge.create({
      data: {
        email: input.email,
        otpHash: input.otpHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  public async findLatestActiveSignupOtpChallenge(
    email: string,
    now: Date,
  ): Promise<{
    id: string;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    createdAt: Date;
  } | null> {
    const challenge = await this.db.emailOtpChallenge.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        otpHash: true,
        expiresAt: true,
        attempts: true,
        createdAt: true,
      },
    });

    return challenge;
  }

  public async incrementSignupOtpAttempts(challengeId: string): Promise<void> {
    await this.db.emailOtpChallenge.update({
      where: { id: challengeId },
      data: { attempts: { increment: 1 } },
    });
  }

  public async consumeSignupOtpChallenge(challengeId: string): Promise<void> {
    await this.db.emailOtpChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
  }
}
