# PYQ Normalization Policy

## Parser Lock

The GS1/CSAT normalization logic in `scripts/normalize-pyq.ts` is now considered **stable**.
We will **not** modify the parsing algorithm further unless we are fixing a correctness bug.

All future quality improvements should happen **before** normalization in the OCR preprocessing
pipeline (image cleanup + OCR).

## Allowed Changes

- OCR preprocessing quality improvements
- OCR configuration tweaks (language packs, PSM, image cleanup steps)
- Metadata enrichment and analytics (subject/topic/concept tagging)

If a regression is suspected, prefer re-running OCR with improved preprocessing rather
than changing the parser.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

