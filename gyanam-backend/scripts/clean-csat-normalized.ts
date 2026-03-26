import fs from "node:fs";
import path from "node:path";

type NormalizedRow = {
  id: string;
  questionText: string;
  options: string[];
};

type CleanReport = {
  year: number;
  total: number;
  kept: number;
  removedMissingText: number;
  duplicateCount: number;
};

const ROOT = path.resolve(process.cwd());
const CSAT_TEXT_DIR = path.join(ROOT, "docs", "pyq-questions", "csat");
const PAPERS_DIR = path.join(ROOT, "data", "pyq", "papers");

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  return JSON.parse(cleaned) as T;
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuestionNumber(id: string) {
  const match = id.match(/_Q(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function loadTextBlob(year: number) {
  const filePath = path.join(CSAT_TEXT_DIR, `CSAT-${year}.txt`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return normalizeForMatch(raw);
}

function cleanYear(year: number): CleanReport | null {
  const normalizedPath = path.join(PAPERS_DIR, String(year), "csat", "normalized.json");
  if (!fs.existsSync(normalizedPath)) {
    return null;
  }

  const blob = loadTextBlob(year);
  if (!blob) {
    return null;
  }

  const rows = readJson<NormalizedRow[]>(normalizedPath);
  const seen = new Map<string, NormalizedRow>();
  let removedMissingText = 0;
  let duplicateCount = 0;

  for (const row of rows) {
    const key = normalizeForMatch(row.questionText);
    if (!key || !blob.includes(key)) {
      removedMissingText += 1;
      continue;
    }
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.set(key, row);
  }

  const cleaned = Array.from(seen.values()).sort(
    (a, b) => extractQuestionNumber(a.id) - extractQuestionNumber(b.id),
  );

  fs.writeFileSync(normalizedPath, JSON.stringify(cleaned, null, 2));

  return {
    year,
    total: rows.length,
    kept: cleaned.length,
    removedMissingText,
    duplicateCount,
  };
}

function main() {
  const reports: CleanReport[] = [];
  for (let year = 2016; year <= 2025; year += 1) {
    const report = cleanYear(year);
    if (report) {
      reports.push(report);
    }
  }

  if (reports.length === 0) {
    console.log("No CSAT normalized files found to clean.");
    return;
  }

  console.table(reports);
}

main();
