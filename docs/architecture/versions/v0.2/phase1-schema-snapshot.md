# Phase 1 Schema Snapshot (Sprint 1)

Implemented models:
- `Users`
- `AuthSessions`
- `EntitlementPolicies` (schema-only placeholder)

## Users
- `id` String PK (`cuid()`)
- `email` unique String
- `passwordHash` String
- `role` enum (`student`, `admin`)
- `createdAt`, `updatedAt`, `deletedAt?`

## AuthSessions
- `id` String PK (`cuid()`)
- `userId` FK -> `Users.id`
- `refreshTokenHash` String
- `deviceMeta?` String
- `expiresAt` DateTime
- `createdAt`, `updatedAt`
- Indexes: `userId`, `expiresAt`

## EntitlementPolicies
- `id` String PK (`cuid()`)
- `featureKey` unique String
- `requiredPlan` String
- `isEnabled` Boolean
- `metadata?` Json
- `createdAt`, `updatedAt`, `deletedAt?`

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

