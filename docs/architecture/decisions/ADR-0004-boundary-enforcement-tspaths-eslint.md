# ADR-0004: Enforce Internal Domain Boundaries with TS Paths + ESLint

- Date: 2026-03-04
- Status: Accepted

## Context
Sprint 1 requires modular monolith discipline so cross-domain coupling does not spread during rapid feature development.

## Decision
Adopt both compile-time and lint-time controls:
- TypeScript path aliases for `@core/*` public module surfaces.
- ESLint `boundaries/element-types` rules for allowed module dependencies.
- ESLint `no-restricted-imports` to block direct `@core/*/infra/*` imports.

## Consequences
- Positive: Early architectural guardrails and reduced accidental coupling.
- Positive: CI catches boundary drift before merge.
- Tradeoff: Requires explicit public surface exports and occasional lint rule maintenance.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

