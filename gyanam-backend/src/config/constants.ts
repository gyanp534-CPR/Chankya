import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW,
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  MIN_MEANINGFUL_ATTEMPTS,
  REFRESH_SESSION_TTL_MS,
} from "../core/constants.js";

export const APP_CONSTANTS = {
  streakDailyMinimumWeightedAttempts: MIN_MEANINGFUL_ATTEMPTS,
  defaultAccessTokenTtl: JWT_ACCESS_EXPIRY,
  defaultRefreshTokenTtl: JWT_REFRESH_EXPIRY,
  refreshSessionTtlMs: REFRESH_SESSION_TTL_MS,
  authRateLimitWindow: AUTH_RATE_LIMIT_WINDOW,
  authRateLimitMax: AUTH_RATE_LIMIT_MAX,
} as const;
