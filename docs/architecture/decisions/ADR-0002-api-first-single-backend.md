# ADR-0002: API-First Single Backend for Web and Mobile

- Date: 2026-03-03
- Status: Accepted

## Context
Running separate logic paths across clients causes drift and duplicated rule implementation.

## Decision
Adopt API-first architecture where all business rules are hosted in a single backend surface consumed by Next.js web and Expo mobile clients.

## Consequences
- Positive: Feature parity and centralized governance.
- Positive: Easier testing and observability.
- Tradeoff: Backend API becomes a critical dependency for all clients.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

