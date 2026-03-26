# ADR-0006

- ADR: ADR-0006
- Title: Adaptive Mentor Engine v1
- Date: 2026-03-25
- Status: Accepted

## Context
The learning engine required a behavior-driven adaptation layer that could respond to recent attempts, control difficulty progression, and keep the system observable without client-side overrides. The system needed to remain deterministic, server-owned, and compatible with existing assessment flows.

## Decision
Implement an adaptive mentor engine with:
- `error-engine` to compute `userState`, confidence signals, and `systemAction` from recent attempts.
- `adaptive-selector` to translate `systemAction` into an `AdaptiveStrategy` (difficulty mix, mode, question type, skill focus).
- `assessment-service` orchestration so the backend is the single source of truth for adaptive decisions.
- Client overrides permitted only in non-production for simulation and debugging.

## Consequences
- Enables controlled difficulty shifts and mentor-like recovery handling.
- Adds compute and state tracking responsibilities to the backend.
- Requires ongoing calibration of thresholds and strategy mappings.

## References
- Related version docs: `docs/architecture/versions/v0.4/README.md`
- Related ADRs: ADR-0004, ADR-0005

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25
