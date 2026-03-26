# Sprint 1 Notes

## Delivered
- Fastify backend scaffold in `backend/`.
- Strict TypeScript config and build/dev scripts.
- Prisma configured with PostgreSQL datasource from environment.
- Auth module implemented with register/login/refresh/logout/me.
- Session persistence with token rotation support.
- Lint + typecheck + test suite passing.

## Boundary Enforcement
- TS path aliases defined for `@core/*` modules.
- `boundaries/element-types` enforces module isolation.
- `no-restricted-imports` blocks `@core/*/infra/*` direct imports.

## Security Notes
- Passwords use bcrypt hashing.
- Refresh tokens use SHA-256 hashing and rotation.
- Refresh tokens include `jti` to prevent duplicate-token rotation gaps.

## Deferred to Later Sprints
- Syllabus/question/assessment/mastery domain logic.
- Revision engine and analytics payloads.
- War-room and monetization runtime features.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

