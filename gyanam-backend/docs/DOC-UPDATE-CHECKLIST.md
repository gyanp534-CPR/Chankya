# Documentation Update Checklist

Use this checklist after any significant changes to data, tagging, or pipeline behavior.

Last updated: 2026-03-22

To refresh dates automatically across all docs, run:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/update-doc-dates.ps1
```

Optional: install a pre-commit hook to auto-refresh dates before each commit:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/install-git-hooks.ps1
```

Optional CI: GitHub Actions workflow to auto-update doc dates:
- `.github/workflows/doc-dates.yml`

Daily auto-run at 11:00 PM IST (via cron in the workflow) ensures docs exist and dates are refreshed.

Note: the nightly job is non-destructive. It does not overwrite existing content.

## Core Updates
- Update `PROJECT-OVERVIEW.md` with new pipelines, files, or flow changes.
- Update `MASTER-CONTINUATION-BRIEF.md` for handoff-critical changes.
- Append to `CHANGELOG.md` for engineering-impacting changes.
- Append to `RELEASE-NOTES.md` for product-facing milestones.

## Tagging & Intelligence
- Update `PYQ-TAGGING.md` when schema or rulebook changes.
- Update `rulebook.v1.2.md` for new field logic or calibration rules.
- Regenerate `seed-master.core.v1.csv` if CORE field definitions change.
- Recompute derived outputs (`concepts.*.v1.csv`) if tagging logic changes.

## Data Contracts & Taxonomy
- Update `DATA-CONTRACTS.md` if any data file shape changes.
- Update `TAXONOMY.md` if subject/topic/concept structure changes.

## Platform Docs (placeholders until filled)
- `API-REFERENCE.md`
- `SECURITY.md`
- `OBSERVABILITY.md`
- `DEPLOYMENT.md`
- `TESTING-GUIDE.md`
- `DATA-QUALITY.md`

## Indexing
- Update `DOCUMENTATION-INDEX.md` if new docs are added.
- Update `docs/README.md` to surface key doc additions.

Last updated: 2026-03-22

Last updated: 2026-03-22

