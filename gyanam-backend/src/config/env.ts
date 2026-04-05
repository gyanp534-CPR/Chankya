import { z } from "zod";
import { APP_CONSTANTS } from "./constants.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default(APP_CONSTANTS.defaultAccessTokenTtl),
  REFRESH_TOKEN_TTL: z.string().default(APP_CONSTANTS.defaultRefreshTokenTtl),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  ADMIN_METRICS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const FEATURE_WARROOM = process.env.FEATURE_WARROOM === "true";
export const FEATURE_PREMIUM_ANALYTICS = process.env.FEATURE_PREMIUM_ANALYTICS === "true";

export function loadEnv(overrides: Partial<Record<keyof Env, string | number>> = {}): Env {
  const merged = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
    ADMIN_METRICS_KEY: process.env.ADMIN_METRICS_KEY,
    ...overrides,
  };

  return envSchema.parse(merged);
}
