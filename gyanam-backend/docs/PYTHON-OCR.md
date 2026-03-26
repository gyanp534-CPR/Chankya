# Python OCR (Hybrid Pipeline)

This project supports a hybrid pipeline:

PDF â†’ **Python OCR** â†’ `.txt` â†’ **TypeScript normalizer** â†’ `normalized.json`.

## Prerequisites

- Python 3.12 (recommended on Windows)
- Tesseract OCR installed and available on PATH
  - Ensure `tesseract.exe` is discoverable (`where tesseract`).
  - Install language packs for `eng` and `hin`.
  - Default Windows install path: `C:\Program Files\Tesseract-OCR\tesseract.exe`

## Setup

```powershell
cd gyanam-backend
py -3.12 -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r scripts/python/requirements.txt
```

## OCR a PDF to text

```powershell
python scripts/python/ocr_pdf_to_text.py --pdf "data\pyq\papers\2016\gs1\raw\question-paper.pdf" --out "data\pyq\papers\2016\gs1\raw\question-paper.txt"
```

This output is compatible with `normalize-pyq.ts` (it includes `-- OCR page-<n>.png --` markers).

## Normalize after OCR

```powershell
npm run normalize:pyq -- --year 2016 --paper GS1
```

## Debug view + confidence

```powershell
npm run debug:pyq -- --year 2016 --paper GS1
```

This produces `data/pyq/papers/2016/gs1/debug.html` and a low-confidence list in `data/pyq/papers/2016/gs1/low-confidence.json`.

Last updated: 2026-03-22

Last updated: 2026-03-22

