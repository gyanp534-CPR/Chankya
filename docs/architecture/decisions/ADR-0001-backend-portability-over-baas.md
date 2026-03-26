# ADR-0001: Backend Portability Over BaaS Coupling

- Date: 2026-03-03
- Status: Accepted

## Context
The platform requires predictable cost growth and cloud portability. BaaS choices with read-based billing and tightly coupled data/runtime APIs can create lock-in and cost volatility.

## Decision
Use a backend-controlled architecture based on Node.js + PostgreSQL + Prisma, avoiding tight operational dependency on Firebase/Firestore as the primary domain system.

## Consequences
- Positive: Greater control over costs, portability, and data model evolution.
- Positive: Consistent backend behavior for all clients.
- Tradeoff: Team owns more backend operational responsibility.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

