# ADR-0001: Sprint 1 Spine-First Backend Constitution

- Date: 2026-03-04
- Status: Accepted

## Decision
Adopt a spine-first modular monolith for Sprint 1 with:
- strict TypeScript
- Fastify + Prisma + PostgreSQL
- plugin-based DB and JWT wiring
- auth-only functional scope
- enforced module boundaries

## Consequences
- Phase 1 features can be added as assembly work on top of stable boundaries.
- Non-negotiables (no route business logic, no controller DB calls, no feature creep) are enforceable from day one.

Last updated: 2026-03-22

Last updated: 2026-03-22

