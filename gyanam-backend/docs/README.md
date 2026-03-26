# Gyanam Backend Docs

This folder documents the current backend architecture, the PYQ pipeline, and the project handoff context needed to continue work in a new chat or by a new engineer.

After any tagging, dataset, or pipeline change, use the documentation checklist:
- `DOC-UPDATE-CHECKLIST.md`

To auto-refresh "Last updated" dates across docs:
`powershell -ExecutionPolicy Bypass -File ./scripts/update-doc-dates.ps1`

To auto-run this on each commit:
`powershell -ExecutionPolicy Bypass -File ./scripts/install-git-hooks.ps1`

CI option:
`.github/workflows/doc-dates.yml`

Daily auto-run (11:00 PM IST) also ensures missing docs are created via:
`./scripts/ensure-docs.ps1`

Key docs:

- `PROJECT-OVERVIEW.md`
  Current backend architecture, data flow, scripts, datasets, and known gaps.
- `PROJECT-BRIEF.md`
  Short project brief and current status.
- `MASTER-CONTINUATION-BRIEF.md`
  Paste-ready handoff brief for a new chat/session.
- `DOCUMENTATION-INDEX.md`
  Master index of all project documentation.
- `DATA-CONTRACTS.md`
  Current JSON/data shapes used by the PYQ pipeline.
- `TAXONOMY.md`
  Current subject, topic, and concept hierarchy and how it maps to the schema.
- `PYQ-TAGGING.md`
  Tagging schema, rulebook, graph outputs, and calibration workflow.
- `SCRIPT-RUNBOOK.md`
  Operational guide for running the backend scripts in the right order.
- `PYTHON-OCR.md`
  Hybrid OCR pipeline notes (Python OCR -> TS normalization).
- `BASE-QP-TEMPLATE.md`
  Checklist and completion standard for using one cleaned QP as the template for future papers.
- `PYQ-EXTRACTION-STACK.md`
  Centralized extraction/recovery method stack and shared review-note vocabulary for PYQ parsing.
- `OCR-FAILURE-PATTERNS.md`
  OCR-specific failure taxonomy and parser lessons from scanned UPSC booklet extraction.
- `event-taxonomy.md`
  Current event naming and governance baseline.
- `RELEASE-NOTES.md`
  Rolling release notes for platform work.
- `PLATFORM-DOCUMENTATION.md`
  Platform documentation checklist and gaps.
- `DOC-UPDATE-CHECKLIST.md`
  Checklist for keeping docs current after changes.
- `versions/v0.2.md`
  Historical project snapshot for the sprint-1 baseline.

Notes:

- Script names in these docs match the current repository.
- Where planning intent differs from current implementation, the docs call that out explicitly.
- The project status baseline lives in `docs/pyq-brief.txt`; update it after each OCR/normalize/trim/ingest/report run.
- Platform placeholders exist for API, security, observability, deployment, testing, and data quality.
- Adaptive mentor engine v1 is implemented in `assessment` with weak-area targeting, state-transition observability, and mentor feedback messaging with topic labels (see `PROJECT-OVERVIEW.md` for details).

Last updated: 2026-03-25

Last updated: 2026-03-25

