# QA Checklist

## Pre‑merge Checks
- Lint/typecheck clean.
- Core flows smoke tested:
  - Practice start
  - Session submit
  - Post‑attempt feedback
  - Learning path load
- No new data outputs committed.

## Feature Smoke Tests
- Today’s Focus renders without errors.
- Focused set starts from CTA.
- Session feedback shows:
  - chosen vs correct
  - trap insight
  - correct thinking
- Learning path updates after submit.

## Regression Watchlist
- /v1/learning-path returns 200
- /v1/tests/submit returns postAttempt
- No unexpected 404s for new routes

Last updated: 2026-03-29
