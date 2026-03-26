export type PyqExtractionMethodId =
  | "native-pdf-text"
  | "ocr-bilingual-despread"
  | "ocr-normalize-segmentation"
  | "ocr-placeholder-backfill"
  | "manual-recovered-from-ocr"
  | "manual-recovered-from-user"
  | "ai-fallback";

export type PyqExtractionMethod = {
  id: PyqExtractionMethodId;
  stage: "parse" | "normalize" | "recovery";
  description: string;
  active: boolean;
};

export const PYQ_EXTRACTION_METHODS = {
  nativePdfText: {
    id: "native-pdf-text",
    stage: "parse",
    description: "Extract embedded PDF text directly before attempting OCR.",
    active: true,
  },
  ocrBilingualDespread: {
    id: "ocr-bilingual-despread",
    stage: "parse",
    description: "Rasterize scanned booklet pages, split bilingual spreads, and run eng+hin OCR.",
    active: true,
  },
  ocrNormalizeSegmentation: {
    id: "ocr-normalize-segmentation",
    stage: "normalize",
    description: "Recover OCR question boundaries, option markers, and numbering drift with heuristics.",
    active: true,
  },
  ocrPlaceholderBackfill: {
    id: "ocr-placeholder-backfill",
    stage: "normalize",
    description: "Emit placeholder rows for missing OCR question blocks to preserve 100-question paper shape.",
    active: true,
  },
  manualRecoveredFromOcr: {
    id: "manual-recovered-from-ocr",
    stage: "recovery",
    description: "Manual repair based on raw OCR page text when parser output is still malformed.",
    active: true,
  },
  manualRecoveredFromUser: {
    id: "manual-recovered-from-user",
    stage: "recovery",
    description: "Manual repair from trusted external transcription supplied by the operator.",
    active: true,
  },
  aiFallback: {
    id: "ai-fallback",
    stage: "recovery",
    description: "Planned last-resort recovery step after native text extraction and OCR both fail.",
    active: false,
  },
} as const satisfies Record<string, PyqExtractionMethod>;

export const PYQ_EXTRACTION_PIPELINE = [
  PYQ_EXTRACTION_METHODS.nativePdfText,
  PYQ_EXTRACTION_METHODS.ocrBilingualDespread,
  PYQ_EXTRACTION_METHODS.ocrNormalizeSegmentation,
  PYQ_EXTRACTION_METHODS.ocrPlaceholderBackfill,
  PYQ_EXTRACTION_METHODS.manualRecoveredFromOcr,
  PYQ_EXTRACTION_METHODS.manualRecoveredFromUser,
  PYQ_EXTRACTION_METHODS.aiFallback,
] as const;

export const PYQ_REVIEW_NOTES = {
  ocrMissingQuestionBlock: "ocr-missing-question-block",
  ocrNoOptions: "ocr-no-options",
  ocrIncompleteOptions: "ocr-incomplete-options",
  manualRecoveredFromOcr: "manual-recovered-from-ocr",
  manualRecoveredFromUser: "manual-recovered-from-user",
} as const;

