# Phase 1 Schema Diff (v0.1 -> v0.2)

## Added
- `Users` model with `UserRole` enum.
- `AuthSessions` model for refresh-token session persistence.
- `EntitlementPolicies` placeholder model for Phase 3 gating.

## Design Notes
- Common field strategy established (`createdAt`, `updatedAt`, optional `deletedAt`).
- Auth refresh tokens are persisted as hashed values.
- Session lifecycle supports rotation and revocation semantics.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

