# Documentation Index

This index tracks the primary product and data documentation for the Gyanam backend, with a focus on the UPSC PYQ pipeline and tagging system.

## Core Project Docs
- `README.md`  
  Doc entrypoint and navigation.
- `PROJECT-OVERVIEW.md`  
  Architecture, pipeline, datasets, and current state.
- `PROJECT-BRIEF.md`
  Short project brief and current status.
- `MASTER-CONTINUATION-BRIEF.md`  
  Handoff summary for a new session.
- `CHANGELOG.md`  
  Historical change log of engineering milestones.
- `versions/v0.2.md`  
  Sprint-1 baseline snapshot.

## Data & Schema Docs
- `DATA-CONTRACTS.md`  
  JSON and CSV data contracts for the PYQ pipeline.
- `TAXONOMY.md`  
  Subject/topic/concept hierarchy and constraints.
- `PYQ-TAGGING.md`  
  Tagging schema, rulebook, outputs, and workflow.
- `data/pyq/tagging/failure-taxonomy.v1.md`
  Failure taxonomy for error_prone_area tagging.

## Platform Operations & Quality
- `API-REFERENCE.md`
  Backend API surface (placeholder).
- `SECURITY.md`
  Auth and security model (placeholder).
- `OBSERVABILITY.md`
  Logging/metrics/tracing (placeholder).
- `DEPLOYMENT.md`
  Deployment and env setup (placeholder).
- `TESTING-GUIDE.md`
  Test strategy and how to run tests (placeholder).
- `DATA-QUALITY.md`
  Data quality gates and review policy (placeholder).

## Ops / Runbooks
- `SCRIPT-RUNBOOK.md`  
  Script execution order and operational notes.
- `migration-staging-checklist.md`  
  Data migration checklist.
- `PYQ-EXTRACTION-STACK.md`  
  OCR and extraction method stack.
- `PYTHON-OCR.md`  
  OCR pipeline notes.
- `OCR-FAILURE-PATTERNS.md`  
  Known OCR failure taxonomy.

## Templates & Reference
- `BASE-QP-TEMPLATE.md`  
  Template and completion standard for paper cleanup.
- `event-taxonomy.md`  
  Event naming baseline.

## Product & Release Notes
- `RELEASE-NOTES.md`  
  Rolling release notes for the platform.
- `FUTURE-WORK.md`
  Forward-looking ideas, risks, and open questions.
- `PLATFORM-DOCUMENTATION.md`  
  Checklist of required platform documentation and gaps.
- `DOC-UPDATE-CHECKLIST.md`
  Checklist for keeping docs current after changes.
- `scripts/update-doc-dates.ps1`
  Utility to auto-refresh "Last updated" dates across all docs.
- `scripts/install-git-hooks.ps1`
  Installs a pre-commit hook to update doc dates automatically.
- `.github/workflows/doc-dates.yml`
  CI workflow to auto-update doc dates on doc changes.
- `scripts/ensure-docs.ps1`
  Ensures required docs exist before updating dates.

If you add new documentation, update this index.

Last updated: 2026-03-25

Last updated: 2026-03-25

