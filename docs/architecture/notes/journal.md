# Architecture Journal

Continuous log for architecture discussions, rationale, and pending items.

## Entry Template
- Date: YYYY-MM-DD
- Participants: 
- Context: 
- Decisions: 
- Open Items: 
- Linked Version: `vX.Y`
- Linked ADRs: 

## Entries
### 2026-03-25
- Participants: Founder + Codex
- Context: Adaptive mentor engine v1 and topic intelligence integration
- Decisions:
  - Implemented weak-area targeting and topic-aware revision selection.
  - Added transition observability via `stateHistory` and `transitionType`.
  - Captured architecture snapshot v0.4 and ADRs for mentor engine + observability.
- Open Items:
  - Consider concept-level weak-area mapping beyond `topicId`.
  - Evaluate long-term state-history storage for analytics.
- Linked Version: `v0.4`
- Linked ADRs: `ADR-0006`, `ADR-0007`

### 2026-03-25
- Participants: Founder + Codex
- Context: Experience layer kickoff (mentor feedback messaging)
- Decisions:
  - Added mentor feedback payload to attempt submission responses.
  - Added copy verbosity variants and error-type hinting.
  - Captured architecture snapshot v0.5 and ADR for feedback messaging.
- Open Items:
  - Decide if mentor feedback should be logged for analytics.
  - Consider topic display names in the API response.
- Linked Version: `v0.5`
- Linked ADRs: `ADR-0008`

### 2026-03-04
- Participants: Founder + Codex
- Context: Sprint 1 implementation of v0.2 execution blueprint
- Decisions:
  - Locked modular monolith boundaries with TS paths and ESLint enforcement.
  - Implemented JWT access + rotating refresh sessions persisted in `AuthSessions`.
  - Standardized auth API envelope on `/v1/auth/*`.
- Open Items:
  - Sprint 2 starts syllabus + question-bank + assessment foundations.
  - Expand schema toward full Phase 1 depth-first table set.
  - Phase 2/3: prevent users from retaking identical seeded tests and memorizing question order (introduce retake-variance + attempt guardrails).
- Linked Version: `v0.2`
- Linked ADRs: `ADR-0004`, `ADR-0005`

### 2026-03-03
- Participants: Council
- Context: Initial architecture ratification
- Decisions:
  - Approved backend-portable stack (Node.js + PostgreSQL + Prisma)
  - Approved API-first design for web and mobile parity
  - Approved domain separation for Learning vs War-room vs Monetization
- Open Items:
  - Final API envelope and versioning policy details for v0.2
  - Auth hardening model (refresh rotation, device sessions)
- Linked Version: `v0.1`
- Linked ADRs: `ADR-0001`, `ADR-0002`, `ADR-0003`

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25

