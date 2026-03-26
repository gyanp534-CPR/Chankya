# ADR-0008

- ADR: ADR-0008
- Title: Mentor Feedback Messaging on Attempt Submission
- Date: 2026-03-25
- Status: Accepted

## Context
The adaptive mentor engine makes decisions, but users need visible guidance. A lightweight experience layer was required to translate backend decisions into clear, actionable feedback after each attempt without modifying decision logic.

## Decision
Add a mentor feedback payload to attempt submission responses, generated server-side from the latest user state and weak-area signals. The payload includes a headline, message, mode, focus topics with human-friendly labels, a next action, and copy verbosity variants with optional error-type hints.

## Consequences
- Users receive immediate, personalized guidance after each attempt.
- No changes to persistence or adaptive thresholds.
- UI integration can consume the payload directly.

## References
- Related version docs: `docs/architecture/versions/v0.5/README.md`
- Related ADRs: ADR-0006, ADR-0007

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25
