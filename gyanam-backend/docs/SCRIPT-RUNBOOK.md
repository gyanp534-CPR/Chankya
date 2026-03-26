# Script Runbook

This runbook documents the current operational scripts, their purpose, their inputs and outputs, and the recommended execution sequence.

All commands below are run from:

```text
gyanam-backend/
```

## Core Pipeline Order

Recommended end-to-end PYQ flow:

```text
1. npm run fetch:pyq
2. npm run parse:pyq
3. npm run normalize:pyq
4. npm run validate:pyq:normalize
5. npm run auto-review:pyq:normalize
6. npm run review:pyq:normalize
7. npm run bootstrap:pyq:enrichment
8. npm run bootstrap:pyq:answers
9. npm run fetch:answer-keys
10. npm run fetch:coaching-answer-keys
11. npm run enrich:pyq:answers
12. npm run apply:pyq:enrichment
13. npm run ingest:pyq
```

Some steps are iterative, especially review and answer population.

## Extraction Scripts

### `npm run fetch:pyq`

Script:

```text
scripts/fetch-upsc-pyq.ts
```

Purpose:

- scrape the UPSC previous question papers page
- identify prelims PDF links
- download matching PDFs into the raw PDF folder

Reads:

- UPSC previous question papers page

Writes:

- `data/raw_pyq_pdf/*.pdf`

### `npm run parse:pyq`

Script:

```text
scripts/parse-upsc-pdf.ts
```

Purpose:

- extract text from raw PYQ PDFs

Reads:

- `data/raw_pyq_pdf/*.pdf`

Writes:

- `data/raw_pyq_text/*.txt`

### `npm run normalize:pyq`

Script:

```text
scripts/normalize-pyq.ts
```

Purpose:

- transform extracted text into normalized question records

Reads:

- `data/raw_pyq_text/*.txt`

Writes:

- `data/pyq/pyq.prelims.v1.json`

## Validation and Review

### `npm run validate:pyq:normalize`

Script:

```text
scripts/validate-normalized-pyq.ts
```

Purpose:

- validate normalized rows structurally
- surface row-level issues

Reads:

- `data/pyq/pyq.prelims.v1.json`

Primary concerns:

- option count
- OCR noise
- truncated options
- continuation fragments

### `npm run auto-review:pyq:normalize`

Script:

```text
scripts/auto-review-normalized-pyq.ts
```

Purpose:

- auto-assign review states where the structural signals are clear

Reads:

- `data/pyq/pyq.prelims.v1.json`

Writes:

- `data/pyq/pyq.prelims.v1.json`

### `npm run review:pyq:normalize`

Script:

```text
scripts/review-normalized-pyq.ts
```

Purpose:

- manual or semi-manual review step for unresolved rows

Reads:

- `data/pyq/pyq.prelims.v1.json`

Writes:

- `data/pyq/pyq.prelims.v1.json`

## Enrichment and Answer Scaffolding

### `npm run bootstrap:pyq:enrichment`

Script:

```text
scripts/bootstrap-pyq-enrichment.ts
```

Purpose:

- scaffold enrichment rows for approved questions
- populate subject suggestion fields

Reads:

- `data/pyq/pyq.prelims.v1.json`

Writes:

- `data/pyq/pyq.enrichment.v1.json`

### `npm run bootstrap:pyq:answers`

Script:

```text
scripts/bootstrap-pyq-answer-sources.ts
```

Purpose:

- scaffold answer proposal and answer reference records for approved rows

Reads:

- `data/pyq/pyq.prelims.v1.json`
- existing answer proposal/reference files if present

Writes:

- `data/pyq/pyq.answer-proposals.v1.json`
- `data/pyq/pyq.answer-reference.v1.json`

## Answer Population

### `npm run fetch:answer-keys`

Script:

```text
scripts/fetch-upsc-answer-key.ts
```

Purpose:

- populate answer references using configured source URLs
- apply majority-vote logic
- use cache and hardcoded fallback where available

Reads:

- `data/pyq/pyq.prelims.v1.json`
- `data/pyq/pyq.answer-reference.v1.json` if present

Writes:

- `data/pyq/pyq.answer-reference.v1.json`
- `data/answer-key-cache/*.json`

Arguments:

```text
--year <number>
--paper <GS1|CSAT>
--refresh
```

Example:

```text
npm run fetch:answer-keys -- --year 2023 --paper GS1 --refresh
```

### `npm run fetch:coaching-answer-keys`

Script:

```text
scripts/fetch-coaching-answer-keys.ts
```

Purpose:

- scrape coaching sources from the manifest
- build answer consensus
- update reference rows

Reads:

- `data/pyq/pyq.prelims.v1.json`
- `data/pyq/pyq.answer-reference.v1.json`
- `data/pyq/coaching-answer-key-sources.v1.json`

Writes:

- `data/pyq/pyq.answer-reference.v1.json`
- `data/pyq/coaching-answer-consensus.v1.json`

Arguments:

```text
--year <number>
--paper <GS1|CSAT>
```

### `npm run extract:answer-keys`

Script:

```text
scripts/extract-upsc-answer-key.ts
```

Purpose:

- manual utility to extract answers from an official UPSC PDF input path

Use case:

- manual fallback when automated scraping is inadequate

### `npm run debug:answer-keys`

Script:

```text
scripts/debug-pdf-parse.ts
```

Purpose:

- manual debug/fallback utility for answer-key extraction experiments

Use case:

- debugging extraction assumptions
- generating ad hoc output during investigation

## Reconciliation

### `npm run enrich:pyq:answers`

Script:

```text
scripts/enrich-pyq-answers.ts
```

Purpose:

- reconcile answer proposals and reference answers into enrichment rows

Reads:

- `data/pyq/pyq.enrichment.v1.json`
- `data/pyq/pyq.answer-proposals.v1.json`
- `data/pyq/pyq.answer-reference.v1.json`

Writes:

- `data/pyq/pyq.enrichment.v1.json`

### `npm run apply:pyq:enrichment`

Script:

```text
scripts/apply-pyq-enrichment.ts
```

Purpose:

- apply reconciled enrichment values back into the normalized PYQ dataset

Reads:

- `data/pyq/pyq.prelims.v1.json`
- `data/pyq/pyq.enrichment.v1.json`

Writes:

- `data/pyq/pyq.prelims.v1.json`

## Ingestion

### `npm run ingest:pyq`

Script:

```text
scripts/ingest-pyq.ts
```

Purpose:

- ingest approved, answer-resolved PYQ rows into the database

Reads:

- `data/pyq/pyq.prelims.v1.json`
- `.env`
- Prisma schema / database connection

Writes:

- Prisma-backed database rows

Current gating behavior:

- only approved rows are considered
- dropped rows are skipped
- rows with missing year are skipped
- rows with missing subject are inferred where possible, otherwise skipped
- rows with missing or unresolved answers are skipped

Expected environment:

- `DATABASE_URL` present in `.env`

## Tagging and Coverage

### `npm run suggest:pyq:tags`

Script:

```text
scripts/suggest-pyq-tags.ts
```

Purpose:

- generate concept/tag suggestions for PYQ rows

### `npm run review:pyq:tags`

Script:

```text
scripts/review-pyq-tags.ts
```

Purpose:

- review generated tag suggestions

### `npm run tag:pyq:concepts`

Script:

```text
scripts/tag-pyq-concepts.ts
```

Purpose:

- apply concept tags to questions

### `npm run report:pyq:coverage`

Script:

```text
scripts/report-pyq-coverage.ts
```

Purpose:

- inspect tagging or enrichment coverage

## Other Operational Scripts

### `npm run recompute:mastery`

Script:

```text
scripts/recompute-mastery.ts
```

Purpose:

- recompute mastery outputs from persisted learning signals

### `npm run simulate:users`

Script:

```text
scripts/simulate-users.ts
```

Purpose:

- simulate users and assessment/mastery flows for testing or model inspection

## Prisma Commands

### `npm run db:generate`

Purpose:

- regenerate Prisma client from schema

### `npm run db:migrate`

Purpose:

- apply Prisma migrations to the target database

### `npm run db:seed`

Purpose:

- seed the database

## Practical â€œWhere We Are Nowâ€ Sequence

If continuing from the current project state, the most useful short path is:

```text
1. npm run bootstrap:pyq:answers
2. npm run fetch:answer-keys -- --year 2023 --paper GS1
3. npm run fetch:coaching-answer-keys -- --year 2023 --paper GS1
4. npm run enrich:pyq:answers
5. npm run apply:pyq:enrichment
6. npm run ingest:pyq
```

If ingestion reports skipped rows, inspect:

- `data/pyq/pyq.prelims.v1.json`
- `data/pyq/pyq.enrichment.v1.json`
- `data/pyq/pyq.answer-reference.v1.json`
- `data/pyq/pyq.answer-proposals.v1.json`

Last updated: 2026-03-22

Last updated: 2026-03-22

