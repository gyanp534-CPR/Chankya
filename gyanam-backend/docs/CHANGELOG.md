# Backend Changelog

## [v0.5] - 2026-03-25
### Added
- Mentor feedback payload on attempt submission (mode, message, focus, next action).
- Topic label mapping for mentor feedback focus.
- Copy variants (short, medium, long) and error-type hinting in mentor feedback.

### Updated
- Adaptive docs to include mentor feedback output.

## [v0.4] - 2026-03-25
### Added
- Adaptive mentor engine observability: `stateHistory` and `transitionType` in adaptive debug.
- Weak-area topic extraction wired to topic-aware test assembly for `focus_revision`.

### Updated
- Documentation to reflect adaptive targeting + transition tracing.

## [v0.3] - 2026-03-22
### Added
- Tagging rulebook v1.2 and schema split (core vs advanced).
- Tagging core exports for first-release simplicity.
- Derived concept graph outputs (nodes, edges, stats, clusters).
- Documentation index and release notes.
- Project brief and platform documentation placeholders.

### Updated
- Project and handoff docs to include tagging intelligence layer.
- Data contracts to include tagging CSVs and graph outputs.

## [v0.2] - 2026-03-04
### Added
- Sprint 1 scaffold for modular monolith backend.
- Fastify app and server entrypoints with `/health` route.
- Prisma plugin and JWT plugin wiring.
- Auth module skeleton with register/login/refresh/logout/me/protected endpoints.
- Strict TypeScript + ESLint boundary enforcement.
- Initial Prisma migration (`0001_init`).
- Global request ID middleware (`x-request-id`) with response echo.
- Formal event taxonomy document (`docs/event-taxonomy.md`).
- Centralized constants and feature-flag stub configuration.
- Seed-based deterministic randomness utility.
- Structured typed error-code catalog.
- Auth route-level rate limiting.
- Deterministic scoring fixtures for future scoring pipeline tests.
- Soft-delete safety regression test coverage.

Last updated: 2026-03-25

Last updated: 2026-03-25
