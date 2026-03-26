export const ERROR_CODES = {
  internalServerError: "INTERNAL_SERVER_ERROR",
  authMissingToken: "AUTH_MISSING_TOKEN",
  authInvalidPayload: "AUTH_INVALID_PAYLOAD",
  authEmailInUse: "AUTH_EMAIL_IN_USE",
  authInvalidCredentials: "AUTH_INVALID_CREDENTIALS",
  authSessionNotFound: "AUTH_SESSION_NOT_FOUND",
  authRefreshExpired: "AUTH_REFRESH_EXPIRED",
  authRefreshRevoked: "AUTH_REFRESH_REVOKED",
  authUserNotFound: "AUTH_USER_NOT_FOUND",
  authInvalidAccess: "AUTH_INVALID_ACCESS",
  authInvalidRefresh: "AUTH_INVALID_REFRESH",
  authRateLimited: "AUTH_RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
