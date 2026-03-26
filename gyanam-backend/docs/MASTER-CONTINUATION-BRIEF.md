# GYANAM UPSC ENGINE - MASTER CONTINUATION BRIEF

## Project Overview

Gyanam is an AI-assisted UPSC learning platform designed to convert previous year questions into a structured learning and analytics system.

The backend currently focuses on the UPSC Civil Services Preliminary Examination pipeline, especially:

- GS Paper 1
- CSAT Paper 2

Standard question counts:

- GS1: 100 questions
- CSAT: 80 questions

The PYQ pipeline is intended to power:

- concept-based learning
- adaptive practice
- pattern analysis
- answer-key workflows
- future AI-assisted question generation

## Current Development Stage

The current engineering focus is the PYQ Intelligence Engine.

High-level flow:

```text
UPSC PDF
-> text extraction
-> question normalization
-> structural validation
-> automated/manual triage
-> enrichment
-> answer reconciliation
-> database ingestion
```

## Adaptive Mentor Engine (v1)

The adaptive learning loop is now implemented and instrumented:

- `error-engine` computes `userState` + `systemAction` from recent attempts.
- `error-engine` extracts weak areas (topic + errorType) from recent incorrect attempts.
- `adaptive-selector` translates actions into `AdaptiveStrategy`.
- `adaptive-selector` attaches weak-area topics for `focus_revision`.
- `assessment-service` orchestrates strategy-aware, topic-aware test assembly.
- Backend-derived `systemAction` is the source of truth; client overrides are debug-only in non-production.
- Debug output includes `previousUserState`, `stateHistory`, and `transitionType` for transition visibility.
- Attempt submission returns `mentorFeedback` with human-friendly topic labels and copy verbosity variants.

## Tagging Intelligence Layer (Current State)

Tagging assets live in `data/pyq/tagging/` and are governed by `rulebook.v1.2.md`.

Key files:

```text
seed-master.csv
seed-master.core.v1.csv
audit-50.csv
rulebook.v1.2.md
schema.core.v1.json
schema.advanced.v1.json
```

Derived outputs (for analytics/graphing):

```text
concepts.nodes.v1.csv
concepts.edges.v1.csv
concepts.stats.v1.csv
concepts.final.v1.csv
concepts.cluster.v1.csv
```

Notes:

- CORE fields are public: `primary_concept`, `question_intent`, `cognitive_level`.
- ADVANCED fields remain internal (trap_type, reasoning_type, secondary_subject, error_prone_area, confidence_level).
- `trend_tag` is computed automatically (not manual).
- Manual calibration should be done on `audit-50.csv` before bulk application.

## Current Source-of-Truth Files

Primary question dataset:

```text
data/pyq/pyq.prelims.v1.json
```

Enrichment dataset:

```text
data/pyq/pyq.enrichment.v1.json
```

Answer proposals:

```text
data/pyq/pyq.answer-proposals.v1.json
```

Answer references:

```text
data/pyq/pyq.answer-reference.v1.json
```

## Existing Scripts

### Extraction

```text
fetch-upsc-pyq.ts
parse-upsc-pdf.ts
normalize-pyq.ts
```

### Validation

```text
validate-normalized-pyq.ts
auto-review-normalized-pyq.ts
review-normalized-pyq.ts
```

Current review states:

```text
approved
pending_review
rejected
```

### Enrichment

```text
bootstrap-pyq-enrichment.ts
apply-pyq-enrichment.ts
pyq-enrichment-utils.ts
```

These are used to carry metadata such as:

```text
subject
correctAnswer
answerStatus
answerSource
```

### Answer Reconciliation

```text
bootstrap-pyq-answer-sources.ts
enrich-pyq-answers.ts
fetch-upsc-answer-key.ts
fetch-coaching-answer-keys.ts
extract-upsc-answer-key.ts
debug-pdf-parse.ts
```

Current answer-state model includes:

```text
pending
ai_provisional
provisional_correct
official_confirmed
conflict
```

Important accuracy note:

- `fetch-upsc-answer-key.ts` exists now and is the current automation entry point.
- `fetch-coaching-answer-keys.ts` also exists now and builds consensus/reference output.
- `extract-upsc-answer-key.ts` and `debug-pdf-parse.ts` are manual utilities, but they are now explicitly wired in `package.json`.
- `generate-ai-answer-proposals.ts` does not exist yet. It remains a planned next-step component.

### Ingestion

```text
ingest-pyq.ts
```

Operational rule:

- only approved and sufficiently answer-resolved rows should move into ingestion

## Current Blocker / Gap

The main missing dedicated component is AI proposal generation.

Needed new script:

```text
generate-ai-answer-proposals.ts
```

Desired role:

```text
question text
-> AI answer prediction
-> proposal storage
-> answerStatus = ai_provisional
```

## Immediate Next Engineering Goal

Make answer population reliable enough that the first UPSC dataset can complete the answer pipeline and reach ingestion.

Recommended next work:

```text
1. Harden fetch-upsc-answer-key.ts and fetch-coaching-answer-keys.ts for broader year/paper coverage
2. Implement generate-ai-answer-proposals.ts
3. Feed proposals + references into enrich-pyq-answers.ts
4. Run apply-pyq-enrichment.ts
5. Run ingest-pyq.ts
```

## Alignment Review

The project has not drifted from the intended architecture.

Current work is still inside the PYQ Intelligence Engine, specifically the section between:

```text
answer reconciliation
-> database ingestion
```

This can feel like a change in direction because the work became more operational and script-heavy, but it is still the same subsystem and same roadmap phase.

Current status view:

```text
PDF extraction             done
Question normalization     done
Structural validation      done
Subject enrichment         done
Answer reconciliation      partially implemented, still maturing
Database ingestion         implemented, operational once inputs are clean
Concept extraction         not started as a system
Learning engine            v1 implemented (error-engine + adaptive selector)
Test system expansion      v1 adaptive assembly implemented
Topic intelligence         v1 weak-area extraction + topic-aware selection
```

Conclusion:

```text
Project alignment: maintained
Architecture deviation: none
Implementation progress: positive
Next milestone: complete reliable PYQ answer population and ingestion
```

## Code State At Hand-off

The next chat should treat these files as the current implementation anchor points:

```text
scripts/fetch-upsc-answer-key.ts
scripts/fetch-coaching-answer-keys.ts
scripts/extract-upsc-answer-key.ts
scripts/enrich-pyq-answers.ts
scripts/ingest-pyq.ts
```

Important current truths:

- `fetch-upsc-answer-key.ts` is implemented and currently acts as the main answer-reference automation script.
- `fetch-coaching-answer-keys.ts` already exists and is not just a planned idea.
- `extract-upsc-answer-key.ts` is a manual utility, not the main automated path.
- `generate-ai-answer-proposals.ts` still does not exist and remains a planned next-step script.
- `ingest-pyq.ts` is implemented and includes defensive skip logic for unresolved rows.

Current practical objective:

```text
populate pyq.answer-reference.v1.json
populate pyq.answer-proposals.v1.json
reconcile answer evidence
apply enrichment
ingest approved, resolved rows into the database
```

## Current Commands Worth Using

```text
npm run fetch:answer-keys
npm run extract:answer-keys
npm run debug:answer-keys
npm run fetch:coaching-answer-keys
npm run enrich:pyq:answers
npm run apply:pyq:enrichment
npm run ingest:pyq
```

## Architecture Notes

Runtime backend modules live under:

```text
src/core/auth
src/core/assessment
src/core/mastery
src/core/revision
src/core/analytics
```

Current placeholder modules:

```text
src/core/syllabus
src/core/instrumentation
```

Persistence is Prisma/PostgreSQL.

There is migration history and versioned datasets, but there is not a true application-level file versioning system.

## Team Operating Model

The project uses three conceptual councils.

### 1. Founders / Technology Circle

Focus:

```text
cloud architecture
AI learning systems
platform scale
data-driven systems
```

### 2. UPSC Domain Council

Focus:

```text
UPSC patterns
question structures
difficulty distribution
exam traps
```

### 3. System Engineering Council

Focus:

```text
concept taxonomy
adaptive practice engine
pattern analysis engine
sample paper generator
```

Additional conceptual roles:

### Learning Scientist

Focus:

```text
spaced repetition
knowledge decay curves
cognitive load
learning efficiency
```

### AI Systems Architect

Focus:

```text
AI inference pipelines
prompt orchestration
AI verification systems
cost-efficient AI usage
```

## Project Architect

Project lead:

```text
Babaji
```

Responsibilities:

```text
vision
system direction
final decisions
integration of council inputs
```

## Guidance for the Next Chat

When continuing in a new chat, treat this document as the architectural handoff.

Do not assume that all planned scripts already exist.

Current truth:

- official/coaching answer-key scripts exist
- AI answer proposal generation does not yet exist as a dedicated script
- ingestion exists
- enrichment exists
- datasets are versioned by filename, not by application-level file revisioning

Primary objective for the next implementation phase:

```text
populate pyq.answer-reference.v1.json
populate pyq.answer-proposals.v1.json
reconcile answers into enrichment
ingest approved, resolved questions into the database
```

## Documentation Discipline

After changes to tagging, datasets, or pipeline flow, update docs using:

- `docs/DOC-UPDATE-CHECKLIST.md`

Last updated: 2026-03-25

Last updated: 2026-03-25

