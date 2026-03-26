import fs from "node:fs";
import path from "node:path";
import { getPaperArtifacts, parsePyqCliArgs } from "./pyq-paths.js";

type DebugRow = {
  id: string;
  questionText: string;
  options: string[];
  confidenceScore?: number;
  confidenceFlags?: string[];
};

function renderRow(row: DebugRow) {
  const flags = row.confidenceFlags ?? [];
  const flagText = flags.length > 0 ? flags.join(", ") : "none";
  const lowConfidence = (row.confidenceScore ?? 100) < 60 || flags.length > 0;
  const rowClass = lowConfidence ? "row low" : "row ok";

  const optionItems = row.options.map((option) => `<li class="option">${option}</li>`).join("");

  return `
    <div class="${rowClass}">
      <div class="meta">
        <span class="id">${row.id}</span>
        <span class="score">score: ${row.confidenceScore ?? "n/a"}</span>
        <span class="flags">flags: ${flagText}</span>
      </div>
      <div class="question">${row.questionText}</div>
      <ul class="options">${optionItems}</ul>
    </div>
  `;
}

function renderHtml(rows: DebugRow[]) {
  const body = rows.map(renderRow).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PYQ Debug View</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #0f1115; color: #e6e6e6; }
    .row { border: 1px solid #2a2f3a; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #151922; }
    .row.low { border-color: #b44; box-shadow: 0 0 0 1px #b44 inset; }
    .meta { display: flex; gap: 16px; font-size: 12px; color: #9aa4b2; margin-bottom: 8px; }
    .question { color: #9be28a; margin-bottom: 8px; line-height: 1.4; }
    .options { list-style: none; padding-left: 0; margin: 0; }
    .option { color: #80b7ff; margin-bottom: 4px; }
  </style>
</head>
<body>
  <h1>PYQ Debug View</h1>
  ${body}
</body>
</html>`;
}

function main() {
  const args = parsePyqCliArgs();
  if (!args.year || !args.paperType) {
    throw new Error("Usage: npm run debug:pyq -- --year <YYYY> --paper <GS1|CSAT>");
  }

  const artifacts = getPaperArtifacts({ year: args.year, paperType: args.paperType });
  if (!fs.existsSync(artifacts.normalizedPath)) {
    throw new Error(`Normalized file not found: ${artifacts.normalizedPath}`);
  }

  const raw = fs.readFileSync(artifacts.normalizedPath, "utf-8").replace(/^\uFEFF/, "");
  const rows = JSON.parse(raw) as DebugRow[];
  const html = renderHtml(rows);
  const outputPath = path.join(artifacts.rootDir, "debug.html");
  fs.writeFileSync(outputPath, html);
  console.log(`Debug HTML written to ${outputPath}`);
}

main();
