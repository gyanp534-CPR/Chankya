# Gyanam UPSC Engine Project Overview

## Purpose

Gyanam is an AI-assisted UPSC learning platform focused on turning previous year questions into a structured knowledge and practice system.

The current backend focus is the UPSC Civil Services Preliminary Examination pipeline for:

- GS Paper 1
- CSAT Paper 2

Paper counts for normalization and validation:

- GS1: 100 questions
- CSAT: 80 questions

The resulting data is intended to support:

- concept-based learning
- adaptive practice
- answer-key workflows
- analytics and pattern analysis
- future AI-assisted question generation

## Current Backend Shape

The backend is a TypeScript modular monolith with:

- Fastify for the HTTP server
- Prisma + PostgreSQL for persistence
- domain modules under `src/core/*`
- operational scripts under `scripts/*`
- staged datasets under `data/*`

Core runtime modules currently present:

- `auth`
- `assessment`
- `mastery`
- `revision`
- `analytics`

Placeholder modules currently present but not implemented:

- `src/core/syllabus`
- `src/core/instrumentation`

## Adaptive Mentor Engine (v1)

The adaptive learning loop is now implemented in the assessment layer:

- `error-engine` computes `userState` + `systemAction` from recent attempt behavior.
- `error-engine` can extract weak areas (topic + errorType) from recent incorrect attempts.
- `adaptive-selector` maps `systemAction` to an `AdaptiveStrategy` (difficulty mix, mode, question type, skill focus).
- `adaptive-selector` attaches weak-area topics for `focus_revision`.
- `assessment-service` orchestrates strategy selection and topic-aware test assembly.
- Backend is the source of truth for `systemAction`; client overrides are debug-only in non-production.
- Debug output includes `adaptiveDebug` with state history and transition markers.
- Attempt submission returns `mentorFeedback` (mode + next action + weak-area focus) for UX messaging.

Current adaptive strategy shape:

```ts
AdaptiveStrategy = {
  difficultyMix,
  mode,
  questionType,
  skillFocus,
  topics
}
```

Observability (debug-only):

```ts
adaptiveDebug = {
  systemAction,
  userState,
  previousUserState,
  stateHistory,
  transitionType,
  strategy
}
```

Mentor feedback (returned on attempt submission):

```ts
mentorFeedback = {
  headline,
  message,
  mode,
  focus, // [{ topicId, topicLabel, errorType }]
  nextAction
}
```

Mentor feedback supports `short`, `medium`, and `long` verbosity variants (default: `medium`).

## PYQ Intelligence Pipeline

Current intended processing flow:

```text
UPSC PDF
-> fetch
-> parse text
-> normalize question records
-> validate and triage
-> enrich metadata
-> reconcile answers
-> ingest approved rows into the database
```

## Primary Data Files

Question dataset:

- `data/pyq/pyq.prelims.v1.json`

Enrichment dataset:

- `data/pyq/pyq.enrichment.v1.json`

Answer proposal dataset:

- `data/pyq/pyq.answer-proposals.v1.json`

Answer reference dataset:

- `data/pyq/pyq.answer-reference.v1.json`

Other supporting files currently used by the pipeline include:

- `data/pyq/coaching-answer-key-sources.v1.json`
- `data/question-concept-tags.v1.json`
- `data/question-concept-suggestions.v1.json`

## Tagging and Concept Graph

Tagging is managed in `data/pyq/tagging/` with a rulebook-driven schema:

- `seed-master.csv` (full tagging dataset)
- `seed-master.core.v1.csv` (CORE-only public export)
- `audit-50.csv` (manual calibration subset)
- `rulebook.v1.2.md` (tagging rules)
- `schema.core.v1.json` and `schema.advanced.v1.json`

Derived graph outputs:

- `concepts.nodes.v1.csv`
- `concepts.edges.v1.csv`
- `concepts.stats.v1.csv`
- `concepts.final.v1.csv`
- `concepts.cluster.v1.csv`

Tagging includes core fields (`primary_concept`, `question_intent`, `cognitive_level`) and advanced fields (`trap_type`, `reasoning_type`, `secondary_subject`, etc.).
`trend_tag` is a derived field computed from historical year coverage.

## Script Inventory

### Extraction

- `scripts/fetch-upsc-pyq.ts`
- `scripts/parse-upsc-pdf.ts`
- `scripts/normalize-pyq.ts`

These fetch UPSC papers, parse them, and convert them into normalized question records.

### Validation and Review

- `scripts/validate-normalized-pyq.ts`
- `scripts/auto-review-normalized-pyq.ts`
- `scripts/review-normalized-pyq.ts`

These scripts perform structural and review-state validation. The dataset supports:

- `approved`
- `pending_review`
- `rejected`

### Enrichment

- `scripts/bootstrap-pyq-enrichment.ts`
- `scripts/apply-pyq-enrichment.ts`
- `scripts/pyq-enrichment-utils.ts`
- `scripts/suggest-pyq-tags.ts`
- `scripts/review-pyq-tags.ts`
- `scripts/tag-pyq-concepts.ts`

These add or apply metadata such as:

- subject
- answer status
- answer source
- concept tagging

### Answer Population and Reconciliation

- `scripts/bootstrap-pyq-answer-sources.ts`
- `scripts/enrich-pyq-answers.ts`
- `scripts/fetch-upsc-answer-key.ts`
- `scripts/fetch-coaching-answer-keys.ts`
- `scripts/extract-upsc-answer-key.ts`
- `scripts/debug-pdf-parse.ts`

Current roles:

- `fetch-upsc-answer-key.ts`
  Scrapes coaching-style sources and applies a majority-vote answer-key flow with caching and hardcoded fallback.
- `fetch-coaching-answer-keys.ts`
  Reads a source manifest and builds coaching consensus records plus reference updates.
- `extract-upsc-answer-key.ts`
  Manual utility for extracting answers from an official UPSC PDF path.
- `debug-pdf-parse.ts`
  Manual fallback/debug utility for answer extraction experiments.
- `enrich-pyq-answers.ts`
  Reconciles proposals and references into the enrichment dataset.

### Ingestion

- `scripts/ingest-pyq.ts`

Rows are intended to reach ingestion only after they are both approved and sufficiently answer-resolved.

## Current Answer Status Model

The enrichment flow currently works with answer states such as:

- `pending`
- `ai_provisional`
- `provisional_correct`
- `official_confirmed`
- `conflict`

The exact reconciliation logic lives in `scripts/pyq-enrichment-utils.ts` and `scripts/enrich-pyq-answers.ts`.

## What Exists vs What Is Still Missing

Implemented now:

- normalized PYQ dataset flow
- validation/review flow
- enrichment bootstrap/apply flow
- coaching/official answer key utilities
- database ingestion script

Not yet implemented as a dedicated script:

- `scripts/generate-ai-answer-proposals.ts`

This is still a planned component, not a current repository artifact.

## Roadmap Alignment Status

The project is still aligned with the original architecture. Work has stayed inside the PYQ Intelligence Engine and has not shifted into a different subsystem.

Current roadmap view:

```text
PDF extraction             done
Question normalization     done
Structural validation      done
Subject enrichment         done
Answer reconciliation      partially implemented, still maturing
Database ingestion         implemented, operational once inputs are clean
Concept extraction         not started as a system
Learning engine            v1 implemented (error-engine + adaptive selector)
Test expansion/adaptive    v1 implemented (strategy-aware assembly)
Topic intelligence         v1 weak-area extraction + topic-aware selection
```

Interpretation:

- no architectural drift has occurred
- current work is focused on the blocked section between answer population and ingestion
- the next milestone is to make answer resolution reliable enough to ingest the first trustworthy PYQ dataset

## Planned (Council-Approved, Not Yet Implemented)

- Extend weak areas from `topicId` to concept-level mapping when available.

## Current Code State

The most relevant implementation entry points right now are:

- `scripts/fetch-upsc-answer-key.ts`
  Current automation entry point for answer references using source scraping, majority vote, cache, and hardcoded fallback.
- `scripts/fetch-coaching-answer-keys.ts`
  Reads the coaching source manifest and produces consensus/reference output.
- `scripts/extract-upsc-answer-key.ts`
  Manual answer extraction utility from official PDF input.
- `scripts/enrich-pyq-answers.ts`
  Reconciles proposals and references into the enrichment dataset.
- `scripts/ingest-pyq.ts`
  Applies the final ingestion gate and writes approved, answer-resolved rows into Prisma-backed storage.

Current ingestion behavior in `scripts/ingest-pyq.ts`:

- skips rows with missing year
- infers subject if missing
- skips missing answers
- skips unresolved answers such as `pending` and `conflict`
- tracks inserted vs updated records correctly before `upsert`

Current answer-reference behavior in `scripts/fetch-upsc-answer-key.ts`:

- supports per-year/per-paper source lists
- uses majority vote across scraped sources
- supports cached answer maps
- supports hardcoded verified fallback
- writes into `data/pyq/pyq.answer-reference.v1.json`

## Recommended Execution Path From Here

If continuing implementation from the current point, the practical path is:

```text
1. populate or improve answer references
2. populate proposal rows
3. run enrich-pyq-answers.ts
4. run apply-pyq-enrichment.ts
5. run ingest-pyq.ts
```

Useful commands:

```text
npm run fetch:answer-keys
npm run fetch:coaching-answer-keys
npm run extract:answer-keys
npm run enrich:pyq:answers
npm run apply:pyq:enrichment
npm run ingest:pyq
```

## Documentation Discipline

After any meaningful pipeline or tagging changes, run the documentation checklist:

- `docs/DOC-UPDATE-CHECKLIST.md`

## Known Engineering Gaps

- Main backend `npm run typecheck` is clean, but not all scripts are covered by the main TypeScript project.
- A focused `scripts/tsconfig.json` exists for selected operational scripts, not for the full `scripts/` directory.
- Some scripts outside that config still need type-hardening.
- There is no true file versioning system in the application. The project has migration history and versioned datasets, but not document/file revision management.

## Working Assumption for Next Milestone

The immediate goal is to make answer population deterministic enough that:

```text
npm run fetch:answer-keys
npm run fetch:coaching-answer-keys
npm run enrich:pyq:answers
npm run apply:pyq:enrichment
npm run ingest:pyq
```

can move the first approved UPSC dataset into the database with minimal manual intervention.

Last updated: 2026-03-25

Last updated: 2026-03-25

