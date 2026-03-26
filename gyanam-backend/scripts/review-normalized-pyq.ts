import fs from "node:fs";
import path from "node:path";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveNormalizedPath,
} from "./pyq-paths.js";

const INPUT_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");

type ReviewStatus = "pending_review" | "approved" | "rejected";

type NormalizedPyqRecord = {
  id: string;
  year: number | null;
  examStage: "prelims";
  paperType: "GS1" | "CSAT";
  sourceFile: string;
  questionText: string;
  options: string[];
  status: ReviewStatus;
  reviewNotes: string;
};

function readRows(inputFile: string): NormalizedPyqRecord[] {
  return JSON.parse(fs.readFileSync(inputFile, "utf-8")) as NormalizedPyqRecord[];
}

function writeRows(inputFile: string, rows: NormalizedPyqRecord[]) {
  ensureParentDir(inputFile);
  fs.writeFileSync(inputFile, JSON.stringify(rows, null, 2));
}

function main() {
  const args = parsePyqCliArgs();
  const inputFile = args.year && args.paperType ? resolveNormalizedPath(args) : INPUT_FILE;
  const rawArgs = process.argv.slice(2);
  const positionals = rawArgs.filter((value, index) => {
    const previous = rawArgs[index - 1];
    return value !== "--year" && value !== "--paper" && previous !== "--year" && previous !== "--paper";
  });
  const [id, statusArg, ...noteParts] = positionals;
  if (!id || !statusArg) {
    throw new Error("Usage: npm run review:pyq:normalize -- <questionId> <approved|rejected|pending_review> [review notes]");
  }

  const status = statusArg as ReviewStatus;
  if (!["approved", "rejected", "pending_review"].includes(status)) {
    throw new Error(`Invalid status: ${statusArg}`);
  }

  const rows = readRows(inputFile);
  const target = rows.find((row) => row.id === id);
  if (!target) {
    throw new Error(`Question not found in normalized artifact: ${id}`);
  }

  target.status = status;
  target.reviewNotes = noteParts.join(" ").trim();
  writeRows(inputFile, rows);
  console.log(`Updated ${id} -> ${status} in ${inputFile}`);
}

main();
