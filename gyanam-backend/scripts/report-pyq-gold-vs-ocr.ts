import fs from "node:fs";
import path from "node:path";
import { ensureParentDir, getPaperArtifacts } from "./pyq-paths.js";
import type { NormalizedPyqRecord, PaperType } from "./pyq-review-utils.js";
import { canonicalizeForCompare, type GoldPyqRecord } from "./pyq-gold-utils.js";

const GOLD_ROOT = path.resolve(process.cwd(), "data", "pyq", "gold");
const REPORT_ROOT = path.join(GOLD_ROOT, "reports");

type ComparisonSample = {
  id: string;
  questionTextMatches: boolean;
  optionMatches: boolean[];
  goldQuestionText: string;
  ocrQuestionText: string;
  goldOptions: string[];
  ocrOptions: string[];
};

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
    throw new Error("This command requires --year <YYYY> or --years <YYYY,YYYY>.");
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

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function extractQuestionNumber(id: string) {
  return Number(id.split("_Q")[1] ?? "0");
}

function loadGold(year: number, paperType: PaperType) {
  const goldPath = path.join(GOLD_ROOT, "papers", String(year), paperType.toLowerCase(), "gold.json");
  if (!fs.existsSync(goldPath)) {
    throw new Error(`Gold dataset not found for ${year} ${paperType}: ${goldPath}`);
  }

  return {
    goldPath,
    rows: readJsonFile<GoldPyqRecord[]>(goldPath),
  };
}

function loadOcr(year: number, paperType: PaperType) {
  const artifacts = getPaperArtifacts({ year, paperType });
  const parserOnlyPath = path.join(artifacts.rootDir, "normalized.ocr.json");
  const fallbackPath = artifacts.normalizedPath;
  const ocrPath = fs.existsSync(parserOnlyPath) ? parserOnlyPath : fallbackPath;

  if (!fs.existsSync(ocrPath)) {
    throw new Error(`OCR normalized output not found for ${year} ${paperType}: ${ocrPath}`);
  }

  return {
    ocrPath,
    rows: readJsonFile<NormalizedPyqRecord[]>(ocrPath),
  };
}

function compareScope(year: number, paperType: PaperType) {
  const { goldPath, rows: goldRows } = loadGold(year, paperType);
  const { ocrPath, rows: ocrRows } = loadOcr(year, paperType);

  const goldByNumber = new Map(goldRows.map((row) => [row.number, row]));
  const ocrByNumber = new Map(ocrRows.map((row) => [extractQuestionNumber(row.id), row]));
  const numbers = Array.from(new Set([...goldByNumber.keys(), ...ocrByNumber.keys()])).sort((a, b) => a - b);

  let exactMatchCount = 0;
  let questionTextMismatchCount = 0;
  let optionSlotMismatchCount = 0;
  let optionRowMismatchCount = 0;
  let missingInOcrCount = 0;
  let missingInGoldCount = 0;
  let rowsWithAnyMismatch = 0;
  const mismatchSamples: ComparisonSample[] = [];

  for (const number of numbers) {
    const gold = goldByNumber.get(number);
    const ocr = ocrByNumber.get(number);

    if (!gold) {
      missingInGoldCount += 1;
      continue;
    }

    if (!ocr) {
      missingInOcrCount += 1;
      continue;
    }

    const questionTextMatches =
      canonicalizeForCompare(gold.questionText) === canonicalizeForCompare(ocr.questionText);
    const optionMatches = Array.from({ length: 4 }, (_, index) => {
      const goldOption = gold.options[index] ?? "";
      const ocrOption = ocr.options[index] ?? "";
      return canonicalizeForCompare(goldOption) === canonicalizeForCompare(ocrOption);
    });

    const optionMismatchSlots = optionMatches.filter((match) => !match).length;
    if (!questionTextMatches) {
      questionTextMismatchCount += 1;
    }
    if (optionMismatchSlots > 0) {
      optionSlotMismatchCount += optionMismatchSlots;
      optionRowMismatchCount += 1;
    }
    if (questionTextMatches && optionMismatchSlots === 0) {
      exactMatchCount += 1;
      continue;
    }

    rowsWithAnyMismatch += 1;

    if (mismatchSamples.length < 15) {
      mismatchSamples.push({
        id: gold.id,
        questionTextMatches,
        optionMatches,
        goldQuestionText: gold.questionText,
        ocrQuestionText: ocr.questionText,
        goldOptions: gold.options,
        ocrOptions: ocr.options,
      });
    }
  }

  const totalGoldRows = goldRows.length;
  const rowsCompared = totalGoldRows - missingInOcrCount;

  const report = {
    year,
    paperType,
    generatedAt: new Date().toISOString(),
    goldPath: path.relative(process.cwd(), goldPath),
    ocrPath: path.relative(process.cwd(), ocrPath),
    totalGoldRows,
    rowsCompared,
    exactMatchCount,
    exactMatchRate: totalGoldRows === 0 ? 0 : Number((exactMatchCount / totalGoldRows).toFixed(4)),
    questionTextMismatchCount,
    optionRowMismatchCount,
    optionSlotMismatchCount,
    missingInOcrCount,
    missingInGoldCount,
    rowErrorCount: totalGoldRows - exactMatchCount,
    rowErrorRate: totalGoldRows === 0 ? 0 : Number(((totalGoldRows - exactMatchCount) / totalGoldRows).toFixed(4)),
    rowsWithAnyMismatch,
    mismatchSamples,
  };

  const reportPath = path.join(REPORT_ROOT, String(year), paperType.toLowerCase(), "ocr-vs-gold.json");
  ensureParentDir(reportPath);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    [
      `${year} ${paperType}`,
      `exact=${exactMatchCount}/${totalGoldRows}`,
      `questionMismatch=${questionTextMismatchCount}`,
      `optionRowMismatch=${optionRowMismatchCount}`,
      `optionSlotMismatch=${optionSlotMismatchCount}`,
      `missingInOcr=${missingInOcrCount}`,
      `report=${path.relative(process.cwd(), reportPath)}`,
    ].join(" | "),
  );
}

function main() {
  const args = process.argv.slice(2);
  const paperType = parsePaperType(getArg(args, "--paper"));
  const years = parseYears(args);

  for (const year of years) {
    compareScope(year, paperType);
  }
}

main();
