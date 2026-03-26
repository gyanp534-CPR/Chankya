# OCR Failure Patterns

This document records the OCR failure modes observed while extracting `2024 GS1` from the scanned UPSC booklet and the parser changes added to reduce repeat manual cleanup on future papers.

## Why this exists

The newer UPSC papers are scanned bilingual booklets, not clean text PDFs. The main failures were not only OCR quality issues, but also layout and segmentation issues:

- question number drift across page halves
- English and Hindi content interleaving
- option markers collapsing into malformed OCR text
- multiple answer choices being merged into one line
- question blocks being present but dropped because fewer than 4 options were recovered

## Observed failure modes

### 1. Question number drift

Examples:

- standalone number on one line, question lead on the next
- number missing the period
- OCR misreading the number and causing later rows to collapse onto wrong IDs

Mitigation in parser:

- recognize standalone numeric lines as pending question numbers
- resequence OCR rows when raw numbering jumps implausibly
- fill missing question numbers with explicit placeholder rows for OCR sources

### 2. Option marker corruption

Examples:

- `a)` / `b)` / `d)` instead of `(a)` / `(b)` / `(d)`
- `@)` used as option `d`
- `Â®)` and `Â©)` used as options `b` / `c`
- stray mojibake around option labels

Mitigation in parser:

- normalize common OCR marker variants before extraction
- use a line-based option extractor before the regex fallback

### 3. Packed code-style options

Examples:

- `1and2only`
- `2and3only`
- `Bothland2`
- `Neither 1nor 2`
- `Onlyone`, `Onlytwo`, `ll four`

Mitigation in parser:

- normalize these packed tokens in option post-processing
- preserve them as structured 4-option sets instead of dropping the row

### 4. Embedded next-question spillover

Examples:

- option 4 contains the next question lead sentence
- the next question starts on the same OCR line after the previous option set

Mitigation in parser:

- split lines on embedded lead phrases such as:
  - `Consider the following`
  - `With reference to`
  - `Which one of the following`
- flush the current block when a new lead phrase appears after a complete option set

### 5. No-option OCR blocks

Examples:

- question text exists
- page clearly contains the question
- options were not recovered at all

Mitigation in parser:

- for OCR sources, preserve these rows as `pending_review`
- mark them with explicit review notes instead of silently dropping them

## Review note meanings

- `ocr-missing-question-block`
  The question number was missing from OCR output after normalization, so a placeholder row was created to preserve paper shape.
- `ocr-no-options`
  The question block was found but no options were recovered.
- `ocr-incomplete-options`
  Fewer than 4 options were recovered, so placeholders were added.
- `manual-recovered-from-user`
  The row was manually patched from an external recovered transcription.
- `manual-recovered-from-ocr`
  The row was repaired from the raw OCR page text after parser inspection.

## Recommended future pipeline

For scanned papers, use this order:

1. native PDF text extraction
2. OCR fallback
3. normalization with OCR heuristics
4. validation / auto-review
5. targeted AI/manual fallback only for rows still carrying OCR review notes

## What not to do

- Do not treat placeholder rows as valid extracted content.
- Do not ingest OCR placeholder or incomplete rows without review.
- Do not rely on raw OCR numbering as ground truth for scanned booklet papers.

Last updated: 2026-03-22

Last updated: 2026-03-22

