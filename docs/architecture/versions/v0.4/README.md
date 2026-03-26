# Architecture Version v0.4

Status: Draft  
Date: 2026-03-25
Version: v0.4

## 1. Executive Summary
This version captures the Adaptive Mentor Engine v1: user-state computation, adaptive strategy selection, weak-area extraction, topic-aware test assembly, and transition observability (previous state, state history, transition type).

## 2. Backend Core
- Runtime/framework: Node.js + TypeScript.
- Data storage: PostgreSQL via Prisma.
- Learning modules: `error-engine` and `assessment` drive adaptive strategy selection.
- Overrides: Client-provided `systemAction` is debug-only in non-production.

## 3. API Architecture
- No new public routes introduced.
- Adaptive strategy is computed server-side and returned as debug metadata only in non-production.

## 4. Client Architecture
- No change from v0.3.

## 5. Data Architecture
- `errorAttemptLog` stores `errorType` and `questionId` for behavior history.
- Weak areas are derived by joining attempts to `question.topicId`.
- Adaptive strategy carries topic targeting data (`topics`) for revision flows.

## 6. Operational Architecture
- Adaptive debug exposes `previousUserState`, `stateHistory`, and `transitionType` in non-production.
- State trace is computed from the recent attempt window to validate transitions.

## 7. Security Architecture
- No change from v0.3.

## 8. Changes Since Previous Version
- Added: Adaptive mentor engine v1 (error-engine + adaptive selector).
- Added: Weak-area extraction and topic-aware question assembly.
- Added: Transition observability (`stateHistory`, `transitionType`).
- Changed: Test assembly now prioritizes weak-area topics when `focus_revision` is active.

## 9. Open Questions
- Should weak areas be mapped to concepts beyond `topicId` for finer targeting?
- Do we need persistent state-history storage for analytics or audits?

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25
