import { randomUUID } from "node:crypto";
import type { AuthStore, CreateSessionInput, CreateUserInput } from "../../src/core/auth/infra/auth-store.js";
import type { AuthUser, Session } from "../../src/shared/types/auth.js";

type UserRecord = AuthUser & { passwordHash: string; deletedAt?: Date | null };

export class InMemoryAuthStore implements AuthStore {
  private readonly usersById = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, Session>();

  public async createUser(input: CreateUserInput): Promise<AuthUser> {
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);

    return this.toAuthUser(user);
  }

  public async findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | null> {
    const user = this.usersByEmail.get(email);
    if (!user || user.deletedAt) {
      return null;
    }

    return {
      ...this.toAuthUser(user),
      passwordHash: user.passwordHash,
    };
  }

  public async findUserById(id: string): Promise<AuthUser | null> {
    const user = this.usersById.get(id);
    if (!user || user.deletedAt) {
      return null;
    }

    return this.toAuthUser(user);
  }

  public async createSession(input: CreateSessionInput): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: input.id ?? randomUUID(),
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      deviceMeta: input.deviceMeta ?? null,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  public async findSessionById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  public async updateSessionHash(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.refreshTokenHash = refreshTokenHash;
    session.expiresAt = expiresAt;
    session.updatedAt = new Date();
    this.sessions.set(sessionId, session);
  }

  public async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  public softDeleteUserByEmail(email: string): void {
    const user = this.usersByEmail.get(email);
    if (!user) {
      return;
    }

    user.deletedAt = new Date();
    user.updatedAt = new Date();
    this.usersById.set(user.id, user);
    this.usersByEmail.set(email, user);
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
