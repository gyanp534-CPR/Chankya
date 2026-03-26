# Data Contracts

This document describes the current JSON/data contracts used by the PYQ pipeline. These contracts are derived from the code paths that currently read and write the files.

Primary source files for these definitions:

- `scripts/pyq-review-utils.ts`
- `scripts/pyq-enrichment-utils.ts`
- `scripts/bootstrap-pyq-enrichment.ts`
- `scripts/bootstrap-pyq-answer-sources.ts`
- `scripts/enrich-pyq-answers.ts`
- `scripts/fetch-upsc-answer-key.ts`
- `scripts/fetch-coaching-answer-keys.ts`
- `scripts/ingest-pyq.ts`

## 1. Normalized PYQ Dataset

File:

```text
data/pyq/pyq.prelims.v1.json
```

Primary TypeScript shape:

```ts
type ReviewStatus = "pending_review" | "approved" | "rejected";
type PaperType = "GS1" | "CSAT";

type NormalizedPyqRecord = {
  id: string;
  year: number | null;
  examStage: "prelims";
  paperType: PaperType;
  sourceFile: string;
  questionText: string;
  options: string[];
  status: ReviewStatus;
  reviewNotes: string;
  subject?: string;
  correctAnswer?: string;
  answerStatus?: string;
  answerSource?: string;
};
```

Required fields in practice:

- `id`
- `year`
- `examStage`
- `paperType`
- `sourceFile`
- `questionText`
- `options`
- `status`
- `reviewNotes`

Optional pipeline-carrying fields:

- `subject`
- `correctAnswer`
- `answerStatus`
- `answerSource`

Example:

```json
{
  "id": "UPSC_2023_GS1_Q1",
  "year": 2023,
  "examStage": "prelims",
  "paperType": "GS1",
  "sourceFile": "GS1_QP_CS_Pre_Exam_2023_280523.txt",
  "questionText": "Consider the following statements: ...",
  "options": ["Only one", "Only two", "All three", "None"],
  "status": "approved",
  "reviewNotes": "auto-approved: structure valid",
  "subject": "Geography",
  "answerStatus": "provisional_correct",
  "correctAnswer": "C",
  "answerSource": "reference"
}
```

## 2. Enrichment Dataset

File:

```text
data/pyq/pyq.enrichment.v1.json
```

Primary TypeScript shape:

```ts
type AnswerOption = "A" | "B" | "C" | "D";
type AnswerStatus =
  | "pending"
  | "ai_provisional"
  | "provisional_correct"
  | "official_confirmed"
  | "dropped"
  | "conflict";

type PyqEnrichmentRecord = {
  id: string;
  subject?: string;
  subjectSuggestion?: string;
  subjectConfidence?: number;
  correctAnswer?: AnswerOption | null;
  aiProposedAnswer?: AnswerOption | null;
  aiProposalSource?: string;
  referenceAnswer?: AnswerOption | null;
  referenceSource?: string;
  answerStatus?: AnswerStatus;
  answerSource?: string;
  notes?: string;
};
```

Current purpose:

- carries subject suggestions and overrides
- stores proposal/reference answers in a merged view
- stores the reconciled `correctAnswer`
- stores the final answer state used for ingestion gating

Typical write path:

- scaffolded by `bootstrap-pyq-enrichment.ts`
- updated by `enrich-pyq-answers.ts`
- merged back into normalized rows by `apply-pyq-enrichment.ts`

## 3. Answer Proposal Dataset

File:

```text
data/pyq/pyq.answer-proposals.v1.json
```

Primary TypeScript shape:

```ts
type AnswerProposalRecord = {
  id: string;
  proposedAnswer?: "A" | "B" | "C" | "D" | null;
  source?: string;
  confidence?: number | null;
  rationale?: string;
  notes?: string;
};
```

Accepted input forms:

### Array form

```json
[
  {
    "id": "UPSC_2023_GS1_Q1",
    "proposedAnswer": "C",
    "source": "ai",
    "confidence": 0.81,
    "rationale": "Matched known hydrology facts",
    "notes": ""
  }
]
```

### Object-map form

```json
{
  "UPSC_2023_GS1_Q1": {
    "proposedAnswer": "C",
    "source": "ai",
    "confidence": 0.81,
    "rationale": "Matched known hydrology facts",
    "notes": ""
  }
}
```

Compact string form is also tolerated by the parser:

```json
{
  "UPSC_2023_GS1_Q1": "C"
}
```

## 4. Answer Reference Dataset

File:

```text
data/pyq/pyq.answer-reference.v1.json
```

Primary TypeScript shape:

```ts
type AnswerReferenceRecord = {
  id: string;
  referenceAnswer?: "A" | "B" | "C" | "D" | null;
  source?: string;
  sourceType?: "coaching" | "official" | "manual";
  publishedAt?: string;
  notes?: string;
};
```

Accepted input forms:

### Array form

```json
[
  {
    "id": "UPSC_2023_GS1_Q1",
    "referenceAnswer": "C",
    "source": "Vision IAS",
    "sourceType": "coaching",
    "publishedAt": "2023-05-28",
    "notes": ""
  }
]
```

### Object-map form

```json
{
  "UPSC_2023_GS1_Q1": {
    "referenceAnswer": "C",
    "source": "Vision IAS",
    "sourceType": "coaching",
    "publishedAt": "2023-05-28",
    "notes": ""
  }
}
```

Compact value forms also work:

```json
{
  "UPSC_2023_GS1_Q1": "C",
  "UPSC_2023_GS1_Q34": "dropped"
}
```

Current parser behavior:

- `"A" | "B" | "C" | "D"` becomes a coaching reference by default
- `"dropped"` becomes `referenceAnswer: null` with dropped semantics
- object rows can explicitly mark `sourceType`

## 5. Coaching Source Manifest

File:

```text
data/pyq/coaching-answer-key-sources.v1.json
```

Primary TypeScript shape:

```ts
type CoachingSourceManifest = {
  source: string;
  year: number;
  paperType: "GS1" | "CSAT";
  url: string;
  responseType?: "html" | "pdf";
};
```

Purpose:

- input manifest for `fetch-coaching-answer-keys.ts`
- enumerates coaching answer-key sources for scraping/parsing

## 6. Coaching Consensus Output

File:

```text
data/pyq/coaching-answer-consensus.v1.json
```

Primary TypeScript shape:

```ts
type ConsensusRecord = {
  id: string;
  answer: "A" | "B" | "C" | "D" | null;
  votes: Record<string, "A" | "B" | "C" | "D">;
  agreementCount: number;
  totalSources: number;
  confidence: number;
  status: "provisional_correct" | "conflict" | "pending";
};
```

Purpose:

- stores the per-question consensus from coaching sources
- supports auditability of source voting and confidence

## 7. Ingestion Gate

Current ingestion logic is implemented in `scripts/ingest-pyq.ts`.

Rows are skipped if they have any of the following conditions:

- `status !== "approved"`
- missing `year`
- missing subject and subject could not be inferred
- missing `correctAnswer`
- `answerStatus === "pending"`
- `answerStatus === "conflict"`
- `answerStatus === "dropped"`

Rows are ingestable when they have:

- `status === "approved"`
- valid `year`
- subject present or inferable
- valid `correctAnswer`
- resolved `answerStatus`

## 8. Reconciliation Rules

Current reconciliation logic comes from `reconcileAnswerEvidence()` in `scripts/pyq-enrichment-utils.ts`.

Behavior summary:

- official reference answer -> `official_confirmed`
- official dropped reference -> `dropped`
- proposal + matching reference -> `provisional_correct`
- proposal + conflicting reference -> `conflict`
- proposal only -> `ai_provisional`
- reference only -> `provisional_correct`
- neither -> `pending`

## 9. Stability Notes

These contracts are the current code-consumed shapes, not a frozen external API.

Important implications:

- some files tolerate both array and object-map forms
- compact forms are accepted for backward compatibility
- several scripts depend on loose JSON compatibility rather than strict schema validation

If this project grows, the next hardening step should be explicit schema validation for these files using `zod` before any script reads them.

## 10. Tagging CSV Contracts

Tagging datasets live in `data/pyq/tagging/` and are governed by `rulebook.v1.2.md`.

Primary files:

```text
data/pyq/tagging/seed-master.csv
data/pyq/tagging/audit-50.csv
```

Core export files:

```text
data/pyq/tagging/seed-master.core.v1.csv
data/pyq/tagging/audit-50.core.v1.csv
```

### Core Fields

- `primary_concept`
- `question_intent`
- `cognitive_level`

### Advanced Fields (internal)

- `reasoning_type`
- `trap_type`
- `secondary_subject`
- `error_prone_area`
- `confidence_level`
- `trend_tag` (computed)

### Graph Outputs (derived)

```text
data/pyq/tagging/concepts.nodes.v1.csv
data/pyq/tagging/concepts.edges.v1.csv
data/pyq/tagging/concepts.stats.v1.csv
data/pyq/tagging/concepts.final.v1.csv
data/pyq/tagging/concepts.cluster.v1.csv
```

Last updated: 2026-03-22

Last updated: 2026-03-22

