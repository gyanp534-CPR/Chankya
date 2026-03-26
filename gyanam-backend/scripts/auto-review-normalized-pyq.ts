import fs from "node:fs";
import path from "node:path";
import { inspectRow, type NormalizedPyqRecord } from "./pyq-review-utils.js";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveNormalizedPath,
} from "./pyq-paths.js";

const INPUT_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");

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
  const rows = readRows(inputFile);
  let approved = 0;
  let rejected = 0;
  let pending = 0;

  const nextRows = rows.map((row) => {
    const reviewed = inspectRow(row);
    const nextRow: NormalizedPyqRecord = {
      ...reviewed.cleanedRow,
      status: reviewed.nextStatus,
      reviewNotes: reviewed.reviewNotes,
    };

    if (nextRow.status === "approved") {
      approved += 1;
    } else if (nextRow.status === "rejected") {
      rejected += 1;
    } else {
      pending += 1;
    }

    return nextRow;
  });

  writeRows(inputFile, nextRows);

  console.log(
    JSON.stringify(
      {
        inputFile,
        total: nextRows.length,
        approved,
        rejected,
        pending_review: pending,
      },
      null,
      2,
    ),
  );
}

main();
