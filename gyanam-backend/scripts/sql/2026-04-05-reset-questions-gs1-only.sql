-- Reset assessment question bank to allow GS1-only re-ingestion.
-- Destructive by design; run only when intentional.

BEGIN;

DELETE FROM "AttemptResponse";
DELETE FROM "QuickAttemptResponse";
DELETE FROM "ErrorAttemptLog";
DELETE FROM "TestAttempt";
DELETE FROM "TestSetQuestion";
DELETE FROM "TestSet";
DELETE FROM "QuestionConcept";
DELETE FROM "Question";

COMMIT;

