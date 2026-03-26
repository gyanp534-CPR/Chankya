# ADR-0003: Separation of Learning, War-Room, and Monetization Domains

- Date: 2026-03-03
- Status: Accepted

## Context
Learning/mastery progression is core academic state. War-room interaction and subscription billing evolve on separate timelines and should not directly compromise learning data integrity.

## Decision
Maintain explicit domain separation in table design and service boundaries:
- Learning domain: progression, tests, revision, mastery.
- Engagement domain: war-room events and participation.
- Monetization domain: plans, subscriptions, entitlements.

## Consequences
- Positive: Lower risk of cross-domain regressions.
- Positive: Cleaner compliance and analytics boundaries.
- Tradeoff: Requires disciplined integration contracts between domains.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

