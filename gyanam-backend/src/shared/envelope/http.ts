import type { ErrorCode } from "../errors/error-codes.js";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return { success: true, data, meta };
}

export function fail(code: ErrorCode, message: string, details?: unknown): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}
