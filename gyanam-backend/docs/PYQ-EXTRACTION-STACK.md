# PYQ Extraction Stack

The source of truth for the current extraction and recovery stack lives in:

- [scripts/pyq-extraction-methods.ts](/d:/Chanyakya/Chankya/gyanam-backend/scripts/pyq-extraction-methods.ts)

This file exists so the available methods and review-note vocabulary are not scattered across scripts.

## Current method order

1. `native-pdf-text`
2. `ocr-bilingual-despread`
3. `ocr-normalize-segmentation`
4. `ocr-placeholder-backfill`
5. `manual-recovered-from-ocr`
6. `manual-recovered-from-user`
7. `ai-fallback` (planned, not active yet)

## Review notes

These notes are also centralized in code:

- `ocr-missing-question-block`
- `ocr-no-options`
- `ocr-incomplete-options`
- `manual-recovered-from-ocr`
- `manual-recovered-from-user`

## Why this matters

When a future paper fails extraction, the response should be:

- improve the existing stack in code first
- keep fallback methods available in code
- avoid re-inventing or re-locating the same recovery paths across chats or sessions

Last updated: 2026-03-22

Last updated: 2026-03-22

