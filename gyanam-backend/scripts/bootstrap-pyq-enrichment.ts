import fs from "node:fs";
import path from "node:path";
import type { NormalizedPyqRecord } from "./pyq-review-utils.js";
import { suggestSubject, type PyqEnrichmentRecord } from "./pyq-enrichment-utils.js";
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

function readEnrichmentRows(enrichmentFile: string): PyqEnrichmentRecord[] {
  if (!fs.existsSync(enrichmentFile)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(enrichmentFile, "utf-8")) as PyqEnrichmentRecord[];
}

function writeEnrichmentRows(enrichmentFile: string, rows: PyqEnrichmentRecord[]) {
  ensureParentDir(enrichmentFile);
  fs.writeFileSync(enrichmentFile, JSON.stringify(rows, null, 2));
}

function main() {
  const args = parsePyqCliArgs();
  const pyqFile = args.year && args.paperType ? resolveNormalizedPath(args) : PYQ_FILE;
  const enrichmentFile = args.year && args.paperType ? resolveEnrichmentPath(args) : ENRICHMENT_FILE;

  const pyqRows = readPyqRows(pyqFile).filter((row) => row.status === "approved");
  const existing = new Map(readEnrichmentRows(enrichmentFile).map((row) => [row.id, row]));

  const nextRows = pyqRows.map((row) => {
    const current = existing.get(row.id);
    const suggestion = suggestSubject(row);
    const derivedSubject = current?.subject ?? suggestion.subject;

    return {
      id: row.id,
      subject: derivedSubject,
      subjectSuggestion: current?.subjectSuggestion ?? suggestion.subject,
      subjectConfidence: current?.subjectConfidence ?? suggestion.confidence,
      correctAnswer: current?.correctAnswer ?? null,
      aiProposedAnswer: current?.aiProposedAnswer ?? null,
      aiProposalSource: current?.aiProposalSource,
      referenceAnswer: current?.referenceAnswer ?? null,
      referenceSource: current?.referenceSource,
      answerStatus: current?.answerStatus ?? "pending",
      answerSource: current?.answerSource,
      notes: current?.notes ?? "",
    } satisfies PyqEnrichmentRecord;
  });

  writeEnrichmentRows(enrichmentFile, nextRows);

  console.log(
    JSON.stringify(
      {
        pyqFile,
        enrichmentFile,
        totalApprovedRows: pyqRows.length,
        scaffoldedRows: nextRows.length,
        suggestedSubjects: nextRows.filter((row) => row.subjectSuggestion).length,
        missingAnswerKeys: nextRows.filter((row) => !row.correctAnswer).length,
      },
      null,
      2,
    ),
  );
}

main();
