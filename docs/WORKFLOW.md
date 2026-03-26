# Project Workflow (Multi-Sector)

This document captures the lightweight branching and commit discipline for ongoing work across multiple sectors (GS1, CSAT, OCR, answers, etc.).

## Branching Strategy
- `main` is always stable and production-ready.
- `dev` is the active integration branch; all work lands here first.
- `phase/*` branches are historical or long-running streams (usually merged and then kept as stale references).
- Use short-lived `feature/*` branches for focused tasks; merge into `dev` when ready.

Examples:
- `feature/csat-fix-docs`
- `feature/gs1-2018-upload`
- `feature/answers-keys`
- `feature/ocr-pipeline`
- `phase/4-frontend-web` (merged, stale)
- `phase/5-mobile` (merged, stale)
- `phase/6-ai-engine` (merged, stale)
- `phase/9-advanced-analytics` (merged, stale)
- `phase/10-infrastructure` (local only, never pushed)

## Commit Discipline
- One commit per meaningful unit of work.
- Avoid mixing OCR outputs with manual edits in the same commit.
- Keep docs-only changes in their own commit.

## Suggested Phase Pattern
1. Docs update (status, policy, brief)
2. Manual data fixes (text edits, placeholders)
3. OCR outputs (generated files)

## Merge Strategy
- Merge or squash `feature/*` branches into `dev` after review.
- Periodically promote `dev` to `main` once stable.
- Do not work directly on `main`.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

