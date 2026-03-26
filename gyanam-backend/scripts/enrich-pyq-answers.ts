import fs from "node:fs";
import path from "node:path";
import type {
  AnswerProposalRecord,
  AnswerReferenceRecord,
  PyqEnrichmentRecord,
} from "./pyq-enrichment-utils.js";
import {
  parseAnswerProposalRows,
  parseAnswerReferenceRows,
  reconcileAnswerEvidence,
} from "./pyq-enrichment-utils.js";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveAnswerProposalsPath,
  resolveAnswerReferencesPath,
  resolveEnrichmentPath,
} from "./pyq-paths.js";

const ENRICHMENT_FILE = path.resolve(process.cwd(), "data/pyq/pyq.enrichment.v1.json");
const PROPOSALS_FILE = path.resolve(process.cwd(), "data/pyq/pyq.answer-proposals.v1.json");
const REFERENCES_FILE = path.resolve(process.cwd(), "data/pyq/pyq.answer-reference.v1.json");

function readEnrichmentRows(enrichmentFile: string): PyqEnrichmentRecord[] {
  if (!fs.existsSync(enrichmentFile)) {
    throw new Error("PYQ enrichment file not found. Run bootstrap:pyq:enrichment first.");
  }

  return JSON.parse(fs.readFileSync(enrichmentFile, "utf-8")) as PyqEnrichmentRecord[];
}

function readProposalRows(proposalsFile: string): Map<string, AnswerProposalRecord> {
  if (!fs.existsSync(proposalsFile)) {
    return new Map();
  }

  const rows = parseAnswerProposalRows(JSON.parse(fs.readFileSync(proposalsFile, "utf-8")));
  return new Map(rows.map((row) => [row.id, row]));
}

function readReferenceRows(referencesFile: string): Map<string, AnswerReferenceRecord> {
  if (!fs.existsSync(referencesFile)) {
    return new Map();
  }

  const rows = parseAnswerReferenceRows(JSON.parse(fs.readFileSync(referencesFile, "utf-8")));
  return new Map(rows.map((row) => [row.id, row]));
}

function writeEnrichmentRows(enrichmentFile: string, rows: PyqEnrichmentRecord[]) {
  ensureParentDir(enrichmentFile);
  fs.writeFileSync(enrichmentFile, JSON.stringify(rows, null, 2));
}

function main() {
  const args = parsePyqCliArgs();
  const enrichmentFile = args.year && args.paperType ? resolveEnrichmentPath(args) : ENRICHMENT_FILE;
  const proposalsFile = args.year && args.paperType ? resolveAnswerProposalsPath(args) : PROPOSALS_FILE;
  const referencesFile = args.year && args.paperType ? resolveAnswerReferencesPath(args) : REFERENCES_FILE;

  const enrichmentRows = readEnrichmentRows(enrichmentFile);
  const proposals = readProposalRows(proposalsFile);
  const references = readReferenceRows(referencesFile);

  let aiProvisional = 0;
  let provisionalCorrect = 0;
  let officialConfirmed = 0;
  let conflict = 0;
  let pending = 0;

  const nextRows = enrichmentRows.map((row) => {
    const reconciled = reconcileAnswerEvidence({
      current: row,
      proposal: proposals.get(row.id),
      reference: references.get(row.id),
    });

    const nextRow: PyqEnrichmentRecord = {
      ...row,
      ...reconciled,
    };

    if (nextRow.answerStatus === "ai_provisional") {
      aiProvisional += 1;
    } else if (nextRow.answerStatus === "provisional_correct") {
      provisionalCorrect += 1;
    } else if (nextRow.answerStatus === "official_confirmed") {
      officialConfirmed += 1;
    } else if (nextRow.answerStatus === "conflict") {
      conflict += 1;
    } else {
      pending += 1;
    }

    return nextRow;
  });

  writeEnrichmentRows(enrichmentFile, nextRows);

  console.log(
    JSON.stringify(
      {
        enrichmentFile,
        proposalsFile,
        referencesFile,
        totalRows: nextRows.length,
        aiProvisional,
        provisionalCorrect,
        officialConfirmed,
        conflict,
        pending,
        rowsWithCorrectAnswer: nextRows.filter((row) => row.correctAnswer).length,
      },
      null,
      2,
    ),
  );
}

main();
