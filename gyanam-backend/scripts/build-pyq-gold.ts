import fs from "node:fs";
import path from "node:path";
import { ensureParentDir } from "./pyq-paths.js";
import type { PaperType } from "./pyq-review-utils.js";
import {
  buildGoldTextExport,
  findManualUploadPaths,
  parseManualUpload,
  type GoldPyqRecord,
} from "./pyq-gold-utils.js";

const REFERENCE_ROOT = path.resolve(process.cwd(), "docs", "pyq-questions");
const GOLD_ROOT = path.resolve(process.cwd(), "data", "pyq", "gold");

function getArg(args: string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parsePaperType(value: string | undefined): PaperType {
  const normalized = (value ?? "GS1").trim().toUpperCase();
  if (normalized === "GS1" || normalized === "CSAT") {
    return normalized;
  }
  throw new Error(`Invalid paper type: ${value}. Expected GS1 or CSAT.`);
}

function parseYears(args: string[]) {
  const yearArg = getArg(args, "--year");
  if (yearArg) {
    const year = Number(yearArg);
    if (!Number.isInteger(year)) {
      throw new Error(`Invalid year: ${yearArg}`);
    }
    return [year];
  }

  const yearsArg = getArg(args, "--years");
  if (!yearsArg) {
    return null;
  }

  const years = yearsArg
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));

  if (years.length === 0) {
    throw new Error(`Invalid years: ${yearsArg}`);
  }

  return years;
}

function extractYearFromManualPath(filePath: string) {
  const match = path.basename(filePath).match(/ManualUpload(\d{4})\.ts/i);
  return match?.[1] ? Number(match[1]) : null;
}

function writeScopeOutputs(records: GoldPyqRecord[], paperType: PaperType) {
  const first = records[0];
  if (!first) {
    return;
  }

  const scopeDir = path.join(GOLD_ROOT, "papers", String(first.year), paperType.toLowerCase());
  const goldJsonPath = path.join(scopeDir, "gold.json");
  const goldTxtPath = path.join(scopeDir, "gold.txt");

  ensureParentDir(goldJsonPath);
  fs.writeFileSync(goldJsonPath, `${JSON.stringify(records, null, 2)}\n`);
  fs.writeFileSync(goldTxtPath, buildGoldTextExport(records));

  console.log(`Froze ${records.length} gold questions at ${path.relative(process.cwd(), goldJsonPath)}`);
}

function main() {
  const args = process.argv.slice(2);
  const paperType = parsePaperType(getArg(args, "--paper"));
  const requestedYears = parseYears(args);

  const manualUploadPaths = findManualUploadPaths(REFERENCE_ROOT, paperType);
  if (manualUploadPaths.length === 0) {
    throw new Error(`No manual uploads found under ${path.join(REFERENCE_ROOT, paperType.toLowerCase())}`);
  }

  const selectedPaths = manualUploadPaths.filter((manualPath) => {
    if (!requestedYears) {
      return true;
    }
    const year = extractYearFromManualPath(manualPath);
    return year !== null && requestedYears.includes(year);
  });

  if (selectedPaths.length === 0) {
    throw new Error("No matching manual uploads found for the requested years.");
  }

  for (const manualPath of selectedPaths) {
    const year = extractYearFromManualPath(manualPath);
    if (!year) {
      continue;
    }

    const raw = fs.readFileSync(manualPath, "utf-8");
    const records = parseManualUpload(raw, year, paperType, path.basename(manualPath));
    writeScopeOutputs(records, paperType);
  }

  const allRecords: GoldPyqRecord[] = [];
  for (const manualPath of manualUploadPaths) {
    const year = extractYearFromManualPath(manualPath);
    if (!year) {
      continue;
    }

    const raw = fs.readFileSync(manualPath, "utf-8");
    const records = parseManualUpload(raw, year, paperType, path.basename(manualPath));
    allRecords.push(...records);
  }

  const aggregatePath = path.join(GOLD_ROOT, "pyq.gold.v1.json");
  ensureParentDir(aggregatePath);
  fs.writeFileSync(aggregatePath, `${JSON.stringify(allRecords, null, 2)}\n`);
  console.log(`Wrote aggregate gold dataset to ${path.relative(process.cwd(), aggregatePath)}`);
}

main();
