# ADR-0007

- ADR: ADR-0007
- Title: Weak-Area Targeting and Transition Observability
- Date: 2026-03-25
- Status: Accepted

## Context
Mentor behavior needed better observability and personalization. We needed to surface state transitions (recovering -> stable) and use weak-area signals to guide revision sessions, without altering the core decision logic or inflating recovery windows.

## Decision
Add lightweight observability and targeting features:
- `stateHistory` / `stateTrace` emitted from recent attempts.
- `transitionType` derived from previous -> current state.
- Weak-area extraction (topic + errorType) used to bias `focus_revision` question selection toward weak topics.

## Consequences
- Increases transparency of adaptive transitions without changing thresholds.
- Enables topic-aware revision sessions for early personalization.
- Weak areas remain topic-level only; concept-level mapping is deferred.

## References
- Related version docs: `docs/architecture/versions/v0.4/README.md`
- Related ADRs: ADR-0006

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25
