# Base QP Template

This document defines the completion standard for a single PYQ paper after cleanup. The current reference model is:

```text
data/pyq/pyq.prelims.v1.json
```

with the 2023 GS1 paper now filled as the baseline example.

Standard question counts for the prelims papers:

- GS1: 100 questions
- CSAT: 80 questions

## Purpose

The goal is to use one fully completed question paper as the template for future papers so the rest of the pipeline has a stable structure to follow.

This template is meant to standardize:

- record shape
- review states
- answer states
- subject coverage
- ingestion readiness

## Baseline Completion Standard

A base paper is considered fully modeled when:

- every row has:
  - `id`
  - `year`
  - `examStage`
  - `paperType`
  - `sourceFile`
  - `questionText`
  - `options`
  - `status`
  - `reviewNotes`
- every row also has:
  - `subject`
  - `answerStatus`
  - `answerSource`
- every non-dropped row has:
  - `correctAnswer`

For the current 2023 GS1 baseline, the dataset now satisfies:

```text
total rows: 100
missing subject: 0
missing answerStatus: 0
missing correctAnswer for non-dropped rows: 0
officialConfirmed: 99
dropped: 1
```

## Row Categories

Each row should fall into one of three review states:

```text
approved
pending_review
rejected
```

Each row should also fall into one answer state:

```text
official_confirmed
dropped
```

Current note:

- the 2023 GS1 baseline is intentionally fully backfilled, including pending/rejected rows, so it can act as a reference model
- for future papers, answer-state completeness is desirable even before all rows are approved

## Recommended Required Fields Per Row

### Universal fields

These should exist for all rows:

```text
id
year
examStage
paperType
sourceFile
questionText
options
status
reviewNotes
subject
answerStatus
answerSource
```

### Conditional field

This should exist unless the row is dropped:

```text
correctAnswer
```

## Subject Taxonomy

Current broad subject labels in use:

```text
History
Geography
Polity
Economy
Environment
Science & Technology
Current Affairs
```

Use these consistently in future papers unless the taxonomy is formally revised.

## Answer Source Convention

Current source values in the baseline:

```text
official-pdf-verified
```

If future workflows use coaching or AI-derived evidence before official confirmation, preserve the same answer-state model and keep source provenance explicit.

## How To Use This Template For Future Papers

For each new paper:

1. Create normalized rows in the same shape.
2. Ensure every row gets a review state.
3. Ensure every row gets a subject label, even if later revised.
4. Ensure every row gets answer metadata:
   - `answerStatus`
   - `answerSource`
   - `correctAnswer` when not dropped
5. Keep dropped questions explicit with:
   - `answerStatus = dropped`
   - no `correctAnswer`

## Practical Pipeline Target

For future papers, aim for this order:

```text
normalize
-> validate
-> review
-> enrich subject
-> populate answer references
-> reconcile answers
-> apply enrichment
-> confirm base-paper completeness
-> ingest approved rows
```

## Base-Paper Readiness Checklist

Use this checklist before calling a paper a reusable base model:

- all rows have review state
- all rows have subject
- all rows have answerStatus
- all rows have answerSource
- all non-dropped rows have correctAnswer
- dropped rows are explicit
- approved rows are ingestion-ready
- pending/rejected rows still preserve enough metadata for future correction

## Recommended Validation Query

Before using a future paper as a base model, verify:

```text
missing subject = 0
missing answerStatus = 0
missing correctAnswer for non-dropped rows = 0
```

## Important Caution

The current baseline includes best-fit subject labels for rows that were incomplete. That is useful for standardization and pipeline continuity, but it is not the same as a domain-reviewed gold taxonomy.

Treat this base template as:

- operationally complete
- structurally reusable
- still eligible for later domain refinement

Last updated: 2026-03-22

Last updated: 2026-03-22

