import type { UserRole } from "./role.js";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceMeta: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
