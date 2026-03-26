# Sprint 2 Migration Staging Checklist

## Do Not Apply Directly to Production

1. Provision a staging PostgreSQL database.
2. Point `DATABASE_URL` to staging.
3. Run:
   - `npx prisma migrate deploy`
   - `npx prisma generate`
4. Validate relational integrity manually:
   - `AttemptResponse` FK to `TestAttempt` and `Question`
   - `TestSetQuestion` composite PK (`testSetId`, `questionId`)
   - Cascade behavior on `TestAttempt` -> `AttemptResponse`
5. Execute integration suite on staging-backed runtime.
6. Run one manual end-to-end flow:
   - assemble test -> start attempt -> submit attempt
   - verify aggregate fields persisted (`totalQuestions`, `attemptedCount`, `correctCount`, `incorrectCount`, `skippedCount`, `rawScore`)
7. Confirm event payload enrichment in `EventLog` (`subjectId`, `mode`, `totalScore`).
8. Confirm `durationSeconds` computed server-side (not accepted from client payload).
9. Only after successful staging validation, apply to primary DB.

Last updated: 2026-03-22

Last updated: 2026-03-22

