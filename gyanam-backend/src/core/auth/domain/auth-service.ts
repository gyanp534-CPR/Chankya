import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyJWT } from "@fastify/jwt";
import type { AuthUser } from "../../../shared/types/auth.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { ERROR_CODES } from "../../../shared/errors/error-codes.js";
import { APP_CONSTANTS } from "../../../config/constants.js";
import { compareSecret, hashSecret } from "./hash.js";
import type { AuthStore } from "../infra/auth-store.js";
import type { OtpMailer } from "./otp-mailer.js";

type TokenPayload = {
  sub: string;
  type: "access" | "refresh";
  role?: string;
  sessionId?: string;
  jti?: string;
};

type JwtSigner = {
  sign(payload: TokenPayload, options?: { expiresIn?: string }): string;
  verify<T = unknown>(token: string): T;
};

export type AuthServiceDeps = {
  store: AuthStore;
  jwt: JwtSigner;
  accessTtl: string;
  refreshTtl: string;
  otpMailer: OtpMailer;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export class AuthService {
  private static readonly SIGNUP_OTP_LENGTH = 6;
  private static readonly SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;
  private static readonly SIGNUP_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
  private static readonly SIGNUP_OTP_MAX_ATTEMPTS = 5;

  public constructor(private readonly deps: AuthServiceDeps) {}

  public async register(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const existing = await this.deps.store.findUserByEmail(email);
    if (existing) {
      throw new AppError(ERROR_CODES.authEmailInUse, "Email already in use.", 409);
    }

    const passwordHash = await hashSecret(password);
    const user = await this.deps.store.createUser({
      email,
      passwordHash,
      role: "student",
    });

    const tokens = await this.issueSessionTokens(user.id);
    return { user, tokens };
  }

  public async login(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await this.deps.store.findUserByEmail(email);
    if (!user) {
      throw new AppError(ERROR_CODES.authInvalidCredentials, "Invalid credentials.", 401);
    }

    const valid = await compareSecret(password, user.passwordHash);
    if (!valid) {
      throw new AppError(ERROR_CODES.authInvalidCredentials, "Invalid credentials.", 401);
    }

    const tokens = await this.issueSessionTokens(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  public async refresh(refreshToken: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await this.deps.store.findSessionById(payload.sessionId);

    if (!session) {
      throw new AppError(ERROR_CODES.authSessionNotFound, "Session not found.", 401);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.deps.store.deleteSession(session.id);
      throw new AppError(ERROR_CODES.authRefreshExpired, "Refresh token expired.", 401);
    }

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    if (!this.refreshHashMatches(refreshTokenHash, session.refreshTokenHash)) {
      await this.deps.store.deleteSession(session.id);
      throw new AppError(ERROR_CODES.authRefreshRevoked, "Refresh token revoked.", 401);
    }

    const user = await this.deps.store.findUserById(payload.sub);
    if (!user) {
      throw new AppError(ERROR_CODES.authUserNotFound, "User not found.", 401);
    }

    const tokens = await this.rotateSessionTokens(user.id, session.id);
    return { user, tokens };
  }

  public async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.deps.store.deleteSession(payload.sessionId);
  }

  public async me(userId: string): Promise<AuthUser> {
    const user = await this.deps.store.findUserById(userId);
    if (!user) {
      throw new AppError(ERROR_CODES.authUserNotFound, "User not found.", 404);
    }

    return user;
  }

  public verifyAccessToken(accessToken: string): { sub: string; role: string } {
    try {
      const payload = this.deps.jwt.verify<{ sub: string; role: string; type: string }>(accessToken);
      if (payload.type !== "access") {
        throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid access token type.", 401);
      }

      return { sub: payload.sub, role: payload.role };
    } catch {
      throw new AppError(ERROR_CODES.authInvalidAccess, "Invalid access token.", 401);
    }
  }

  private async issueSessionTokens(userId: string): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const accessToken = this.deps.jwt.sign({ sub: userId, type: "access", role: "student" }, { expiresIn: this.deps.accessTtl });
    const refreshToken = this.deps.jwt.sign({ sub: userId, type: "refresh", sessionId, jti: randomUUID() }, { expiresIn: this.deps.refreshTtl });
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await this.deps.store.createSession({
      id: sessionId,
      userId,
      refreshTokenHash,
      expiresAt: this.calculateRefreshExpiry(),
    });

    return { accessToken, refreshToken };
  }

  private async rotateSessionTokens(userId: string, sessionId: string): Promise<AuthTokens> {
    const accessToken = this.deps.jwt.sign({ sub: userId, type: "access", role: "student" }, { expiresIn: this.deps.accessTtl });
    const refreshToken = this.deps.jwt.sign({ sub: userId, type: "refresh", sessionId, jti: randomUUID() }, { expiresIn: this.deps.refreshTtl });
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await this.deps.store.updateSessionHash(sessionId, refreshTokenHash, this.calculateRefreshExpiry());

    return { accessToken, refreshToken };
  }

  private verifyRefreshToken(token: string): { sub: string; sessionId: string } {
    try {
      const payload = this.deps.jwt.verify<{ sub: string; sessionId: string; type: string }>(token);
      if (payload.type !== "refresh" || !payload.sessionId) {
        throw new AppError(ERROR_CODES.authInvalidRefresh, "Invalid refresh token type.", 401);
      }

      return { sub: payload.sub, sessionId: payload.sessionId };
    } catch {
      throw new AppError(ERROR_CODES.authInvalidRefresh, "Invalid refresh token.", 401);
    }
  }

  private calculateRefreshExpiry(): Date {
    const sevenDaysMs = APP_CONSTANTS.refreshSessionTtlMs;
    return new Date(Date.now() + sevenDaysMs);
  }

  public async requestSignupOtp(email: string): Promise<{ expiresInSeconds: number }> {
    const existingUser = await this.deps.store.findUserByEmail(email);
    if (existingUser) {
      throw new AppError(ERROR_CODES.authEmailInUse, "Email already in use.", 409);
    }

    const now = new Date();
    const latest = await this.deps.store.findLatestActiveSignupOtpChallenge(email, now);
    if (latest && now.getTime() - latest.createdAt.getTime() < AuthService.SIGNUP_OTP_RESEND_COOLDOWN_MS) {
      throw new AppError(ERROR_CODES.authRateLimited, "Please wait before requesting another OTP.", 429);
    }

    const otp = this.generateNumericOtp(AuthService.SIGNUP_OTP_LENGTH);
    const otpHash = this.hashRefreshToken(otp);
    const expiresAt = new Date(now.getTime() + AuthService.SIGNUP_OTP_TTL_MS);

    await this.deps.store.createSignupOtpChallenge({
      email,
      otpHash,
      expiresAt,
    });

    await this.deps.otpMailer.sendSignupOtp({
      email,
      otp,
      expiresInMinutes: Math.floor(AuthService.SIGNUP_OTP_TTL_MS / (60 * 1000)),
    });

    return { expiresInSeconds: Math.floor(AuthService.SIGNUP_OTP_TTL_MS / 1000) };
  }

  public async verifySignupOtpAndRegister(input: {
    email: string;
    otp: string;
    password: string;
  }): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const existingUser = await this.deps.store.findUserByEmail(input.email);
    if (existingUser) {
      throw new AppError(ERROR_CODES.authEmailInUse, "Email already in use.", 409);
    }

    const now = new Date();
    const challenge = await this.deps.store.findLatestActiveSignupOtpChallenge(input.email, now);
    if (!challenge) {
      throw new AppError(ERROR_CODES.authInvalidCredentials, "OTP expired or invalid.", 401);
    }

    if (challenge.attempts >= AuthService.SIGNUP_OTP_MAX_ATTEMPTS) {
      await this.deps.store.consumeSignupOtpChallenge(challenge.id);
      throw new AppError(ERROR_CODES.authInvalidCredentials, "OTP expired or invalid.", 401);
    }

    const providedOtpHash = this.hashRefreshToken(input.otp);
    const validOtp = this.refreshHashMatches(providedOtpHash, challenge.otpHash);

    if (!validOtp) {
      await this.deps.store.incrementSignupOtpAttempts(challenge.id);
      throw new AppError(ERROR_CODES.authInvalidCredentials, "OTP expired or invalid.", 401);
    }

    await this.deps.store.consumeSignupOtpChallenge(challenge.id);
    return this.register(input.email, input.password);
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private generateNumericOtp(length: number): string {
    let otp = "";
    for (let i = 0; i < length; i += 1) {
      otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
  }

  private refreshHashMatches(expectedHash: string, actualHash: string): boolean {
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const actualBuffer = Buffer.from(actualHash, "hex");
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role?: string;
      type: "access" | "refresh";
      sessionId?: string;
      jti?: string;
    };
    user: {
      sub: string;
      role?: string;
      type: "access" | "refresh";
      sessionId?: string;
      jti?: string;
    };
  }
}
