# Architecture Version v0.3

Status: Draft  
Date: 2026-03-17  
Version: v0.3

## 1. Executive Summary
This version captures the stabilization phase of the PYQ pipeline, including the GS1 manual-gold workflow and the CSAT text pipeline with explicit diagram placeholders plus a Python OCR fallback for raw text generation.

## 2. Backend Core
- Runtime/framework: Node.js + TypeScript backend with scripts-driven data pipeline.
- Data storage: JSON-backed artifacts in `data/pyq/**` plus database ingestion for approved records.
- Auth: Unchanged from v0.2.
- Caching: Unchanged from v0.2.
- Deployment: Unchanged from v0.2.

## 3. API Architecture
- Route groups and contracts unchanged from v0.2.
- Pipeline outputs are consumed by ingestion scripts rather than API changes.

## 4. Client Architecture
- Web and mobile stacks unchanged from v0.2.

## 5. Data Architecture
- GS1 canonical datasets are generated from manual uploads and normalized to 100 questions per year.
- CSAT text files are staged in `docs/pyq-questions/csat/CSAT-YYYY.txt`.
- Diagram-dependent CSAT questions use explicit placeholders to preserve structure.
- Raw OCR outputs live in `data/pyq/papers/<year>/<paper>/raw/`.

## 6. Operational Architecture
- Primary OCR path: TypeScript pipeline.
- Fallback OCR path: Python `ocr_pdf_to_text.py` for heavy/slow PDFs.
- Manual review is required for diagram-heavy CSAT questions.

## 7. Security Architecture
- No change from v0.2.

## 8. Changes Since Previous Version
- Added: CSAT diagram placeholder policy for text-based ingestion.
- Added: Python OCR fallback as a supported operational path.
- Changed: Project brief updated with CSAT OCR status and diagram policy.

## 9. Open Questions
- Should CSAT diagram images be stored in repo or in external object storage?
- Do we need a formal schema field for image references in normalized JSON?

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

