# Chankya Architecture Blueprint v0.2

Status: Frozen Execution Spec  
Date: 2026-03-04

This snapshot captures the implemented Sprint 1 baseline:
- Modular monolith backend scaffolding with Fastify + Prisma + PostgreSQL.
- Strict TypeScript and `/v1` route versioning.
- Enforced internal package boundaries (`@core/*`) with lint rules.
- Auth foundation with JWT access/refresh and persisted sessions.
- Test harness for unit + integration + boundary guard.

## Implemented Sprint 1 Scope
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

Response envelope standard:
- Success: `{ success: true, data, meta? }`
- Error: `{ success: false, error: { code, message, details? } }`

## Module Surfaces
- `@core/auth`
- `@core/syllabus`
- `@core/question-bank`
- `@core/assessment`
- `@core/mastery`
- `@core/revision`
- `@core/analytics`
- `@core/instrumentation`

## Snapshot Files
- [Sprint 1 API Contract](./api-contract-auth-v1.md)
- [Phase 1 Schema Snapshot](./phase1-schema-snapshot.md)
- [Phase 1 Schema Diff](./phase1-schema-diff.md)
- [Sprint 1 Notes](./sprint-1-notes.md)

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

