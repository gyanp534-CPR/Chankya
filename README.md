# Chankya Workspace

This workspace currently contains the Gyanam backend and related project assets.

## Versioning
We follow Semantic Versioning and maintain release notes in `CHANGELOG.md`.
See `docs/versioning.md` for the release workflow and `docs/release-tag-template.md`
for release notes formatting.

## Project Map

- `gyanam-backend`
  Backend API, Prisma schema, PYQ pipeline scripts, and backend documentation.
- `gyanam-web`
  Frontend application workspace.
- `docs`
  Top-level workspace docs, if any are added later.

## Frontend Deployment

The frontend is deployed from `gyanam-web` on Vercel. Environment requirements and routes
are documented in `gyanam-web/README.md`.

## Branch Workflow (Contributors)

We do not push directly to `main`. Use a branch-only workflow:

- Create a feature branch from `main`.
- Open a PR for review.
- Merge to `main` only after validation.

Deploy flow:
- Vercel production tracks `main`.
- Preview deployments are created for PR branches.

## Current Focus

The active backend focus is the **PYQ Intelligence Engine** inside `gyanam-backend`.
Deferred improvements and future work items are tracked in `docs/pyq-brief.txt`.

## Project Status (Behavioral Contract)

The single source of truth for current progress is:
- `docs/pyq-brief.txt`

This README is the **behavioral contract** for the PYQ pipeline. It defines intent, invariants, and the rules that keep data quality stable. If a rule below is violated, the pipeline should stop and the issue should be fixed upstream (usually OCR).

Keep `docs/pyq-brief.txt` updated after OCR/normalize/trim/ingest/report runs so future sessions inherit accurate status.

## Pipeline Intent

The pipeline exists to convert official UPSC PDFs into **clean, structured, reviewable PYQ records**. The goal is stable extraction quality first, enrichment second, and ML later.

## Canonical Pipeline Flow

```text
PDF â†’ OCR â†’ raw text â†’ normalization â†’ structured JSON â†’ ingestion
```

Hybrid mode (recommended):

```text
PDF â†’ Python OCR â†’ raw text â†’ TypeScript normalizer â†’ JSON â†’ ingestion
```

## Dataset Invariants (Must Hold)

- Every GS1 prelims paper has **100 questions** (2023 is allowed 100 placeholders for the dropped question).
- Each question has **exactly four options**.
- IDs follow `UPSC_<YEAR>_GS1_Q<number>` (or CSAT).
- Question numbers run sequentially from Q1 â†’ Q100.
- Placeholder text is allowed only when flagged for review.

## Validation Checklist (Run After Each Update)

- Question count equals 100 (or allowed exception).
- No empty question text.
- Options count equals four.
- No OCR placeholder markers unless flagged.
- IDs are sequential and unique.

## Pipeline Memory (Lessons Learned)

- OCR overâ€‘segmentation can create >100 rows.
  - Fix: instructionâ€‘noise stripping + questionâ€‘number guards.
- 2023 GS1 has an officially dropped question.
  - Fix: keep placeholders and allow 100.
- Poor OCR quality corrupts downstream parsing.
  - Fix: prioritize OCR improvements before parser changes.
- Instruction pages sometimes survive OCR and break parsing.
  - Fix: configure hard page skips in `gyanam-backend/data/pyq/instruction-page-skip.json`.

## Instruction Page Skips (Hard Overrides)

Use `gyanam-backend/data/pyq/instruction-page-skip.json` to skip pages before parsing questions.
Entries support:

- `default`: applies to all papers.
- `GS1` / `CSAT`: paper-wide defaults.
- `<YEAR>-<PAPER>` (e.g., `2016-GS1`): per-paper overrides.

Each entry supports:

- `skipFirstPages`: number of leading pages to skip.
- `skipPages`: explicit page indices to skip (1-based).

## Canonical File Locations

- Raw PDFs: `gyanam-backend/data/pyq/papers/<year>/<paper>/raw/question-paper.pdf`
- OCR text: `gyanam-backend/data/pyq/papers/<year>/<paper>/raw/question-paper.txt`
- OCR cleaned page images: `gyanam-backend/data/pyq/papers/<year>/<paper>/raw/ocr-cleaned/`
- Normalized JSON: `gyanam-backend/data/pyq/papers/<year>/<paper>/normalized.json`
- Low-confidence review report: `gyanam-backend/data/pyq/papers/<year>/<paper>/low-confidence.json`
- Debug review HTML: `gyanam-backend/data/pyq/papers/<year>/<paper>/debug.html`
- Manual authoritative upload: `gyanam-backend/docs/pyq-questions/<paper-lower>/ManualUpload<year>.ts`
- Reference export text: `gyanam-backend/docs/pyq-questions/<paper-lower>/<paper-lower>-<year>.txt`
- Consolidated dataset: `gyanam-backend/data/pyq/pyq.prelims.v1.json`

## Sample Normalized Record (Reference Shape)

```json
{
  "id": "UPSC_2024_GS1_Q1",
  "year": 2024,
  "examStage": "prelims",
  "paperType": "GS1",
  "sourceFile": "question-paper.txt",
  "questionText": "Sample question text...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "status": "pending_review",
  "reviewNotes": "",
  "confidenceScore": 92,
  "confidenceFlags": []
}
```

## Roadmap (System Evolution)

Current priority: **stabilize ruleâ€‘based normalization** with stronger OCR.

Future stage: **MLâ€‘assisted parsing** after we lock clean goldâ€‘standard datasets.

## Working Rule For New Papers

For any new paper, use this order of operations:

1. Generate OCR text from cleaned page images.
2. Run the TypeScript normalizer.
3. Generate debug HTML and inspect the paper visually.
4. Review `low-confidence.json`.
5. If a question is still wrong after parser/OCR cleanup, add it to `ManualUpload<year>.ts`.
6. Rerun normalization so the manual upload replaces the broken parsed row.
7. Export the final cleaned text only from `normalized.json`, not from stale OCR text.

This is the governing rule:

- OCR is the first layer.
- The parser is the second layer.
- Manual upload is the authoritative fallback.
- Confidence score is a review signal, not a guarantee of correctness.

## Manual Upload Policy

- Use `ManualUpload<year>.ts` when a question remains incorrect after reasonable parser attempts.
- Manual upload entries should be treated as authoritative for those question numbers.
- Partial manual uploads are allowed; they should overwrite only the covered questions.
- Full manual uploads are the fastest route to a production-clean paper when OCR quality is poor.

## Confidence Score Policy

Confidence exists to prioritize review, not to certify truth.

- A score of `100` should mean the row looks structurally clean and has no detected OCR artifacts.
- Rows with mojibake, footer bleed, broken statement markers, placeholder options, or truncated text must be penalized.
- `low-confidence.json` is the operational review queue for manual cleanup.
- If human inspection disagrees with the score, fix the scorer.

## Practical Paper Workflow

Run these from `gyanam-backend/` for a new paper:

```text
npx tsx scripts/ocr-images-to-text.ts --year <YEAR> --paper GS1
npm run normalize:pyq -- --year <YEAR> --paper GS1
npm run debug:pyq -- --year <YEAR> --paper GS1
```

Then review:

```text
data/pyq/papers/<year>/<paper>/debug.html
data/pyq/papers/<year>/<paper>/low-confidence.json
docs/pyq-questions/<paper-lower>/ManualUpload<year>.ts
```

After manual corrections are added:

```text
npm run normalize:pyq -- --year <YEAR> --paper GS1
npm run debug:pyq -- --year <YEAR> --paper GS1
```

## Start Here

Backend documentation entry point:

- [docs/README.md](/d:/Chanyakya/Chankya/gyanam-backend/docs/README.md)

Most important backend docs:

- [PROJECT-OVERVIEW.md](/d:/Chanyakya/Chankya/gyanam-backend/docs/PROJECT-OVERVIEW.md)
- [MASTER-CONTINUATION-BRIEF.md](/d:/Chanyakya/Chankya/gyanam-backend/docs/MASTER-CONTINUATION-BRIEF.md)
- [DATA-CONTRACTS.md](/d:/Chanyakya/Chankya/gyanam-backend/docs/DATA-CONTRACTS.md)
- [SCRIPT-RUNBOOK.md](/d:/Chanyakya/Chankya/gyanam-backend/docs/SCRIPT-RUNBOOK.md)

## Current Backend Milestone

The backend is still aligned with the original roadmap and is currently in the final stretch of the first PYQ pipeline milestone:

```text
populate answer references
-> reconcile answers into enrichment
-> apply enrichment to normalized PYQs
-> ingest approved, resolved PYQs into the database
```

## Practical Next Commands

Run these from `gyanam-backend/`:

```text
npm run bootstrap:pyq:answers
npm run fetch:answer-keys -- --year 2023 --paper GS1
npm run fetch:coaching-answer-keys -- --year 2023 --paper GS1
npm run enrich:pyq:answers
npm run apply:pyq:enrichment
npm run ingest:pyq
```

## Notes

- The repo has migration history and versioned datasets, but not a true application-level file versioning system.
- The backend docs under `gyanam-backend/docs/` are the current source of truth for architecture, data contracts, and operational workflow.

Last updated: 2026-03-22

