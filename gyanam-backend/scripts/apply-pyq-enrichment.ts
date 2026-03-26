import fs from "node:fs";
import path from "node:path";
import type { NormalizedPyqRecord } from "./pyq-review-utils.js";
import type { PyqEnrichmentRecord } from "./pyq-enrichment-utils.js";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveEnrichmentPath,
  resolveNormalizedPath,
} from "./pyq-paths.js";

const PYQ_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");
const ENRICHMENT_FILE = path.resolve(process.cwd(), "data/pyq/pyq.enrichment.v1.json");

function readPyqRows(pyqFile: string): NormalizedPyqRecord[] {
  return JSON.parse(fs.readFileSync(pyqFile, "utf-8")) as NormalizedPyqRecord[];
}

function readEnrichmentRows(enrichmentFile: string): Map<string, PyqEnrichmentRecord> {
  if (!fs.existsSync(enrichmentFile)) {
    throw new Error("PYQ enrichment file not found. Run bootstrap:pyq:enrichment first.");
  }

  const rows = JSON.parse(fs.readFileSync(enrichmentFile, "utf-8")) as PyqEnrichmentRecord[];
  return new Map(rows.map((row) => [row.id, row]));
}

function writeEnrichmentRows(enrichmentFile: string, rows: PyqEnrichmentRecord[]) {
  ensureParentDir(enrichmentFile);
  fs.writeFileSync(enrichmentFile, JSON.stringify(rows, null, 2));
}

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  History: [
    "revolt",
    "dynasty",
    "british",
    "mughal",
    "colonial",
    "ancient",
    "medieval",
    "sangam",
    "stupa",
    "vijayanagara",
    "charter act",
    "regulating act",
    "constituent assembly",
  ],
  Geography: [
    "river",
    "lake",
    "mountain",
    "monsoon",
    "coast",
    "port",
    "soil",
    "climate",
    "earthquake",
    "delta",
    "plateau",
    "latitude",
    "rainfall",
  ],
  Polity: [
    "constitution",
    "parliament",
    "fundamental rights",
    "president",
    "governor",
    "article",
    "amendment",
    "schedule",
    "lok sabha",
    "rajya sabha",
    "election commission",
  ],
  Economy: [
    "gdp",
    "rbi",
    "inflation",
    "budget",
    "tax",
    "gst",
    "bank",
    "capital market",
    "trade",
    "fiscal",
    "monetary",
    "investment",
    "msme",
    "shg",
  ],
  Environment: [
    "wildlife",
    "species",
    "forest",
    "biodiversity",
    "pollution",
    "climate change",
    "carbon",
    "ecosystem",
    "wetland",
    "conservation",
    "iucn",
  ],
  "Science & Technology": [
    "satellite",
    "missile",
    "nuclear",
    "dna",
    "biotechnology",
    "space",
    "isro",
    "accelerometer",
    "sensor",
    "genome",
    "vaccine",
  ],
  "Current Affairs": [
    "g-20",
    "g20",
    "united nations",
    "who",
    "recently",
    "coup",
    "summit",
    "chess olympiad",
    "sports award",
    "khel ratna",
  ],
};

function inferSubject(row: NormalizedPyqRecord): string | null {
  const lower = `${row.questionText} ${row.options.join(" ")}`.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    scores[subject] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] <= 0) {
    return null;
  }

  return best[0];
}

function ensureSubject(row: NormalizedPyqRecord, enrichment: PyqEnrichmentRecord | undefined) {
  const existing = row.subject?.trim() || enrichment?.subject?.trim();
  if (existing) {
    return { subject: existing, status: "manual" as const };
  }

  const suggestion = enrichment?.subjectSuggestion?.trim();
  if (suggestion) {
    return { subject: suggestion, status: "auto_inferred" as const };
  }

  const inferred = inferSubject(row);
  if (inferred) {
    return { subject: inferred, status: "auto_inferred" as const };
  }

  return { subject: "Unknown", status: "pending" as const };
}

function writePyqRows(pyqFile: string, rows: NormalizedPyqRecord[]) {
  ensureParentDir(pyqFile);
  fs.writeFileSync(pyqFile, JSON.stringify(rows, null, 2));
}

function main() {
  const args = parsePyqCliArgs();
  const pyqFile = args.year && args.paperType ? resolveNormalizedPath(args) : PYQ_FILE;
  const enrichmentFile = args.year && args.paperType ? resolveEnrichmentPath(args) : ENRICHMENT_FILE;

  const pyqRows = readPyqRows(pyqFile);
  const enrichmentRows = readEnrichmentRows(enrichmentFile);
  let subjectsApplied = 0;
  let answersApplied = 0;
  let enrichmentUpdated = 0;

  const nextRows = pyqRows.map((row) => {
    const enrichment = enrichmentRows.get(row.id);
    if (!enrichment) {
      return row;
    }

    const nextRow: NormalizedPyqRecord = { ...row };

    const subjectResult = ensureSubject(nextRow, enrichment);
    if (subjectResult.subject && nextRow.subject !== subjectResult.subject) {
      nextRow.subject = subjectResult.subject;
      nextRow.subjectStatus = subjectResult.status;
      subjectsApplied += 1;
    }

    if (enrichment.subject !== nextRow.subject || enrichment.subjectStatus !== nextRow.subjectStatus) {
      enrichmentRows.set(row.id, {
        ...enrichment,
        subject: nextRow.subject,
        subjectStatus: nextRow.subjectStatus,
        subjectSuggestion: enrichment.subjectSuggestion ?? nextRow.subject,
      });
      enrichmentUpdated += 1;
    }

    if (enrichment.correctAnswer && nextRow.correctAnswer !== enrichment.correctAnswer) {
      nextRow.correctAnswer = enrichment.correctAnswer;
      answersApplied += 1;
    }

    if (enrichment.answerStatus && nextRow.answerStatus !== enrichment.answerStatus) {
      nextRow.answerStatus = enrichment.answerStatus;
    }

    if (enrichment.answerSource && nextRow.answerSource !== enrichment.answerSource) {
      nextRow.answerSource = enrichment.answerSource;
    }

    return nextRow;
  });

  writePyqRows(pyqFile, nextRows);
  if (enrichmentUpdated > 0) {
    writeEnrichmentRows(enrichmentFile, Array.from(enrichmentRows.values()));
  }

  console.log(
    JSON.stringify(
      {
        pyqFile,
        enrichmentFile,
        totalRows: nextRows.length,
        subjectsApplied,
        answersApplied,
        enrichmentUpdated,
        approvedRowsReadyForIngest: nextRows.filter(
          (row) => row.status === "approved" && row.subject && row.correctAnswer,
        ).length,
      },
      null,
      2,
    ),
  );
}

main();
