import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YEARS = Array.from({ length: 10 }, (_, index) => 2016 + index);
const OUTPUT_DIR = path.resolve(__dirname, "../docs/pyq-questions/gs1");
const SUMMARY_PATH = path.resolve(OUTPUT_DIR, "gs1-summary.txt");

const safeText = (value) => (value ?? "").replace(/\s+/g, " ").trim();

const formatOption = (index, text) => {
  const letter = String.fromCharCode("A".charCodeAt(0) + index);
  return `${letter}) ${text}`;
};

const loadRows = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const exportYear = (year) => {
  const inputPath = path.resolve(__dirname, `../data/pyq/papers/${year}/gs1/normalized.json`);
  if (!fs.existsSync(inputPath)) {
    return {
      year,
      status: "missing",
      total: 0,
      missingText: 0,
      optionsNotFour: 0,
      emptyOptions: 0,
    };
  }

  const rows = loadRows(inputPath);
  const lines = [];

  let missingText = 0;
  let optionsNotFour = 0;
  let emptyOptions = 0;

  rows.forEach((row, index) => {
    const question = safeText(row.questionText ?? row.question);
    const options = Array.isArray(row.options) ? row.options.map((opt) => safeText(opt)) : [];

    if (!question) missingText++;
    if (options.length !== 4) optionsNotFour++;
    if (options.some((opt) => !opt)) emptyOptions++;

    lines.push(`ID: ${row.id ?? `GS1_${year}_${index + 1}`}`);
    lines.push(`Q${index + 1}. ${question || "[MISSING QUESTION TEXT]"}`);

    if (options.length === 0) {
      lines.push("[MISSING OPTIONS]");
    } else {
      options.forEach((option, optIndex) => {
        lines.push(formatOption(optIndex, option || "[MISSING OPTION TEXT]"));
      });
    }

    lines.push("");
  });

  const outputPath = path.resolve(OUTPUT_DIR, `gs1-${year}.txt`);
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");

  return {
    year,
    status: "ok",
    total: rows.length,
    missingText,
    optionsNotFour,
    emptyOptions,
  };
};

const writeSummary = (results) => {
  const lines = [];
  lines.push("GS1 EXPORT SUMMARY");
  lines.push("");

  for (const result of results) {
    if (result.status === "missing") {
      lines.push(`${result.year}: MISSING normalized.json`);
      continue;
    }
    lines.push(
      `${result.year}: total=${result.total}, missingText=${result.missingText}, optionsNotFour=${result.optionsNotFour}, emptyOptions=${result.emptyOptions}`,
    );
  }

  lines.push("");
  lines.push("Notes:");
  lines.push("- Review the per-year txt exports for manual verification.");
  lines.push("- Missing text/options counts indicate rows to inspect.");

  fs.writeFileSync(SUMMARY_PATH, lines.join("\n"), "utf-8");
};

const main = () => {
  ensureDir(OUTPUT_DIR);
  const results = YEARS.map(exportYear);
  writeSummary(results);
  console.log(`GS1 txt exports written to: ${OUTPUT_DIR}`);
  console.log(`Summary written to: ${SUMMARY_PATH}`);
};

main();
