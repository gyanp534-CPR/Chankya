import fs from "node:fs";
import path from "node:path";
import type { NormalizedPyqRecord } from "./pyq-review-utils.js";
import {
  parseAnswerProposalRows,
  parseAnswerReferenceRows,
  type AnswerProposalRecord,
  type AnswerReferenceRecord,
} from "./pyq-enrichment-utils.js";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveAnswerProposalsPath,
  resolveAnswerReferencesPath,
  resolveNormalizedPath,
} from "./pyq-paths.js";

const PYQ_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");
const PROPOSALS_FILE = path.resolve(process.cwd(), "data/pyq/pyq.answer-proposals.v1.json");
const REFERENCES_FILE = path.resolve(process.cwd(), "data/pyq/pyq.answer-reference.v1.json");

function readPyqRows(pyqFile: string): NormalizedPyqRecord[] {
  return JSON.parse(fs.readFileSync(pyqFile, "utf-8")) as NormalizedPyqRecord[];
}

function readProposalRows(proposalsFile: string): AnswerProposalRecord[] {
  if (!fs.existsSync(proposalsFile)) {
    return [];
  }

  return parseAnswerProposalRows(JSON.parse(fs.readFileSync(proposalsFile, "utf-8")));
}

function readReferenceRows(referencesFile: string): AnswerReferenceRecord[] {
  if (!fs.existsSync(referencesFile)) {
    return [];
  }

  return parseAnswerReferenceRows(JSON.parse(fs.readFileSync(referencesFile, "utf-8")));
}

function writeProposalRows(proposalsFile: string, rows: AnswerProposalRecord[]) {
  ensureParentDir(proposalsFile);
  fs.writeFileSync(proposalsFile, JSON.stringify(rows, null, 2));
}

function writeReferenceRows(referencesFile: string, rows: AnswerReferenceRecord[]) {
  const compactRows = Object.fromEntries(rows.map((row) => [row.id, row.referenceAnswer ?? null]));
  ensureParentDir(referencesFile);
  fs.writeFileSync(referencesFile, JSON.stringify(compactRows, null, 2));
}

function main() {
  const args = parsePyqCliArgs();
  const pyqFile = args.year && args.paperType ? resolveNormalizedPath(args) : PYQ_FILE;
  const proposalsFile = args.year && args.paperType ? resolveAnswerProposalsPath(args) : PROPOSALS_FILE;
  const referencesFile = args.year && args.paperType ? resolveAnswerReferencesPath(args) : REFERENCES_FILE;

  const approvedRows = readPyqRows(pyqFile).filter((row) => row.status === "approved");
  const proposalMap = new Map(readProposalRows(proposalsFile).map((row) => [row.id, row]));
  const referenceMap = new Map(readReferenceRows(referencesFile).map((row) => [row.id, row]));

  const nextProposals = approvedRows.map((row) => {
    const current = proposalMap.get(row.id);
    return {
      id: row.id,
      proposedAnswer: current?.proposedAnswer ?? null,
      source: current?.source ?? "",
      confidence: current?.confidence ?? null,
      rationale: current?.rationale ?? "",
      notes: current?.notes ?? "",
    } satisfies AnswerProposalRecord;
  });

  const nextReferences = approvedRows.map((row) => {
    const current = referenceMap.get(row.id);
    return {
      id: row.id,
      referenceAnswer: current?.referenceAnswer ?? null,
      source: current?.source ?? "",
      sourceType: current?.sourceType ?? "coaching",
      publishedAt: current?.publishedAt ?? "",
      notes: current?.notes ?? "",
    } satisfies AnswerReferenceRecord;
  });

  writeProposalRows(proposalsFile, nextProposals);
  writeReferenceRows(referencesFile, nextReferences);

  console.log(
    JSON.stringify(
      {
        pyqFile,
        proposalsFile,
        referencesFile,
        totalApprovedRows: approvedRows.length,
        proposalRows: nextProposals.length,
        referenceRows: nextReferences.length,
        missingProposalAnswers: nextProposals.filter((row) => !row.proposedAnswer).length,
        missingReferenceAnswers: nextReferences.filter((row) => !row.referenceAnswer).length,
      },
      null,
      2,
    ),
  );
}

main();
