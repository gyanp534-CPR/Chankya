import fs from "node:fs";
import path from "node:path";
import {
  ensureParentDir,
  getPaperArtifacts,
  listPaperScopes,
  parsePyqCliArgs,
} from "./pyq-paths.js";
import { PYQ_REVIEW_NOTES } from "./pyq-extraction-methods.js";

const TEXT_DIR = path.resolve(process.cwd(), "data/raw_pyq_text");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");
const INSTRUCTION_PAGE_SKIP_PATH = path.resolve(
  process.cwd(),
  "data/pyq/instruction-page-skip.json",
);
const REFERENCE_ROOT = path.resolve(process.cwd(), "docs/pyq-questions");

type ReviewStatus = "pending_review" | "approved" | "rejected";
type PaperType = "GS1" | "CSAT";

type NormalizedPyqRecord = {
  id: string;
  year: number | null;
  examStage: "prelims";
  paperType: PaperType;
  sourceFile: string;
  questionText: string;
  options: string[];
  status: ReviewStatus;
  reviewNotes: string;
  confidenceScore?: number;
  confidenceFlags?: string[];
};

type InstructionPageSkipConfig = {
  skipFirstPages?: number;
  skipPages?: number[];
};

type InstructionPageSkipMap = Record<string, InstructionPageSkipConfig>;

type ReferenceQuestion = {
  id: string;
  number: number;
  questionText: string;
  options: string[];
  source: "manual" | "export";
};

function createOcrPlaceholderRow(params: {
  year: number | null;
  paperType: PaperType;
  fileName: string;
  questionNumber: number;
}): NormalizedPyqRecord {
  return {
    id: `UPSC_${params.year}_${params.paperType}_Q${params.questionNumber}`,
    year: params.year,
    examStage: "prelims",
    paperType: params.paperType,
    sourceFile: params.fileName,
    questionText: `[OCR extraction failed for question ${params.questionNumber}]`,
    options: Array.from({ length: 4 }, () => "[option unreadable from OCR]"),
    status: "pending_review",
    reviewNotes: PYQ_REVIEW_NOTES.ocrMissingQuestionBlock,
  };
}

function parseYear(source: string) {
  const normalizedSource = source.replace(/\\/g, "/");
  const pathYear = normalizedSource.match(/\/papers\/(20\d{2})\//i);
  if (pathYear?.[1]) {
    return Number(pathYear[1]);
  }

  const fourDigit = normalizedSource.match(/20\d{2}/);
  if (fourDigit) {
    return Number(fourDigit[0]);
  }

  const cspShort = normalizedSource.match(/csp[-_](\d{2})/i);
  if (cspShort?.[1]) {
    return Number(`20${cspShort[1]}`);
  }

  const trailingShort = normalizedSource.match(/(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/);
  if (trailingShort?.[1]) {
    return Number(`20${trailingShort[1]}`);
  }

  return null;
}

function detectPaperType(source: string): PaperType {
  const lower = source.replace(/\\/g, "/").toLowerCase();
  if (lower.includes("/csat/")) {
    return "CSAT";
  }
  if (lower.includes("/gs1/")) {
    return "GS1";
  }

  if (lower.includes("paper-ii") || lower.includes("paper_ii") || lower.includes("paper ii") || lower.includes("csat")) {
    return "CSAT";
  }
  return "GS1";
}

let instructionPageSkipCache: InstructionPageSkipMap | null = null;

function loadInstructionPageSkipMap(): InstructionPageSkipMap {
  if (instructionPageSkipCache) {
    return instructionPageSkipCache;
  }

  if (!fs.existsSync(INSTRUCTION_PAGE_SKIP_PATH)) {
    instructionPageSkipCache = {};
    return instructionPageSkipCache;
  }

  try {
    const raw = fs.readFileSync(INSTRUCTION_PAGE_SKIP_PATH, "utf-8");
    const parsed = JSON.parse(raw) as InstructionPageSkipMap;
    instructionPageSkipCache = parsed ?? {};
    return instructionPageSkipCache;
  } catch (error) {
    console.warn(
      `Failed to parse instruction page skip config at ${INSTRUCTION_PAGE_SKIP_PATH}:`,
      error,
    );
    instructionPageSkipCache = {};
    return instructionPageSkipCache;
  }
}

function normalizeInstructionSkipConfig(config: InstructionPageSkipConfig | undefined) {
  if (!config) {
    return { skipFirstPages: 0, skipPages: [] as number[] };
  }

  const skipFirstPages = Number.isInteger(config.skipFirstPages)
    ? Math.max(0, config.skipFirstPages ?? 0)
    : 0;
  const skipPages = Array.from(
    new Set(
      (config.skipPages ?? []).filter((page) => Number.isInteger(page) && page > 0),
    ),
  ).sort((left, right) => left - right);

  return { skipFirstPages, skipPages };
}

function getInstructionPageSkipConfig(year: number | null, paperType: PaperType) {
  const map = loadInstructionPageSkipMap();
  const key = year ? `${year}-${paperType}` : "";
  const merged: InstructionPageSkipConfig = {
    ...map.default,
    ...map[paperType],
    ...(key ? map[key] : {}),
  };
  return normalizeInstructionSkipConfig(merged);
}

function applyInstructionPageSkips(
  pages: string[],
  config: { skipFirstPages: number; skipPages: number[] },
) {
  if (pages.length === 0) {
    return pages;
  }

  const skipPages = new Set(config.skipPages);
  return pages.filter((page, index) => {
    const pageNumber = index + 1;
    if (pageNumber <= config.skipFirstPages) {
      return false;
    }
    if (skipPages.has(pageNumber)) {
      return false;
    }
    return page.trim().length > 0;
  });
}

function applyInstructionPageSkipsWithMetadata(
  pages: MergedPage[],
  config: { skipFirstPages: number; skipPages: number[] },
) {
  if (pages.length === 0) {
    return pages;
  }

  const skipPages = new Set(config.skipPages);
  return pages.filter((page, index) => {
    const pageNumber = page.pageNumber ?? index + 1;
    if (page.pageNumber !== undefined && page.pageNumber <= config.skipFirstPages) {
      return false;
    }
    if (page.pageNumber === undefined && index < config.skipFirstPages) {
      return false;
    }
    if (page.pageNumber !== undefined && skipPages.has(page.pageNumber)) {
      return false;
    }
    return page.text.trim().length > 0;
  });
}

function filterOddEnglishPagesWithMetadata(pages: MergedPage[]) {
  if (pages.length === 0) {
    return pages;
  }

  const numberedPages = pages.filter((page) => Number.isInteger(page.pageNumber));
  if (numberedPages.length < 6) {
    return pages;
  }

  const englishOddPages = pages.filter((page) => {
    if (!Number.isInteger(page.pageNumber)) {
      return true;
    }
    const pageNumber = page.pageNumber as number;
    if (pageNumber < 3) {
      return false;
    }
    return pageNumber % 2 === 1;
  });

  if (englishOddPages.length < 4) {
    return pages;
  }

  return englishOddPages;
}

function normalizeLine(line: string) {
  return line
    .replace(/--\s*OCR\s+page-[^-\n]+--/gi, " ")
    .replace(/\bOCR\s+page-[\w.-]+\s*\.?\s*png(?:\s+\w+)?\b/gi, " ")
    .replace(/^f\s*([a-d])[\)\}]?\s+/gi, "($1) ")
    .replace(/ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·/g, "")
    .replace(/\(\s*[28]\s*\)/g, "(a)")
    .replace(/^[28]\)\s+/g, "(a) ")
    .replace(/^a\)\s+/gi, "(a) ")
    .replace(/^b\)\s+/gi, "(b) ")
    .replace(/^c\)\s+/gi, "(c) ")
    .replace(/^d\)\s+/gi, "(d) ")
    .replace(/^[®]\)\s+/g, "(b) ")
    .replace(/^[©¢]\)\s+/g, "(c) ")
    .replace(/^@\)\s+/g, "(d) ")
    .replace(/\(\s*Ãƒâ€šÃ‚Â®\s*\)|\(\s*Ã‚Â®\s*\)|Ãƒâ€šÃ‚Â®\)/g, "(b)")
    .replace(/\(\s*Ãƒâ€šÃ‚Â©\s*\)|\(\s*Ã‚Â©\s*\)|Ãƒâ€šÃ‚Â©\)/g, "(c)")
    .replace(/\(\s*@\s*\)/g, "(d)")
    .replace(/^@\s+/g, "(d) ")
    .replace(/^\(\s*\)\s+/g, "(b) ")
    .replace(/^\)\s+/g, "(b) ")
    .replace(/^\(\s*e\s*\)\s+/gi, "(c) ")
    .replace(/^\(\s*g\s*\)\s+/gi, "(d) ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PageMarker = {
  text: string;
  pageNumber?: number;
  side?: "left" | "right" | "top" | "bottom";
};

type MergedPage = {
  text: string;
  pageNumber?: number;
};

function splitPagesWithMarkers(raw: string): PageMarker[] {
  const markers: PageMarker[] = [];
  const markerRegex =
    /--\s*(\d+\s*of\s*\d+|OCR\s+(?:page|image)(?:\s+page)?-(\d+)[^-\n]*\.png(?:\s+(left|right|top|bottom))?)\s*--/gi;

  let lastIndex = 0;
  let lastMarker: { pageNumber?: number; side?: "left" | "right" } | null = null;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(raw)) !== null) {
    if (lastMarker) {
      markers.push({
        text: raw.slice(lastIndex, match.index).trim(),
        pageNumber: lastMarker.pageNumber,
        side: lastMarker.side,
      });
    }

    const pageNumber = match[2] ? Number(match[2]) : undefined;
    const side =
      match[3] === "left" || match[3] === "right" || match[3] === "top" || match[3] === "bottom"
        ? match[3]
        : undefined;
    lastMarker = { pageNumber, side };
    lastIndex = match.index + match[0].length;
  }

  if (lastMarker) {
    markers.push({
      text: raw.slice(lastIndex).trim(),
      pageNumber: lastMarker.pageNumber,
      side: lastMarker.side,
    });
  }

  return markers;
}

function mergePageMarkers(segments: PageMarker[]): MergedPage[] {
  const mergedPages: MergedPage[] = [];
  const ocrPageIndex = new Map<number, number>();

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }
    if (segment.pageNumber && segment.side) {
      const existingIndex = ocrPageIndex.get(segment.pageNumber);
      if (existingIndex === undefined) {
        ocrPageIndex.set(segment.pageNumber, mergedPages.length);
        mergedPages.push({ text: segment.text, pageNumber: segment.pageNumber });
      } else {
        mergedPages[existingIndex] = {
          text: `${mergedPages[existingIndex]?.text ?? ""}\n${segment.text}`,
          pageNumber: segment.pageNumber,
        };
      }
      continue;
    }

    mergedPages.push({ text: segment.text, pageNumber: segment.pageNumber });
  }

  return mergedPages
    .map((page) => ({ ...page, text: page.text.trim() }))
    .filter((page) => page.text.length > 0);
}

function splitPagesWithMetadata(raw: string): MergedPage[] {
  return mergePageMarkers(splitPagesWithMarkers(raw));
}

function splitPages(raw: string) {
  return splitPagesWithMetadata(raw).map((page) => page.text);
}

const ENGLISH_TOKEN_PATTERN =
  /\b(the|of|and|which|following|consider|correct|reference|statement|statements|india|above|only|none|how|many|respect|pair|pairs|with|one|select|answer|given|below)\b/gi;

function isLikelyEnglishPage(page: string) {
  const normalized = normalizeLine(page).toLowerCase();
  const signalCount = (normalized.match(ENGLISH_TOKEN_PATTERN) ?? []).length;
  const englishWordCount = (normalized.match(/\b[a-z][a-z'-]{2,}\b/g) ?? []).length;
  const optionMarkerCount = (normalized.match(/\([a-d]\)/g) ?? []).length;
  const mojibakeCount = (normalized.match(/(?:à¤|à¥|ã|â|Â)/g) ?? []).length;

  if (signalCount >= 10 && optionMarkerCount >= 2) {
    return true;
  }

  return signalCount >= 6 && englishWordCount >= 25 && mojibakeCount <= englishWordCount;
}

function isLikelyEnglishLine(line: string) {
  const latinCount = (line.match(/[A-Za-z]/g) ?? []).length;
  const devanagariCount = (line.match(/[\u0900-\u097F]/g) ?? []).length;
  const letterCount = latinCount + devanagariCount;
  if (letterCount === 0) {
    return true;
  }
  return latinCount / letterCount >= 0.4;
}

function extractEnglishPages(raw: string) {
  return splitPages(raw).filter(isLikelyEnglishPage);
}

function extractCandidatePagesFromPages(pages: string[], isOcrSource: boolean) {
  const englishPages = pages.filter(isLikelyEnglishPage).filter((page) => !isInstructionPage(page));
  if (!isOcrSource) {
    return englishPages;
  }

  const fallbackPages = pages.filter((page) => {
    if (isInstructionPage(page)) {
      return false;
    }
    const normalized = normalizeLine(page).toLowerCase();
    const optionMarkerCount = countOptionMarkers(normalized);
    const questionNumberHits = (normalized.match(/\b\d{1,3}\s*\./g) ?? []).length;
    const englishWordCount = (normalized.match(/\b[a-z][a-z'-]{2,}\b/g) ?? []).length;
    return optionMarkerCount >= 2 || questionNumberHits >= 3 || englishWordCount >= 40;
  });

  if (englishPages.length < 6) {
    return fallbackPages.length > englishPages.length ? fallbackPages : englishPages;
  }

  const fallbackSet = new Set(fallbackPages);
  const englishSet = new Set(englishPages);
  return pages.filter((page) => englishSet.has(page) || fallbackSet.has(page));
}

type CandidatePageSet = {
  label: string;
  pages: string[];
  filterNonEnglish: boolean;
};

function buildCandidatePageSets(pages: string[], isOcrSource: boolean): CandidatePageSet[] {
  if (!isOcrSource) {
    return [{ label: "english", pages, filterNonEnglish: false }];
  }

  const englishPages = pages.filter(isLikelyEnglishPage).filter((page) => !isInstructionPage(page));
  const fallbackPages = pages.filter((page) => {
    if (isInstructionPage(page)) {
      return false;
    }
    const normalized = normalizeLine(page).toLowerCase();
    const optionMarkerCount = countOptionMarkers(normalized);
    const questionNumberHits = (normalized.match(/\b\d{1,3}\s*\./g) ?? []).length;
    const englishWordCount = (normalized.match(/\b[a-z][a-z'-]{2,}\b/g) ?? []).length;
    return optionMarkerCount >= 2 || questionNumberHits >= 3 || englishWordCount >= 40;
  });
  const unionPages = pages.filter(
    (page) => englishPages.includes(page) || fallbackPages.includes(page),
  );

  return [
    { label: "english", pages: englishPages, filterNonEnglish: true },
    { label: "fallback", pages: fallbackPages, filterNonEnglish: false },
    { label: "union", pages: unionPages, filterNonEnglish: false },
  ];
}

function scoreQuestionBlocks(blocks: Array<{ number: number; text: string }>) {
  const uniqueNumbers = new Set<number>();
  let optionMarkerHits = 0;

  for (const block of blocks) {
    if (block.number >= 1 && block.number <= 100) {
      uniqueNumbers.add(block.number);
    }
    optionMarkerHits += countOptionMarkers(block.text);
  }

  return {
    score: uniqueNumbers.size * 10 + blocks.length + optionMarkerHits * 0.2,
    uniqueCount: uniqueNumbers.size,
  };
}

function selectBestCandidatePages(pages: string[], isOcrSource: boolean) {
  if (!isOcrSource) {
    return { pages, filterNonEnglish: false, label: "english" };
  }

  const candidates = buildCandidatePageSets(pages, isOcrSource).filter(
    (candidate) => candidate.pages.length > 0,
  );
  if (candidates.length === 0) {
    return { pages, filterNonEnglish: false, label: "empty" };
  }

  let best = candidates[0];
  let bestScore = -Infinity;
  let englishCandidate: { candidate: CandidatePageSet; score: number; uniqueCount: number } | null = null;

  for (const candidate of candidates) {
    const cleanedPages = candidate.pages.map((page) =>
      cleanEnglishPage(page, true, candidate.filterNonEnglish),
    );
    const blocks = extractQuestionBlocks(cleanedPages);
    const result = scoreQuestionBlocks(blocks);
    if (candidate.label === "english") {
      englishCandidate = { candidate, score: result.score, uniqueCount: result.uniqueCount };
    }
    if (result.score > bestScore) {
      bestScore = result.score;
      best = candidate;
    }
  }

  if (englishCandidate && englishCandidate.uniqueCount >= 80 && englishCandidate.score >= bestScore * 0.85) {
    return { ...englishCandidate.candidate };
  }

  return { ...best };
}

const INSTRUCTION_NOISE_PATTERNS = [
  /do not open this test booklet/i,
  /immediately after the commencement/i,
  /this test booklet does not have any/i,
  /maximum marks\s*:\s*200/i,
  /time allowed\s*:\s*two hours/i,
  /test booklet contains 100 items/i,
  /each item comprises four responses/i,
  /you should check that/i,
  /roll number/i,
  /answer sheet/i,
  /penalty for wrong answers/i,
  /objective type question papers/i,
  /you have to mark all your responses/i,
  /do not write anything else/i,
  /test booklet series/i,
];

function stripInstructionNoise(text: string) {
  let cleaned = text;
  for (const pattern of INSTRUCTION_NOISE_PATTERNS) {
    const match = pattern.exec(cleaned);
    if (match?.index !== undefined) {
      cleaned = cleaned.slice(0, match.index).trim();
    }
  }
  return cleaned.trim();
}

function isInstructionLine(line: string) {
  return INSTRUCTION_NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function extractCandidatePages(raw: string, isOcrSource: boolean) {
  return extractCandidatePagesFromPages(splitPages(raw), isOcrSource);
}

function cleanEnglishPage(page: string, stripInstructions = false, filterNonEnglish = false) {
  return page
    .split("\n")
    .map(normalizeLine)
    .filter((line) => line.length > 0)
    .filter((line) => !filterNonEnglish || isLikelyEnglishLine(line))
    .filter((line) => !/OCR\s+page-\d+\.png/i.test(line))
    .filter((line) => !/--\s*OCR\s+page-/i.test(line))
    .filter((line) => !/^XDTG/i.test(line))
    .filter((line) => !/^KSPC-P-GSPO/i.test(line))
    .filter((line) => !/^\[?\s*P\s*\.?\s*T\s*\.?\s*O\s*\.?\s*\]?$/i.test(line))
    .filter((line) => !/^CIVIL SERVICES/i.test(line))
    .filter((line) => !/^Note\s*:/i.test(line))
    .filter((line) => !/^\(\d+\s*-\s*\d+\)?$/.test(line))
    .filter((line) => !stripInstructions || !isInstructionLine(line))
    .join("\n");
}

function isInstructionPage(page: string) {
  const lowered = page.toLowerCase();
  const hits = INSTRUCTION_NOISE_PATTERNS.filter((pattern) => pattern.test(lowered)).length;
  return hits >= 3 || lowered.includes("test booklet series");
}

function startsQuestion(line: string, expectedNumber: number) {
  return new RegExp(`^[^0-9]{0,3}\\s*${expectedNumber}\\s*[\\.)](?:\\s+|$)`).test(line);
}

function extractLeadingQuestionNumber(line: string) {
  const match = line.match(/^[^0-9]{0,3}\s*(\d+)\s*(?:[.)](?:\s+|$)|$)/);
  return match?.[1] ? Number(match[1]) : null;
}

function stripQuestionPrefix(line: string, questionNumber: number) {
  return line
    .replace(new RegExp(`^[^0-9]{0,3}\\s*${questionNumber}\\s*(?:[.)](?:\\s+|$)|$)`), "")
    .trim();
}

function countOptionMarkers(text: string) {
  return (text.match(/[\(\{][a-d][\)\}]/gi) ?? []).length;
}

function isStandaloneQuestionNumber(line: string) {
  return /^[^0-9]{0,3}\s*\d{1,3}\s*[.)]?\s*$/.test(line);
}

function isLikelyQuestionStartLine(line: string) {
  const lower = line.toLowerCase();
  return (
    lower.startsWith("consider ") ||
    lower.startsWith("which ") ||
    lower.startsWith("with reference") ||
    lower.startsWith("in which ") ||
    lower.startsWith("what ") ||
    lower.startsWith("how many ") ||
    lower.startsWith("who ") ||
    lower.startsWith("the term ") ||
    lower.startsWith("recently") ||
    lower.startsWith("why does ") ||
    lower.startsWith("the organisms") ||
    lower.startsWith("'") ||
    lower.startsWith("\"") ||
    lower.includes("which one of the following") ||
    lower.includes("consider the following") ||
    lower.includes("with reference to")
  );
}

function extractQuestionBlocks(pages: string[]) {
  const blocks: Array<{ number: number; text: string }> = [];
  let currentNumber: number | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentNumber === null || currentLines.length === 0) {
      return;
    }

    blocks.push({
      number: currentNumber,
      text: currentLines.join("\n").trim(),
    });
  };

  for (const page of pages) {
    const lines = page
      .split("\n")
      .map(normalizeLine)
      .filter((line) => line.length > 0);
    let pendingQuestionNumber: number | null = null;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const nextLine = lines[index + 1] ?? "";
      if (line.length === 0) {
        continue;
      }
      const explicitNumber = extractLeadingQuestionNumber(line);
      const stripped = explicitNumber !== null ? stripQuestionPrefix(line, explicitNumber) : line;
      const currentText = currentLines.join(" ");
      const currentHasOptions = countOptionMarkers(currentText) >= 2;

      if (
        explicitNumber !== null &&
        explicitNumber >= 1 &&
        explicitNumber <= 100 &&
        isStandaloneQuestionNumber(line) &&
        isLikelyQuestionStartLine(nextLine)
      ) {
        pendingQuestionNumber = explicitNumber;
        continue;
      }

      const resolvedQuestionNumber = pendingQuestionNumber ?? explicitNumber;
      const startsObservedQuestion =
        resolvedQuestionNumber !== null &&
        resolvedQuestionNumber >= 1 &&
        resolvedQuestionNumber <= 100 &&
        (
          isLikelyQuestionStartLine(stripped) ||
          stripped.length === 0 ||
          currentNumber === null ||
          (currentHasOptions && resolvedQuestionNumber > currentNumber)
        );

      if (startsObservedQuestion) {
        flush();
        currentNumber = resolvedQuestionNumber;
        currentLines = stripped.length > 0 ? [stripped] : [];
        pendingQuestionNumber = null;
        continue;
      }

      if (
        currentNumber !== null &&
        currentHasOptions &&
        isLikelyQuestionStartLine(line)
      ) {
        flush();
        currentNumber += 1;
        currentLines = [line];
        pendingQuestionNumber = null;
        continue;
      }

      pendingQuestionNumber = null;

      if (currentNumber !== null) {
        currentLines.push(line);
      }
    }
  }

  flush();
  return blocks;
}

function isLikelyQuestionLead(line: string) {
  const lower = line.toLowerCase();
  return (
    lower.startsWith("consider ") ||
    lower.startsWith("which ") ||
    lower.startsWith("with reference") ||
    lower.startsWith("in which ") ||
    lower.startsWith("the term ") ||
    lower.startsWith("recently") ||
    lower.startsWith("why does ") ||
    lower.startsWith("'") ||
    lower.startsWith("\"") ||
    lower.includes("with reference to") ||
    lower.includes("which one of the following")
  );
}

const EMBEDDED_QUESTION_LEADS = [
  "Consider the following",
  "With reference to",
  "Which one of the following",
  "Which of the following",
  "In which of the following",
  "Who among the following",
  "How many of the above",
  "Why does",
  "The term",
  "Recently",
  "What is",
  "What are",
  "What was",
  "Select the correct",
];

const EMBEDDED_QUESTION_REGEX = new RegExp(
  `\\b(\\d{1,3})\\s*[\\.\\+\\-]?\\s*(?=${EMBEDDED_QUESTION_LEADS.map((entry) => entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "i",
);

function findEmbeddedQuestionStart(line: string) {
  const match = EMBEDDED_QUESTION_REGEX.exec(line);
  if (!match?.[1]) {
    return null;
  }
  return { index: match.index, number: Number(match[1]) };
}

function splitEmbeddedQuestionLead(line: string) {
  const patterns = [
    /\bSelect the correct\b/,
    /\bConsider the following\b/,
    /\bWith reference to\b/,
    /\bWhich one of the following\b/,
    /\bIn which of the following\b/,
    /\bWho among the following\b/,
    /\bHow many of the above\b/,
    /\bWhy does\b/,
    /\bThe term\b/,
    /\bRecently\b/,
    /\bWhat are the duties of\b/,
    /\bWith reference to the Parliament of India\b/,
  ];

  let splitIndex = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(line);
    if (match && match.index > 12) {
      splitIndex = splitIndex === -1 ? match.index : Math.min(splitIndex, match.index);
    }
  }

  if (splitIndex === -1) {
    return [line];
  }

  return [line.slice(0, splitIndex).trim(), line.slice(splitIndex).trim()].filter((part) => part.length > 0);
}

const MERGED_QUESTION_SPLIT_REGEX =
  /([.?!])\s+(?=(\d{1,3}\s*\.)|(Consider the following|With reference to|Which one of the following|Which of the following|In which of the following|Who among the following|How many of the above|Why does|The term|Recently|What is|What are|What was)\b)/i;

function splitMergedQuestionLine(line: string) {
  if (!/select\s+the\s+correct/i.test(line)) {
    return [line];
  }

  const parts: string[] = [];
  let remainder = line;

  for (let index = 0; index < 3; index += 1) {
    const match = MERGED_QUESTION_SPLIT_REGEX.exec(remainder);
    if (!match || match.index < 8) {
      break;
    }

    const splitIndex = match.index + match[1].length + 1;
    const left = remainder.slice(0, splitIndex).trim();
    if (left) {
      parts.push(left);
    }
    remainder = remainder.slice(splitIndex).trim();
  }

  if (parts.length === 0) {
    return [line];
  }

  if (remainder.length > 0) {
    parts.push(remainder);
  }

  return parts;
}

function splitMergedQuestions(block: { number: number; text: string }) {
  const lines = block.text
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .flatMap(splitMergedQuestionLine)
    .flatMap(splitEmbeddedQuestionLead);
  const segments: Array<{ number: number; lines: string[] }> = [];
  let currentNumber = block.number;
  let current: string[] = [];
  const seenOptions = new Set<string>();

  const flush = () => {
    if (current.length > 0) {
      segments.push({ number: currentNumber, lines: current });
    }
  };

  for (const line of lines) {
    if (/OCR\s+page-\d+\.png/i.test(line) || /--\s*OCR\s+page-/i.test(line) || /\bB-?APM[-.\s]*P[-.\s]*CK[AB]\//i.test(line)) {
      continue;
    }
    const optionMatch = line.match(/^[^A-Za-z0-9]{0,3}[\(\{]([a-d])[\)\}]/i);
    const completedOptionSet = ["a", "b", "c", "d"].every((label) => seenOptions.has(label));
    const explicitQuestionNumber = extractLeadingQuestionNumber(line);
    const startsExplicitQuestion =
      explicitQuestionNumber !== null &&
      explicitQuestionNumber > currentNumber &&
      startsQuestion(line, explicitQuestionNumber);
    const embeddedQuestion = findEmbeddedQuestionStart(line);
    const embeddedLead = embeddedQuestion ? line.slice(embeddedQuestion.index) : "";
    const embeddedLooksLikeQuestion =
      embeddedQuestion &&
      (isLikelyQuestionLead(embeddedLead) || /select\s+the\s+correct/i.test(embeddedLead));

    if (
      embeddedQuestion &&
      embeddedQuestion.number > currentNumber &&
      embeddedQuestion.number <= 100 &&
      (optionMatch || seenOptions.size > 0 || embeddedLooksLikeQuestion)
    ) {
      const optionPart = line.slice(0, embeddedQuestion.index).trim();
      if (optionPart) {
        current.push(optionPart);
      }
      flush();
      currentNumber = embeddedQuestion.number;
      const questionPart = stripQuestionPrefix(line.slice(embeddedQuestion.index), currentNumber);
      current = questionPart.length > 0 ? [questionPart] : [];
      seenOptions.clear();
      continue;
    }

    if (completedOptionSet && (startsExplicitQuestion || (!optionMatch && isLikelyQuestionLead(line)))) {
      flush();
      currentNumber = explicitQuestionNumber ?? currentNumber + 1;
      current = startsExplicitQuestion ? [stripQuestionPrefix(line, currentNumber)].filter(Boolean) : [line];
      seenOptions.clear();
      continue;
    }

    current.push(line);
    if (optionMatch?.[1]) {
      seenOptions.add(optionMatch[1].toLowerCase());
    }
  }

  flush();

  return segments.map((segment) => ({
    number: segment.number,
    text: segment.lines.join("\n"),
  }));
}

function stripOptionPrefix(line: string) {
  return line
    .replace(/^[^A-Za-z0-9]{0,3}(?:[\(\{]?\s*)?(?:[a-d28@®©¢])(?:[\)\}]?)\s*/i, "")
    .trim();
}

function isOptionStart(line: string) {
  return /^[^A-Za-z0-9]{0,3}(?:[\(\{]?\s*)?(?:[a-d28@®©¢])(?:[\)\}]?)\s+/i.test(line);
}

function extractOptions(block: string) {
  const lines = block.split("\n").map(normalizeLine).filter(Boolean);
  const collected: string[] = [];
  let current: string[] = [];
  let seenOptionStart = false;

  const flush = () => {
    if (current.length > 0) {
      collected.push(current.join(" ").trim());
      current = [];
    }
  };

  for (const line of lines) {
    if (/OCR\s+page-\d+\.png/i.test(line) || /--\s*OCR\s+page-/i.test(line) || /\bB-?APM[-.\s]*P[-.\s]*CK[AB]\//i.test(line)) {
      break;
    }
    if (isOptionStart(line)) {
      flush();
      current = [stripOptionPrefix(line)];
      seenOptionStart = true;
      continue;
    }

    if (seenOptionStart) {
      if (isLikelyQuestionLead(line) || extractLeadingQuestionNumber(line) !== null) {
        break;
      }

      current.push(line);
    }
  }

  flush();
  if (collected.length >= 4) {
    return collected;
  }

  const optionRegex =
    /[^A-Za-z0-9]{0,3}[\(\{]([A-Za-z0-9@Â©Â®Ã‚]+)[\)\}]?\s*([\s\S]*?)(?=\s*[^A-Za-z0-9]{0,3}[\(\{][A-Za-z0-9@Â©Â®Ã‚]+[\)\}]?\s*|\s*[^0-9]{0,3}\d+\s*\.(?:\s+|$)|$)/gi;
  const options: string[] = [];
  let match = optionRegex.exec(block);

  while (match) {
    const optionText = match[2];
    if (optionText) {
      options.push(optionText.replace(/\s+/g, " ").trim());
    }
    match = optionRegex.exec(block);
  }

  return options;
}

function cleanExtractedText(value: string) {
  const cleaned = value
    .replace(/--\s*OCR\s+page-[^-\n]+--/gi, " ")
    .replace(/\bOCR\s+page-\d+\.png\b/gi, " ")
    .replace(/\bOCR\s+page-[\w.-]+\s*\.?\s*png(?:\s+\w+)?\b/gi, " ")
    .replace(/\bB-?APM[-.\s]*P[-.\s]*CK[AB]\/\d+[A-Z]?\b/gi, " ")
    .replace(/[ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢]/g, "")
    .replace(/\[\s*P\s*\.?\s*T\s*\.?\s*O\s*\.?\s*\]?/gi, "")
    .replace(/\(\s*P\s*\.?\s*T\s*\.?\s*O\s*\.?\s*\)?/gi, "")
    .replace(/\b\d+\s*[|I]\s*P\s*\.?\s*T\s*\.?\s*O\s*\.?\s*\.?/gi, "")
    .replace(/\bXDTG[-\w/.\s]*$/gi, "")
    .replace(/\b\d+\s*[\[\(]?\s*P\s*\.?\s*T\s*\.?\s*O\s*\.?\s*\]?/gi, "")
    .replace(/([a-z])\.([A-Za-z])/g, "$1. $2")
    .replace(/\s+/g, " ")
    .replace(/^\.+\s*/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  const latinCount = (cleaned.match(/[A-Za-z]/g) ?? []).length;
  const devanagariCount = (cleaned.match(/[\u0900-\u097F]/g) ?? []).length;
  if (latinCount >= 6 && devanagariCount > 0) {
    return cleaned.replace(/[\u0900-\u097F]+/g, " ").replace(/\s+/g, " ").trim();
  }
  return cleaned;
}

function normalizeOptionText(value: string) {
  const cleaned = cleanExtractedText(value)
    .replace(/[ÂÃ]/g, "")
    .replace(/\bll\s+four\b/gi, "All four")
    .replace(/\bll\s+three\b/gi, "All three")
    .replace(/\bOnlyone\b/gi, "Only one")
    .replace(/\bOnlytwo\b/gi, "Only two")
    .replace(/\bOnlythree\b/gi, "Only three")
    .replace(/\bAllthree\b/gi, "All three")
    .replace(/\bAllfour\b/gi, "All four")
    .replace(/\bAllfive\b/gi, "All five")
    .replace(/\bNeither\s*1\s*nor\s*2\b/gi, "Neither 1 nor 2")
    .replace(/\bBoth\s*1\s*and\s*2\b/gi, "Both 1 and 2")
    .replace(/\b([12])\s*and\s*([234])\s*only\b/gi, "$1 and $2 only")
    .replace(/\b1\s*,\s*2\s*and\s*3\b/gi, "1, 2 and 3")
    .replace(/\b1\s*,\s*2\s*and\s*4\b/gi, "1, 2 and 4")
    .replace(/\b1\s*,\s*3\s*and\s*4\b/gi, "1, 3 and 4")
    .replace(/\b2\s*,\s*3\s*and\s*4\b/gi, "2, 3 and 4")
    .replace(/\b1\s*and\s*2\s*and\s*3\b/gi, "1, 2 and 3")
    .replace(/\b1\s*and\s*2\s*and\s*4\b/gi, "1, 2 and 4")
    .replace(/\b1\s*and\s*3\s*and\s*4\b/gi, "1, 3 and 4")
    .replace(/\b2\s*and\s*3\s*and\s*4\b/gi, "2, 3 and 4")
    .replace(/\b([a-z])only\b/gi, "$1 only")
    .replace(/\s+/g, " ")
    .trim();

  const canonical = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "");
  switch (canonical) {
    case "1only":
    case "lonly":
    case "tlonly":
    case "aonly":
      return "1 only";
    case "2only":
      return "2 only";
    case "onlyone":
      return "Only one";
    case "onlytwo":
      return "Only two";
    case "onlythree":
      return "Only three";
    case "allthree":
      return "All three";
    case "allfour":
    case "llfour":
      return "All four";
    case "allfive":
      return "All five";
    case "1and2only":
    case "land2only":
    case "1land2only":
      return "1 and 2 only";
    case "2and3only":
    case "2and3on":
      return "2 and 3 only";
    case "1and3only":
    case "land3only":
    case "1land3only":
      return "1 and 3 only";
    case "both1and2":
    case "bothland2":
      return "Both 1 and 2";
    case "neither1nor2":
      return "Neither 1 nor 2";
    default:
      return cleaned;
  }
}

function isLikelyInstructionNoise(row: NormalizedPyqRecord) {
  const combined = `${row.questionText} ${row.options.join(" ")}`.toLowerCase();
  return (
    combined.includes("do not open this test booklet") ||
    combined.includes("maximum marks: 200") ||
    combined.includes("immediately after the commencement") ||
    combined.includes("you should check that") ||
    combined.includes("test booklet does not have any") ||
    combined.includes("missing pages or items") ||
    combined.includes("roll number") ||
    combined.includes("each item comprises four responses")
  );
}

function countPlaceholderOptions(options: string[]) {
  return options.filter((option) => /\[option unreadable from ocr\]/i.test(option)).length;
}

function scoreRowQuality(row: NormalizedPyqRecord) {
  const optionText = row.options.join(" ");
  const placeholderPenalty = row.questionText.includes("[OCR extraction failed") ? 5000 : 0;
  const optionPenalty = countPlaceholderOptions(row.options) * 1000;
  return row.questionText.length + optionText.length - placeholderPenalty - optionPenalty;
}

function hasOcrArtifacts(text: string) {
  const lower = text.toLowerCase();
  return [
    "ã",
    "â€",
    "ï¿½",
    "�",
    "à¤",
    "[option unreadable",
    "[ocr extraction failed",
    "lvpk-",
    "p.t.o.",
    "[pt.0.",
    "fo)",
    "fb)",
    "fc)",
    "fd)",
  ].some((token) => lower.includes(token));
}

function hasBrokenStatementMarkers(text: string) {
  return (
    /Statement\s+[1l](?::|\b)/i.test(text) ||
    /Statement\s+à¤/i.test(text) ||
    /\b(?:1and|Iand|Tand)\b/.test(text)
  );
}

function hasFooterBleed(text: string) {
  return /(?:LVPK-[A-Z-]+\/\d+[A-Z]?|\[?P\.?T\.?O\.?\]?|\[PT\.0\.)/i.test(text);
}

function isLikelyTruncatedQuestion(row: NormalizedPyqRecord) {
  const question = row.questionText.trim();
  if (question.length < 30) {
    return true;
  }

  if (/Statement I:/i.test(question) && !/Statement II:/i.test(question)) {
    return true;
  }

  if (/Consider the following statements/i.test(question) && question.length < 80) {
    return true;
  }

  if (/Which of the statements given above/i.test(question) && !/\?$/.test(question)) {
    return true;
  }

  return false;
}

function hasBrokenOptionText(text: string) {
  const trimmed = text.trim();
  return (
    hasFooterBleed(trimmed) ||
    hasOcrArtifacts(trimmed) ||
    hasBrokenStatementMarkers(trimmed) ||
    /[\[\]{}]/.test(trimmed) ||
    /[^\x00-\x7F]{2,}/.test(trimmed)
  );
}

function isSuspiciouslyShortOption(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.length >= 3) {
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    return false;
  }
  if (/^[A-Z]{2,3}$/.test(trimmed)) {
    return false;
  }
  if (/^[A-Z]\d+$/.test(trimmed)) {
    return false;
  }
  return true;
}

function buildConfidence(row: NormalizedPyqRecord) {
  const flags: string[] = [];
  let score = 100;

  const questionLength = row.questionText.trim().length;
  if (questionLength === 0) {
    flags.push("missing_question_text");
    score -= 60;
  } else if (questionLength < 20) {
    flags.push("short_question_text");
    score -= 25;
  }

  if (row.options.length !== 4) {
    flags.push("options_not_four");
    score -= 30;
  }

  row.options.forEach((option) => {
    const trimmed = option.trim();
    if (!trimmed) {
      flags.push("empty_option");
      score -= 20;
      return;
    }
    if (isSuspiciouslyShortOption(trimmed)) {
      flags.push("short_option");
      score -= 8;
    }
    if (/\[option unreadable/i.test(trimmed)) {
      flags.push("placeholder_option");
      score -= 20;
    }
    if (hasOcrArtifacts(trimmed)) {
      flags.push("ocr_artifact");
      score -= 20;
    }
    if (hasBrokenOptionText(trimmed)) {
      flags.push("garbled_option_text");
      score -= 20;
    }
  });

  if (hasOcrArtifacts(row.questionText)) {
    flags.push("ocr_artifact");
    score -= 20;
  }

  if (hasBrokenStatementMarkers(row.questionText)) {
    flags.push("broken_statement_marker");
    score -= 15;
  }

  if (hasFooterBleed(row.questionText)) {
    flags.push("footer_bleed");
    score -= 20;
  }

  if (isLikelyTruncatedQuestion(row)) {
    flags.push("truncated_question_text");
    score -= 20;
  }

  if (isLikelyInstructionNoise(row)) {
    flags.push("instruction_noise");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags: Array.from(new Set(flags)) };
}

function extractQuestionNumberFromId(id: string) {
  return Number(id.split("_Q")[1] ?? "0");
}

function getReferenceFileCandidates(year: number | null, paperType: PaperType) {
  if (!year) {
    return [] as string[];
  }
  const lowerPaper = paperType.toLowerCase();
  const manual = path.join(REFERENCE_ROOT, lowerPaper, `ManualUpload${year}.ts`);
  const candidates: string[] = [];
  if (fs.existsSync(manual)) {
    candidates.push(manual);
  }
  const candidate = path.join(REFERENCE_ROOT, lowerPaper, `${lowerPaper}-${year}.txt`);
  if (fs.existsSync(candidate)) {
    candidates.push(candidate);
  }
  return candidates;
}

function splitOptionLine(line: string) {
  const matches = Array.from(line.matchAll(/(?:^|\s)(\([A-Da-d]\)|[A-Da-d]\))\s*/g));
  if (matches.length === 0) {
    return null;
  }
  if (matches.length === 1) {
    const match = matches[0];
    const label = match?.[1] ?? "A";
    const startIndex = (match?.index ?? 0) + match[0].length;
    return [{ label, text: line.slice(startIndex).trim() }];
  }
  const parts: Array<{ label: string; text: string }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    if (!current) {
      continue;
    }
    const label = current[1] ?? "A";
    const startIndex = (current.index ?? 0) + current[0].length;
    const endIndex = next?.index ?? line.length;
    const text = line.slice(startIndex, endIndex).trim();
    parts.push({ label, text });
  }
  return parts;
}

function parseReferenceQuestions(
  raw: string,
  year: number,
  paperType: PaperType,
): ReferenceQuestion[] {
  const lines = raw.split(/\r?\n/);
  const questions: ReferenceQuestion[] = [];
  let currentId = "";
  let currentNumber: number | null = null;
  let questionLines: string[] = [];
  let options: string[] = [];

  const flush = () => {
    if (currentNumber === null) {
      return;
    }
    const questionText = cleanExtractedText(questionLines.join(" ").trim());
    const normalizedOptions = options.map((option) =>
      normalizeOptionText(cleanExtractedText(option))
        .replace(/\s*---+\s*$/g, "")
        .trim(),
    );
    const id = currentId || `UPSC_${year}_${paperType}_Q${currentNumber}`;
    if (questionText.length > 0 || normalizedOptions.length > 0) {
      questions.push({
        id,
        number: currentNumber,
        questionText,
        options: normalizedOptions,
        source: "export",
      });
    }
    currentId = "";
    currentNumber = null;
    questionLines = [];
    options = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (/^---+$/.test(line) || /^#\s*questions?\b/i.test(line)) {
      continue;
    }
    const idMatch = line.match(/^ID:\s*(.+)$/i);
    if (idMatch?.[1]) {
      flush();
      currentId = idMatch[1].trim();
      continue;
    }
    const headerMatch = line.match(/^#{1,6}\s*(?:Q)?(\d{1,3})\.\s*(.*)$/i);
    if (headerMatch?.[1]) {
      flush();
      currentNumber = Number(headerMatch[1]);
      const remainder = (headerMatch[2] ?? "").trim();
      if (remainder) {
        questionLines.push(remainder);
      }
      continue;
    }

    const questionMatch =
      line.match(/^Q(\d{1,3})\.\s*(.*)$/i) ?? line.match(/^(\d{1,3})\.\s*(.*)$/);
    if (questionMatch?.[1] && (currentNumber === null || options.length >= 4)) {
      flush();
      currentNumber = Number(questionMatch[1]);
      const remainder = (questionMatch[2] ?? "").trim();
      if (remainder) {
        questionLines.push(remainder);
      }
      continue;
    }

    const optionParts = splitOptionLine(line);
    if (optionParts) {
      for (const part of optionParts) {
        if (part.text.length === 0) {
          continue;
        }
        options.push(part.text);
      }
      continue;
    }

    if (options.length > 0) {
      options[options.length - 1] = `${options[options.length - 1]} ${line}`.trim();
      continue;
    }

    if (currentNumber !== null) {
      questionLines.push(line);
    }
  }

  flush();
  return questions;
}

function scoreReferenceEntry(entry: ReferenceQuestion) {
  let score = entry.questionText.length;
  if (hasOcrArtifacts(entry.questionText)) {
    score -= 200;
  }
  if (entry.options.length >= 4) {
    score += 40;
  }
  for (const option of entry.options) {
    score += Math.min(option.length, 80);
    if (hasOcrArtifacts(option)) {
      score -= 100;
    }
  }
  return score;
}

function loadReferenceQuestions(year: number | null, paperType: PaperType) {
  const referencePaths = getReferenceFileCandidates(year, paperType);
  if (referencePaths.length === 0) {
    return null;
  }

  const merged = new Map<number, ReferenceQuestion>();
  const mergedRank = new Map<number, number>();

  for (const referencePath of referencePaths) {
    try {
      const raw = fs.readFileSync(referencePath, "utf-8");
      const parsed = parseReferenceQuestions(raw, year ?? 0, paperType);
      const parsedWithSource = parsed.map((entry) => ({
        ...entry,
        source: (/ManualUpload/i.test(referencePath) ? "manual" : "export") as "manual" | "export",
      }));
      const usable = parsedWithSource.filter(
        (entry) => entry.questionText.length >= 15 && entry.options.length >= 4,
      );
      const sourceRank = /ManualUpload/i.test(referencePath) ? 2 : 1;
      for (const entry of usable) {
        const existing = merged.get(entry.number);
        if (!existing) {
          merged.set(entry.number, entry);
          mergedRank.set(entry.number, sourceRank);
          continue;
        }
        const existingRank = mergedRank.get(entry.number) ?? 1;
        if (sourceRank > existingRank) {
          merged.set(entry.number, entry);
          mergedRank.set(entry.number, sourceRank);
          continue;
        }
        if (sourceRank < existingRank) {
          continue;
        }
        const existingHasOcr =
          hasOcrArtifacts(existing.questionText) ||
          existing.options.some((option) => hasOcrArtifacts(option));
        const entryHasOcr =
          hasOcrArtifacts(entry.questionText) ||
          entry.options.some((option) => hasOcrArtifacts(option));
        if (existingHasOcr && !entryHasOcr) {
          merged.set(entry.number, entry);
          continue;
        }
        if (!existingHasOcr && entryHasOcr) {
          continue;
        }
        if (scoreReferenceEntry(entry) > scoreReferenceEntry(existing)) {
          merged.set(entry.number, entry);
        }
      }
    } catch (error) {
      console.warn(`Failed to load reference questions from ${referencePath}:`, error);
    }
  }

  if (merged.size < 30) {
    return null;
  }
  return merged;
}

function isBadQuestionText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.includes("[OCR extraction failed")) {
    return true;
  }
  if (hasOcrArtifacts(trimmed)) {
    return true;
  }
  return trimmed.length < 20;
}

function isBadOptionText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  if (/\[option unreadable/i.test(trimmed)) {
    return true;
  }
  if (hasOcrArtifacts(trimmed)) {
    return true;
  }
  return trimmed.length < 3;
}

function applyReferenceToRows(
  rows: NormalizedPyqRecord[],
  referenceMap: Map<number, ReferenceQuestion>,
) {
  return rows.map((row) => {
    const number = extractQuestionNumberFromId(row.id);
    const reference = referenceMap.get(number);
    if (!reference) {
      return row;
    }

    if (reference.source === "manual") {
      return {
        ...row,
        questionText: reference.questionText,
        options: reference.options.slice(0, 4),
        reviewNotes: row.reviewNotes || "synced from manual reference",
      };
    }

    if (referenceMap.size >= 80) {
      return {
        ...row,
        questionText: reference.questionText,
        options: reference.options.slice(0, 4),
        reviewNotes: row.reviewNotes || "synced from reference",
      };
    }

    const referenceRow: NormalizedPyqRecord = {
      ...row,
      questionText: reference.questionText,
      options: reference.options.slice(0, 4),
    };
    const rowHasOcrIssues =
      hasOcrArtifacts(row.questionText) || row.options.some((option) => hasOcrArtifacts(option));
    const rowLooksMerged =
      isLikelyInstructionNoise(row) ||
      /^ocr-/i.test(row.reviewNotes ?? "") ||
      scoreRowQuality(referenceRow) >= scoreRowQuality(row) + 120;
    const shouldReplaceWholeRow = rowHasOcrIssues || rowLooksMerged;

    if (shouldReplaceWholeRow) {
      return {
        ...row,
        questionText: reference.questionText,
        options: reference.options.slice(0, 4),
        reviewNotes: row.reviewNotes || "repaired from reference",
      };
    }

    let nextQuestionText = row.questionText;
    let nextOptions = row.options;
    let touched = false;

    if (isBadQuestionText(row.questionText)) {
      nextQuestionText = reference.questionText;
      touched = true;
    }

    if (row.options.length !== 4) {
      nextOptions = reference.options.slice(0, 4);
      touched = true;
    } else {
      const mergedOptions = row.options.map((option, index) => {
        if (isBadOptionText(option)) {
          touched = true;
          return reference.options[index] ?? option;
        }
        return option;
      });
      nextOptions = mergedOptions;
    }

    if (!touched) {
      return row;
    }

    return {
      ...row,
      questionText: nextQuestionText,
      options: nextOptions,
      reviewNotes: row.reviewNotes || "repaired from reference",
    };
  });
}

function mergeWithBaseline(
  normalizedRows: NormalizedPyqRecord[],
  baselineRows: NormalizedPyqRecord[],
) {
  const normalizedIds = new Set(normalizedRows.map((row) => row.id));
  const baselineById = new Map(baselineRows.map((row) => [row.id, row]));
  const merged = normalizedRows.map((row) => {
    const baseline = baselineById.get(row.id);
    if (!baseline) {
      return row;
    }

    const baselineHasOcr =
      hasOcrArtifacts(baseline.questionText) ||
      baseline.options.some((option) => hasOcrArtifacts(option));
    const rowHasOcr =
      hasOcrArtifacts(row.questionText) ||
      row.options.some((option) => hasOcrArtifacts(option));
    if (baselineHasOcr && !rowHasOcr) {
      return {
        ...row,
        reviewNotes: row.reviewNotes || baseline.reviewNotes,
      };
    }
    if (!baselineHasOcr && rowHasOcr) {
      return baseline;
    }

    const rowScore = scoreRowQuality(row);
    const baselineScore = scoreRowQuality(baseline);
    if (baselineScore > rowScore) {
      return {
        ...baseline,
        reviewNotes: baseline.reviewNotes || row.reviewNotes,
      };
    }

    return row;
  });

  for (const baseline of baselineRows) {
    if (!normalizedIds.has(baseline.id)) {
      merged.push(baseline);
    }
  }

  return merged.sort((left, right) => extractQuestionNumberFromId(left.id) - extractQuestionNumberFromId(right.id));
}

function getExpectedQuestionCount(paperType: PaperType) {
  return paperType === "CSAT" ? 80 : 100;
}

function trimRowsToCount(rows: NormalizedPyqRecord[], maxCount: number) {
  if (rows.length <= maxCount) {
    return rows;
  }

  const inRange = rows.filter((row) => {
    const number = extractQuestionNumberFromId(row.id);
    return number >= 1 && number <= maxCount;
  });
  const outOfRange = rows.filter((row) => !inRange.includes(row));

  if (inRange.length >= maxCount) {
    const scored = inRange
      .map((row) => ({ row, score: scoreRowQuality(row) }))
      .sort((left, right) => left.score - right.score);
    const removeCount = inRange.length - maxCount;
    const toRemove = new Set(scored.slice(0, removeCount).map((entry) => entry.row.id));
    return inRange.filter((row) => !toRemove.has(row.id));
  }

  const scoredOutOfRange = outOfRange
    .map((row) => ({ row, score: scoreRowQuality(row) }))
    .sort((left, right) => right.score - left.score);
  const needed = maxCount - inRange.length;
  const keepOutOfRange = new Set(scoredOutOfRange.slice(0, needed).map((entry) => entry.row.id));
  return rows.filter((row) => inRange.includes(row) || keepOutOfRange.has(row.id));
}

function repairOptionSet(questionNumber: number, questionText: string, options: string[]) {
  const cleaned = options.map(cleanExtractedText).map(normalizeOptionText);
  const thirdOption = cleaned[2];

  if (
    questionNumber === 67 &&
    /aerial\s+metagenomics/i.test(questionText) &&
    cleaned.length === 4 &&
    thirdOption !== undefined &&
    thirdOption.length === 0
  ) {
    return [
      cleaned[0] ?? "",
      cleaned[1] ?? "",
      "Using air-borne devices to collect blood samples from moving animals",
      "Sending drones to inaccessible areas to collect plant and animal samples from land surfaces and water bodies",
    ];
  }

  if (
    questionNumber === 67 &&
    /wolbachia\s+method/i.test(questionText) &&
    cleaned.length === 4 &&
    thirdOption !== undefined &&
    thirdOption.length === 0
  ) {
    return [
      cleaned[0] ?? "",
      cleaned[1] ?? "",
      "Producing biodegradable plastics",
      "Producing biochar from thermo-chemical conversion of biomass",
    ];
  }

  return cleaned;
}

function extractQuestionText(block: string) {
  const optionIndex = block.search(/[^A-Za-z0-9]{0,3}[\(\{][A-Za-z0-9@Â©Â®Ã‚]+[\)\}]?\s*/i);
  const questionText = optionIndex === -1 ? block : block.slice(0, optionIndex);
  return cleanExtractedText(questionText);
}

function normalizeFile(filePath: string): NormalizedPyqRecord[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const isOcrSource = /--\s*OCR\s+(?:page|image)(?:\s+page)?-\d+[^\n]*\.png/i.test(raw);
  const fileName = path.basename(filePath);
  const year = parseYear(filePath);
  const paperType = detectPaperType(filePath);
  const expectedCount = getExpectedQuestionCount(paperType);
  const instructionSkipConfig = getInstructionPageSkipConfig(year, paperType);
  const rawPages = isOcrSource ? splitPagesWithMetadata(raw) : splitPages(raw);
  const skippedPages = isOcrSource
    ? filterOddEnglishPagesWithMetadata(
        applyInstructionPageSkipsWithMetadata(rawPages as MergedPage[], instructionSkipConfig),
      )
    : applyInstructionPageSkips(rawPages as string[], instructionSkipConfig);
  const skippedTexts = isOcrSource
    ? (skippedPages as MergedPage[]).map((page) => page.text)
    : (skippedPages as string[]);
  const candidateSelection = selectBestCandidatePages(skippedTexts, isOcrSource);
  const cleanedPages = candidateSelection.pages.map((page) =>
    cleanEnglishPage(page, isOcrSource, isOcrSource ? candidateSelection.filterNonEnglish : false),
  );
  const blocks = extractQuestionBlocks(cleanedPages);

  const rows: Array<NormalizedPyqRecord | null> = blocks
    .flatMap(splitMergedQuestions)
    .map((block) => {
      const questionText = extractQuestionText(block.text);
      const repairedOptions = repairOptionSet(block.number, questionText, extractOptions(block.text));
      const cleanedQuestionText = isOcrSource ? stripInstructionNoise(questionText) : questionText;
      const cleanedOptions = isOcrSource ? repairedOptions.map(stripInstructionNoise) : repairedOptions;
      if (
        cleanedOptions.length === 0 &&
        (
          !isOcrSource ||
          (cleanedQuestionText.length < 10 && !isLikelyQuestionLead(cleanedQuestionText))
        )
      ) {
        return null;
      }
      const options =
        cleanedOptions.length === 0 && isOcrSource
          ? Array.from({ length: 4 }, () => "[option unreadable from OCR]")
          : cleanedOptions.length >= 4
          ? cleanedOptions.slice(0, 4)
          : isOcrSource
            ? cleanedOptions.concat(
                Array.from(
                  { length: 4 - cleanedOptions.length },
                  () => "[option unreadable from OCR]",
                ),
              )
            : [];

      if (options.length < 4) {
        return null;
      }

      return {
        id: `UPSC_${year}_${paperType}_Q${block.number}`,
        year,
        examStage: "prelims" as const,
        paperType,
        sourceFile: fileName,
        questionText: cleanedQuestionText,
        options,
        status: "pending_review" as const,
        reviewNotes:
          isOcrSource && cleanedOptions.length === 0
            ? PYQ_REVIEW_NOTES.ocrNoOptions
            : isOcrSource && cleanedOptions.length < 4
              ? PYQ_REVIEW_NOTES.ocrIncompleteOptions
            : "",
      };
    });

  const orderedRows = rows.filter((record): record is NormalizedPyqRecord => record !== null);
  const resequenced: NormalizedPyqRecord[] = [];
  let lastAssignedNumber = 0;

  for (const row of orderedRows) {
    const rawNumber = Number(row.id.split("_Q")[1] ?? "0");
    const expectedNumber = lastAssignedNumber + 1;
    const assignedNumber =
      lastAssignedNumber === 0
        ? (rawNumber >= 1 && rawNumber <= expectedCount ? rawNumber : 1)
        : rawNumber >= expectedNumber && rawNumber <= expectedNumber + 5
          ? rawNumber
          : expectedNumber;

    resequenced.push({
      ...row,
      id: `UPSC_${year}_${paperType}_Q${assignedNumber}`,
    });
    lastAssignedNumber = assignedNumber;
  }

  const deduped = new Map<string, NormalizedPyqRecord>();
  for (const row of resequenced) {
    const existing = deduped.get(row.id);
    if (!existing) {
      deduped.set(row.id, row);
      continue;
    }

    const existingScore = existing.questionText.length + existing.options.join(" ").length;
    const currentScore = row.questionText.length + row.options.join(" ").length;
    if (currentScore > existingScore) {
      deduped.set(row.id, row);
    }
  }

  const normalizedRows = Array.from(deduped.values()).sort((left, right) => {
    const leftNumber = Number(left.id.split("_Q")[1] ?? "0");
    const rightNumber = Number(right.id.split("_Q")[1] ?? "0");
    return leftNumber - rightNumber;
  });
  const referenceQuestions = loadReferenceQuestions(year, paperType);
  const referenceApplied = referenceQuestions
    ? applyReferenceToRows(normalizedRows, referenceQuestions)
    : normalizedRows;

  if (!isOcrSource) {
    const trimmed = trimRowsToCount(referenceApplied, expectedCount);
    const bounded = trimmed.filter((row) => {
      const number = extractQuestionNumberFromId(row.id);
      return number >= 1 && number <= expectedCount;
    });
    return bounded.map((row) => {
      const confidence = buildConfidence(row);
      return { ...row, confidenceScore: confidence.score, confidenceFlags: confidence.flags };
    });
  }

  const trimmedRows = trimRowsToCount(referenceApplied, expectedCount);

  const boundedRows =
    trimmedRows.filter((row) => {
      const number = extractQuestionNumberFromId(row.id);
      return number >= 1 && number <= expectedCount;
    });

  const existingNumbers = new Set(
    boundedRows.map((row) => Number(row.id.split("_Q")[1] ?? "0")),
  );

  for (let questionNumber = 1; questionNumber <= expectedCount; questionNumber += 1) {
    if (!existingNumbers.has(questionNumber)) {
      trimmedRows.push(
        createOcrPlaceholderRow({
          year,
          paperType,
          fileName,
          questionNumber,
        }),
      );
    }
  }

  const finalRows = boundedRows.sort((left, right) => {
    const leftNumber = Number(left.id.split("_Q")[1] ?? "0");
    const rightNumber = Number(right.id.split("_Q")[1] ?? "0");
    return leftNumber - rightNumber;
  });
  const finalWithReference = referenceQuestions
    ? applyReferenceToRows(finalRows, referenceQuestions)
    : finalRows;

  if (paperType === "GS1" && finalWithReference.length < 100) {
    const existingNumbersFill = new Set(
      finalWithReference.map((row) => extractQuestionNumberFromId(row.id)),
    );
    for (let questionNumber = 1; questionNumber <= 100; questionNumber += 1) {
      if (!existingNumbersFill.has(questionNumber)) {
        finalWithReference.push(
          createOcrPlaceholderRow({
            year,
            paperType,
            fileName,
            questionNumber,
          }),
        );
      }
    }
  }

  if (paperType === "GS1" && finalWithReference.length > 100) {
    const withoutInstructionNoise = finalWithReference.filter((row) => !isLikelyInstructionNoise(row));
    const candidateRows = withoutInstructionNoise.length >= 100 ? withoutInstructionNoise : finalWithReference;
    if (candidateRows.length > 100) {
      const scored = candidateRows
        .map((row) => ({ row, score: scoreRowQuality(row) }))
        .sort((left, right) => left.score - right.score);
      const removeCount = candidateRows.length - 100;
      const toRemove = new Set(scored.slice(0, removeCount).map((entry) => entry.row.id));
      const trimmed = candidateRows.filter((row) => !toRemove.has(row.id));
      return trimmed.map((row) => {
        const confidence = buildConfidence(row);
        return { ...row, confidenceScore: confidence.score, confidenceFlags: confidence.flags };
      });
    }
    return candidateRows.map((row) => {
      const confidence = buildConfidence(row);
      return { ...row, confidenceScore: confidence.score, confidenceFlags: confidence.flags };
    });
  }

  return finalWithReference.map((row) => {
    const confidence = buildConfidence(row);
    return { ...row, confidenceScore: confidence.score, confidenceFlags: confidence.flags };
  });
}

function writeLowConfidenceReport(rootDir: string, rows: NormalizedPyqRecord[]) {
  const lowConfidence = rows.filter((row) => (row.confidenceScore ?? 0) < 60 || (row.confidenceFlags?.length ?? 0) > 0);
  if (lowConfidence.length === 0) {
    return;
  }
  ensureParentDir(path.join(rootDir, "low-confidence.json"));
  fs.writeFileSync(path.join(rootDir, "low-confidence.json"), JSON.stringify(lowConfidence, null, 2));
}

function writeScopedOutputs(
  artifacts: ReturnType<typeof getPaperArtifacts>,
  rows: NormalizedPyqRecord[],
  skipReference: boolean,
) {
  const outputPath = skipReference
    ? path.join(artifacts.rootDir, "normalized.ocr.json")
    : artifacts.normalizedPath;
  ensureParentDir(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
  if (!skipReference) {
    writeLowConfidenceReport(artifacts.rootDir, rows);
  }
  return outputPath;
}

function attachConfidence(rows: NormalizedPyqRecord[]) {
  return rows.map((row) => {
    const confidence = buildConfidence(row);
    return { ...row, confidenceScore: confidence.score, confidenceFlags: confidence.flags };
  });
}

function main() {
  const args = parsePyqCliArgs();
  const readJsonFile = <T,>(filePath: string): T => {
    const raw = fs.readFileSync(filePath, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "");
    return JSON.parse(cleaned) as T;
  };

  if (args.year && args.paperType) {
    const artifacts = getPaperArtifacts({ year: args.year, paperType: args.paperType });
    if (!fs.existsSync(artifacts.questionTextPath)) {
      throw new Error(`Question text file not found for ${args.year} ${args.paperType}: ${artifacts.questionTextPath}`);
    }

    const baseline = !args.noMerge && fs.existsSync(artifacts.normalizedPath)
      ? readJsonFile<NormalizedPyqRecord[]>(artifacts.normalizedPath)
      : null;
    const questions = normalizeFile(artifacts.questionTextPath);
    const mergedQuestions = baseline ? mergeWithBaseline(questions, baseline) : questions;
    const referenceQuestions = loadReferenceQuestions(args.year, args.paperType);
    const finalQuestions = !args.skipReference && referenceQuestions
      ? applyReferenceToRows(mergedQuestions, referenceQuestions)
      : mergedQuestions;
    const scoredQuestions = attachConfidence(finalQuestions);
    const outputPath = writeScopedOutputs(artifacts, scoredQuestions, args.skipReference);
    console.log(
      `Extracted ${scoredQuestions.length} questions for ${args.year} ${args.paperType} -> ${path.relative(process.cwd(), outputPath)}`,
    );
    return;
  }

  const scopes = listPaperScopes().filter((scope) => fs.existsSync(getPaperArtifacts(scope).questionTextPath));
  if (args.all || scopes.length > 0) {
    for (const scope of scopes) {
      const artifacts = getPaperArtifacts(scope);
      const baseline = !args.noMerge && fs.existsSync(artifacts.normalizedPath)
        ? readJsonFile<NormalizedPyqRecord[]>(artifacts.normalizedPath)
        : null;
      const questions = normalizeFile(artifacts.questionTextPath);
      const mergedQuestions = baseline ? mergeWithBaseline(questions, baseline) : questions;
      const referenceQuestions = loadReferenceQuestions(scope.year, scope.paperType);
      const finalQuestions = !args.skipReference && referenceQuestions
        ? applyReferenceToRows(mergedQuestions, referenceQuestions)
        : mergedQuestions;
      const scoredQuestions = attachConfidence(finalQuestions);
      const outputPath = writeScopedOutputs(artifacts, scoredQuestions, args.skipReference);
      console.log(
        `Extracted ${scoredQuestions.length} questions for ${scope.year} ${scope.paperType} -> ${path.relative(process.cwd(), outputPath)}`,
      );
    }
    return;
  }

  const files = fs.readdirSync(TEXT_DIR);
  let allQuestions: NormalizedPyqRecord[] = [];

  for (const file of files) {
    if (!file.endsWith(".txt")) {
      continue;
    }

    const filePath = path.join(TEXT_DIR, file);
    const questions = normalizeFile(filePath);
    allQuestions = allQuestions.concat(questions);
    console.log(`Extracted ${questions.length} questions from ${file}`);
  }

  if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQuestions, null, 2));
  console.log(`Total questions extracted: ${allQuestions.length}`);
}

main();
