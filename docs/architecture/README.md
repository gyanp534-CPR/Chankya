# Chankya Architecture Documentation

This repository uses a file-versioned architecture documentation system.

## Current Version
- `v0.5` (Draft - Mentor feedback experience layer): [docs/architecture/versions/v0.5/README.md](./versions/v0.5/README.md)

## Documentation Rules
- Every architecture update creates a new version folder under `docs/architecture/versions/`.
- Never overwrite historical versions.
- Record all changes in `docs/architecture/CHANGELOG.md`.
- Record major tradeoff decisions as ADRs under `docs/architecture/decisions/`.

## Structure
- `docs/architecture/README.md` - Architecture doc system and navigation
- `docs/architecture/CHANGELOG.md` - Version history
- `docs/architecture/VERSIONING_POLICY.md` - File-based version control rules
- `docs/architecture/versions/vX.Y/` - Immutable version snapshots
- `docs/architecture/decisions/ADR-XXXX-*.md` - Architecture Decision Records
- `docs/architecture/notes/journal.md` - Continuous architecture notes log
- `docs/architecture/templates/` - Templates for future versions and ADRs

## Next Version Workflow
1. Copy `templates/version-template.md` into a new version folder (for example: `v0.2`).
2. Update architecture content and tables.
3. Add a change entry to `CHANGELOG.md`.
4. Add ADRs for non-trivial decisions.
5. Update the "Current Version" pointer in this file.
6. Keep older versions untouched.

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25

