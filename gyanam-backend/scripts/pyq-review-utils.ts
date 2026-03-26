export type ReviewStatus = "pending_review" | "approved" | "rejected";
export type PaperType = "GS1" | "CSAT";

export type NormalizedPyqRecord = {
  id: string;
  year: number | null;
  examStage: "prelims";
  paperType: PaperType;
  sourceFile: string;
  questionText: string;
  options: string[];
  status: ReviewStatus;
  reviewNotes: string;
  subject?: string;
  subjectStatus?: "pending" | "auto_inferred" | "manual";
  topic?: string | null;
  conceptTags?: string[];
  correctAnswer?: string;
  answerStatus?: string;
  answerSource?: string;
};

export type ReviewIssue = {
  severity: "repairable" | "manual" | "rejected";
  code: string;
  detail: string;
};

const SHORT_OPTION_ALLOWLIST = new Set(["none", "1 only", "2 only"]);
const REJECT_OPTION_PATTERNS = [
  /\bBoth\s+1\s+and\b/i,
  /\bNeither\s+1\s+nor\b/i,
  /\bThe Charter Act of\b$/i,
  /\bBoth Statement-!? and Stateme\b/i,
];

export function cleanRepairableText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([A-Za-z])\.\s+([a-z])/g, "$1.$2")
    .replace(/([A-Za-z])-\s+([A-Za-z])/g, "$1-$2")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function isShortOption(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length < 5 && !SHORT_OPTION_ALLOWLIST.has(normalized);
}

function hasTruncatedOption(value: string) {
  const normalized = value.trim();
  return REJECT_OPTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasLowercaseContinuation(value: string) {
  return /^[a-z]/.test(value.trim());
}

export function inspectRow(row: NormalizedPyqRecord) {
  const cleanedQuestionText = cleanRepairableText(row.questionText);
  const cleanedOptions = row.options.map(cleanRepairableText);
  const issues: ReviewIssue[] = [];

  if (cleanedOptions.length !== 4) {
    issues.push({
      severity: "rejected",
      code: "option_count_invalid",
      detail: `expected 4 options, found ${cleanedOptions.length}`,
    });
  }

  if (cleanedQuestionText.length < 30) {
    issues.push({
      severity: "rejected",
      code: "question_too_short",
      detail: `question text too short (${cleanedQuestionText.length})`,
    });
  }

  cleanedOptions.forEach((option, index) => {
    if (isShortOption(option)) {
      issues.push({
        severity: "manual",
        code: "option_too_short",
        detail: `option ${index + 1} too short`,
      });
    }

    if (hasTruncatedOption(option)) {
      issues.push({
        severity: "rejected",
        code: "option_truncated",
        detail: `option ${index + 1} looks truncated`,
      });
    }

    if (hasLowercaseContinuation(option)) {
      issues.push({
        severity: "manual",
        code: "option_lowercase_continuation",
        detail: `option ${index + 1} starts like a continuation fragment`,
      });
    }
  });

  if (cleanedQuestionText.includes("~") || cleanedQuestionText.includes("fare") || cleanedQuestionText.includes("isfare")) {
    issues.push({
      severity: "manual",
      code: "ocr_noise_question",
      detail: "question text contains OCR noise",
    });
  }

  if (cleanedOptions.some((option) => option.includes("~") || option.includes("materia") || option.includes("Stateme"))) {
    issues.push({
      severity: "manual",
      code: "ocr_noise_option",
      detail: "option text contains OCR noise",
    });
  }

  const nextStatus: ReviewStatus =
    issues.some((issue) => issue.severity === "rejected")
      ? "rejected"
      : issues.length === 0
        ? "approved"
        : "pending_review";

  const reviewNotes =
    nextStatus === "approved"
      ? "auto-approved: structure valid"
      : nextStatus === "rejected"
        ? issues
            .filter((issue) => issue.severity === "rejected")
            .map((issue) => issue.detail)
            .join("; ")
        : issues.map((issue) => issue.detail).join("; ");

  return {
    cleanedRow: {
      ...row,
      questionText: cleanedQuestionText,
      options: cleanedOptions,
    },
    issues,
    nextStatus,
    reviewNotes,
  };
}
