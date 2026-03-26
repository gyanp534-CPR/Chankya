import fs from "node:fs";
import path from "node:path";
import { inspectRow, type NormalizedPyqRecord, type PaperType } from "./pyq-review-utils.js";
import { parsePyqCliArgs, resolveNormalizedPath } from "./pyq-paths.js";

const INPUT_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");

type GroupSummary = {
  sourceFile: string;
  year: number | null;
  paperType: PaperType;
  total: number;
  firstQuestionNumber: number | null;
  lastQuestionNumber: number | null;
  missingQuestionNumbers: number[];
  malformedOptionIds: string[];
  suspiciousIds: string[];
  structuralReviewIds: string[];
  rejectedCandidateIds: string[];
  statusCounts: {
    approved: number;
    rejected: number;
    pending_review: number;
  };
};

function parseRows(inputFile: string): NormalizedPyqRecord[] {
  return JSON.parse(fs.readFileSync(inputFile, "utf-8")) as NormalizedPyqRecord[];
}

function parseQuestionNumber(id: string): number | null {
  const match = id.match(/_Q(\d+)$/);
  return match?.[1] ? Number(match[1]) : null;
}

function hasSuspiciousText(value: string): boolean {
  return (
    value.includes("Â") ||
    value.includes("Ã") ||
    value.includes("[ P") ||
    /\bP\s*\.?\s*T\s*\.?\s*O\b/i.test(value) ||
    /\bXDTG\b/i.test(value) ||
    /\b\d+\s*\.\s*\d+\s*\./.test(value)
  );
}

function summarizeGroup(rows: NormalizedPyqRecord[]): GroupSummary {
  const sorted = [...rows].sort((a, b) => (parseQuestionNumber(a.id) ?? 0) - (parseQuestionNumber(b.id) ?? 0));
  const numbers = sorted.map((row) => parseQuestionNumber(row.id)).filter((value): value is number => value !== null);
  const first = numbers[0] ?? null;
  const last = numbers.at(-1) ?? null;
  const numberSet = new Set(numbers);
  const missing: number[] = [];

  if (first !== null && last !== null) {
    for (let i = first; i <= last; i += 1) {
      if (!numberSet.has(i)) {
        missing.push(i);
      }
    }
  }

  const malformedOptionIds = sorted
    .filter((row) => row.options.length !== 4 || row.options.some((option) => option.trim().length === 0))
    .map((row) => row.id);

  const suspiciousIds = sorted
    .filter((row) => hasSuspiciousText(row.questionText) || row.options.some((option) => hasSuspiciousText(option)))
    .map((row) => row.id);

  const structuralReviewIds = sorted
    .filter((row) => inspectRow(row).issues.length > 0)
    .map((row) => row.id);

  const rejectedCandidateIds = sorted
    .filter((row) => inspectRow(row).nextStatus === "rejected")
    .map((row) => row.id);

  const statusCounts = sorted.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { approved: 0, rejected: 0, pending_review: 0 },
  );

  return {
    sourceFile: rows[0]?.sourceFile ?? "unknown",
    year: rows[0]?.year ?? null,
    paperType: rows[0]?.paperType ?? "GS1",
    total: rows.length,
    firstQuestionNumber: first,
    lastQuestionNumber: last,
    missingQuestionNumbers: missing,
    malformedOptionIds,
    suspiciousIds,
    structuralReviewIds,
    rejectedCandidateIds,
    statusCounts,
  };
}

function main() {
  const args = parsePyqCliArgs();
  const inputFile = args.year && args.paperType ? resolveNormalizedPath(args) : INPUT_FILE;
  const rows = parseRows(inputFile);
  const groups = new Map<string, NormalizedPyqRecord[]>();

  for (const row of rows) {
    const key = `${row.sourceFile}::${row.paperType}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const summaries = [...groups.values()]
    .map(summarizeGroup)
    .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

  const report = {
    inputFile,
    totalRows: rows.length,
    groupedFiles: summaries.length,
    summaries,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
