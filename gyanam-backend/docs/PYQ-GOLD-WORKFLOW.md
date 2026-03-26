# PYQ Gold Workflow

Use this when we want to measure OCR/parser quality against a frozen manual baseline instead of patching mistakes immediately.

## Gold dataset

Freeze trusted manual uploads into explicit gold JSON:

```bash
npm run build:pyq:gold -- --paper GS1 --years 2016,2017,2025
```

Outputs:

- `data/pyq/gold/papers/<year>/<paper>/gold.json`
- `data/pyq/gold/papers/<year>/<paper>/gold.txt`
- `data/pyq/gold/pyq.gold.v1.json`

## Parser-only OCR output

Run normalization without applying manual references:

```bash
npm run normalize:pyq -- --year 2016 --paper GS1 --skip-reference
```

This writes parser-only output to:

- `data/pyq/papers/<year>/<paper>/normalized.ocr.json`

The default `normalize:pyq` behavior still writes the reference-assisted file to `normalized.json`.

## Error measurement

Compare parser-only OCR output against the frozen gold dataset:

```bash
npm run report:pyq:gold-vs-ocr -- --paper GS1 --years 2016,2017,2025
```

Outputs:

- `data/pyq/gold/reports/<year>/<paper>/ocr-vs-gold.json`

The report includes:

- exact row match count and rate
- question text mismatches
- option row mismatches
- option slot mismatches
- missing rows
- sample mismatches for inspection

Last updated: 2026-03-22

Last updated: 2026-03-22

