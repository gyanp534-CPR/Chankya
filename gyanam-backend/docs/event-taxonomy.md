# Event Taxonomy (Sprint 1 Formal Baseline)

Version: v0.2  
Status: Active

## Principles
- Event names are snake_case and immutable once published.
- Every event includes: `eventName`, `occurredAt`, `requestId`, `userId?`, `sessionId?`, `payload`.
- Payload fields are additive-only for backward compatibility.

## Core Events
- `test_created`
  - payload: `testSetId`, `mode`, `questionCount`
- `attempt_started`
  - payload: `attemptId`, `testSetId`, `startedAt`
- `attempt_submitted`
  - payload: `attemptId`, `testSetId`, `submittedAt`, `durationMs`, `rawScore`
- `override_used`
  - payload: `userId`, `client`, `backend`
- `question_skipped`
  - payload: `attemptId`, `questionId`, `elapsedMs`
- `question_revisited`
  - payload: `attemptId`, `questionId`, `revisitCount`

## Existing Events (Back-Compat)
- `test_started`
- `question_answered`
- `test_submitted`
- `revision_completed`
- `streak_updated`

## Governance
- New events require ADR note and changelog entry.
- Deprecations must keep old consumers functional for one full minor version.

Last updated: 2026-03-24

Last updated: 2026-03-24

