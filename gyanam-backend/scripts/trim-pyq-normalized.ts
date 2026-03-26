import fs from "node:fs";
import { getPaperArtifacts, getPaperScopeOrThrow, parsePyqCliArgs } from "./pyq-paths.js";

type NormalizedRow = {
  id: string;
};

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  return JSON.parse(cleaned) as T;
}

function extractQuestionNumber(id: string) {
  const match = id.match(/_Q(\d+)$/);
  return match ? Number(match[1]) : null;
}

function main() {
  const args = parsePyqCliArgs();
  const scope = getPaperScopeOrThrow(args);
  const artifacts = getPaperArtifacts(scope);

  if (!fs.existsSync(artifacts.normalizedPath)) {
    throw new Error(`Normalized file not found: ${artifacts.normalizedPath}`);
  }

  const rows = readJson<NormalizedRow[]>(artifacts.normalizedPath);
  const trimmed = rows
    .filter((row) => {
      const num = extractQuestionNumber(row.id);
      return num !== null && num <= 100;
    })
    .sort((a, b) => (extractQuestionNumber(a.id) ?? 0) - (extractQuestionNumber(b.id) ?? 0));

  fs.writeFileSync(artifacts.normalizedPath, JSON.stringify(trimmed, null, 2));
  console.log(`Trimmed to ${trimmed.length} rows for ${scope.year} ${scope.paperType}`);
}

main();
