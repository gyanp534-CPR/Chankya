import fs from "node:fs";
import path from "node:path";
import { getPaperArtifacts, listPaperScopes } from "./pyq-paths.js";
import type { PaperType } from "./pyq-review-utils.js";

type MetadataRecord = {
  id: string;
  year: number | null;
  paperType: PaperType;
  subject?: string;
  topic?: string | null;
  conceptTags?: string[];
};

type EnrichmentRecord = {
  id: string;
  subject?: string;
  subjectSuggestion?: string;
};

const METADATA_PATH = path.resolve(process.cwd(), "data", "pyq", "pyq.metadata.v1.json");
const ENRICHMENT_PATH = path.resolve(process.cwd(), "data", "pyq", "pyq.enrichment.v1.json");

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  return JSON.parse(cleaned) as T;
}

function buildSubjectMap(enrichment: EnrichmentRecord[] | null) {
  const subjectMap = new Map<string, string>();
  if (!enrichment) {
    return subjectMap;
  }
  for (const row of enrichment) {
    const subject = row.subject ?? row.subjectSuggestion;
    if (subject) {
      subjectMap.set(row.id, subject);
    }
  }
  return subjectMap;
}

function main() {
  const enrichment = readJsonFile<EnrichmentRecord[]>(ENRICHMENT_PATH);
  const subjectMap = buildSubjectMap(enrichment);
  const existing = readJsonFile<MetadataRecord[]>(METADATA_PATH) ?? [];
  const existingById = new Map(existing.map((row) => [row.id, row]));

  const scopes = listPaperScopes();
  const nextRows: MetadataRecord[] = [];

  for (const scope of scopes) {
    const artifacts = getPaperArtifacts(scope);
    if (!fs.existsSync(artifacts.normalizedPath)) {
      continue;
    }

    const normalized = readJsonFile<Array<{
      id: string;
      year: number | null;
      paperType: PaperType;
    }>>(artifacts.normalizedPath) ?? [];

    for (const row of normalized) {
      const existingRow = existingById.get(row.id);
      const subject = existingRow?.subject ?? subjectMap.get(row.id);
      nextRows.push({
        id: row.id,
        year: row.year ?? scope.year,
        paperType: row.paperType ?? scope.paperType,
        subject,
        topic: existingRow?.topic ?? null,
        conceptTags: existingRow?.conceptTags ?? [],
      });
    }
  }

  const deduped = new Map(nextRows.map((row) => [row.id, row]));
  const output = Array.from(deduped.values()).sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(METADATA_PATH, JSON.stringify(output, null, 2));
  console.log(`Metadata rows: ${output.length}`);
}

main();
