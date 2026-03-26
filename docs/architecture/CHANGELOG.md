# Architecture Changelog

All notable architecture documentation updates are recorded here.

## [v0.5] - 2026-03-25
### Added
- Experience layer snapshot with mentor feedback messaging on attempt submission.

### Changed
- Current-version pointer moved to v0.5 (draft).

### Notes
- Status: Draft (mentor feedback payload; UI integration pending).

## [v0.4] - 2026-03-25
### Added
- Adaptive mentor engine v1 snapshot (error-engine + adaptive selector).
- Weak-area extraction and topic-aware revision targeting.
- Transition observability (`stateHistory`, `transitionType`).

### Changed
- Current-version pointer moved to v0.4 (draft).

### Notes
- Status: Draft (adaptive mentor engine v1).

## [v0.3] - 2026-03-17
### Added
- Draft snapshot capturing PYQ pipeline stabilization status.
- CSAT diagram placeholder policy for question text files.
- Python OCR fallback as an operational path for CSAT/GS1 raw text generation.

### Changed
- Current-version pointer moved to v0.3 (draft).

### Notes
- Status: Draft (pending CSAT OCR completion for 2021-2022).

## [v0.2] - 2026-03-04
### Added
- Frozen Sprint 1 execution snapshot with implemented auth foundation.
- API contract snapshot for `/v1/auth` endpoints.
- Phase 1 schema snapshot and schema diff files.
- ADR-0004 for module boundary enforcement.
- ADR-0005 for JWT + rotating refresh session strategy.

### Changed
- Architecture current-version pointer moved from `v0.1` to `v0.2`.

### Notes
- Status: Frozen Execution Blueprint implemented for Sprint 1.
- Validation: `lint`, `typecheck`, and `test` passing in backend workspace.

## [v0.1] - 2026-03-03
### Added
- Initial architecture blueprint snapshot.
- API-first contract outline.
- Data architecture baseline.
- Deployment and stack rationale.
- Documentation versioning system and templates.
- ADR process and first ADRs.

### Notes
- Status: Council Approved.
- This version is the baseline for upcoming v0.2 hardening.

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25
