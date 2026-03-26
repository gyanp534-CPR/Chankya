# ADR-0005: JWT Access + Rotating Refresh Sessions in AuthSessions

- Date: 2026-03-04
- Status: Accepted

## Context
Phase 1 needs secure stateless access auth while retaining server-side revocation and session lifecycle control.

## Decision
Use short-lived access JWT plus rotating refresh tokens persisted in `AuthSessions`.
- Refresh tokens carry `sessionId` and `jti`.
- Stored token representation is hashed (SHA-256).
- Refresh reuse after rotation is rejected and session is revocable.

## Consequences
- Positive: Supports session invalidation and replay resistance.
- Positive: Works for both web and mobile clients under a single auth model.
- Tradeoff: Requires additional session-table reads/writes on refresh flows.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

