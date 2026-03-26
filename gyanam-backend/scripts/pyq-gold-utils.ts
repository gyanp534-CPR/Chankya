import fs from "node:fs";
import path from "node:path";
import type { PaperType } from "./pyq-review-utils.js";

export type GoldPyqRecord = {
  id: string;
  number: number;
  year: number;
  examStage: "prelims";
  paperType: PaperType;
  sourceFile: string;
  questionText: string;
  options: string[];
};

const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u201C\u201D]/g, "\""],
  [/[\u2018\u2019]/g, "'"],
  [/[\u2010\u2011\u2012\u2013\u2014]/g, "-"],
  [/\u2026/g, "..."],
  [/\u00A0/g, " "],
];

const PROMPT_LINE =
  /^(Select the correct answer|Which of the statements given above|Which of the above statements|Choose the correct answer)/i;

export function normalizeGoldText(value: string) {
  let result = value ?? "";
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  return result.replace(/\s+/g, " ").trim();
}

function formatQuestion(parts: string[]) {
  const cleaned = parts.map((part) => normalizeGoldText(part)).filter(Boolean);
  if (cleaned.length <= 2) {
    return cleaned.join(" ").trim();
  }

  let promptIndex = cleaned.findIndex((line) => PROMPT_LINE.test(line));
  if (promptIndex === -1) {
    promptIndex = cleaned.length;
  }

  const intro = [cleaned[0]];
  const body = cleaned.slice(1, promptIndex);
  const outro = cleaned.slice(promptIndex);
  const hasExplicitNumbering = body.some((line) => /^(?:\d+\.|[IVXLCDM]+\.)/i.test(line));
  const headerLikeBodyLine =
    body.length > 1 && /:\s*$/.test(body[0] ?? "") && !/[.?!]$/.test(body[0] ?? "");

  const formattedBody = body.map((line, index) => {
    if (hasExplicitNumbering) {
      return line;
    }
    if (headerLikeBodyLine && index === 0) {
      return line;
    }
    if (body.length >= 2) {
      const number = headerLikeBodyLine ? index : index + 1;
      return `${number}. ${line}`;
    }
    return line;
  });

  return [...intro, ...formattedBody, ...outro].join(" ").trim();
}

export function parseManualUpload(raw: string, year: number, paperType: PaperType, sourceFile: string) {
  const lines = raw.split(/\r?\n/);
  const markdownQuestionStart = /^#{1,6}\s*(\d{1,3})\.\s*(.*)$/;
  const plainQuestionStart = /^(\d{1,3})\.\s*(.*)$/;
  const optionStart = /^\(([a-d])\)\s*(.*)$/i;

  let currentNumber: number | null = null;
  let questionLines: string[] = [];
  let options: string[] = [];
  let collectingOptions = false;

  const records: GoldPyqRecord[] = [];

  const flush = () => {
    if (currentNumber === null) {
      return;
    }

    const questionText = formatQuestion(questionLines);
    const normalizedOptions = options.map((option) => normalizeGoldText(option));

    while (normalizedOptions.length < 4) {
      normalizedOptions.push("[option missing]");
    }

    records.push({
      id: `UPSC_${year}_${paperType}_Q${currentNumber}`,
      number: currentNumber,
      year,
      examStage: "prelims",
      paperType,
      sourceFile,
      questionText,
      options: normalizedOptions.slice(0, 4),
    });

    currentNumber = null;
    questionLines = [];
    options = [];
    collectingOptions = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (/^---+$/.test(line)) {
      continue;
    }

    const markdownQuestionMatch = line.match(markdownQuestionStart);
    if (markdownQuestionMatch) {
      flush();
      currentNumber = Number(markdownQuestionMatch[1]);
      const remainder = normalizeGoldText(markdownQuestionMatch[2] ?? "");
      if (remainder) {
        questionLines.push(remainder);
      }
      collectingOptions = false;
      continue;
    }

    const questionMatch = line.match(plainQuestionStart);
    const candidateQuestionNumber = questionMatch?.[1] ? Number(questionMatch[1]) : null;
    const isSequentialQuestionStart =
      candidateQuestionNumber !== null &&
      (currentNumber === null ||
        (candidateQuestionNumber === currentNumber + 1 && options.length >= 4));
    if (questionMatch && isSequentialQuestionStart) {
      flush();
      currentNumber = candidateQuestionNumber;
      const remainder = normalizeGoldText(questionMatch[2] ?? "");
      if (remainder) {
        questionLines.push(remainder);
      }
      collectingOptions = false;
      continue;
    }

    const optionMatch = line.match(optionStart);
    if (optionMatch) {
      options.push(normalizeGoldText(optionMatch[2] ?? ""));
      collectingOptions = true;
      continue;
    }

    if (collectingOptions && options.length > 0) {
      options[options.length - 1] = normalizeGoldText(`${options[options.length - 1]} ${line}`);
      continue;
    }

    if (currentNumber !== null) {
      questionLines.push(normalizeGoldText(line));
    }
  }

  flush();
  return records;
}

export function buildGoldTextExport(records: GoldPyqRecord[]) {
  const lines: string[] = [];
  for (const record of records) {
    lines.push(`ID: ${record.id}`);
    lines.push(`Q${record.number}. ${record.questionText}`);
    lines.push(`A) ${record.options[0] ?? "[option missing]"}`);
    lines.push(`B) ${record.options[1] ?? "[option missing]"}`);
    lines.push(`C) ${record.options[2] ?? "[option missing]"}`);
    lines.push(`D) ${record.options[3] ?? "[option missing]"}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function findManualUploadPaths(referenceRoot: string, paperType: PaperType) {
  const paperDir = path.join(referenceRoot, paperType.toLowerCase());
  if (!fs.existsSync(paperDir)) {
    return [] as string[];
  }

  return fs
    .readdirSync(paperDir)
    .filter((entry) => /^ManualUpload\d{4}\.ts$/i.test(entry))
    .map((entry) => path.join(paperDir, entry))
    .sort();
}

export function canonicalizeForCompare(value: string) {
  return normalizeGoldText(value)
    .toLowerCase()
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}
