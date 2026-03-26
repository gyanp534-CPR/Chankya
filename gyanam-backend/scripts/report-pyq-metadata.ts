import fs from "node:fs";
import path from "node:path";
import { getPaperArtifacts, listPaperScopes } from "./pyq-paths.js";
import type { PaperType } from "./pyq-review-utils.js";

type MetadataRecord = {
  id: string;
  subject?: string;
  topic?: string | null;
  conceptTags?: string[];
};

type NormalizedRow = {
  id: string;
  questionText: string;
  paperType: PaperType;
};

const METADATA_PATH = path.resolve(process.cwd(), "data", "pyq", "pyq.metadata.v1.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "data", "pyq", "pyq.metadata.analytics.v1.json");

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  return JSON.parse(cleaned) as T;
}

function classifyPattern(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("statement-i") || normalized.includes("statement-ii") || normalized.includes("statement 1")) {
    return "statement-based";
  }
  if (normalized.includes("assertion") && normalized.includes("reason")) {
    return "assertion-reason";
  }
  if (normalized.includes("match the following") || normalized.includes("pairs") || normalized.includes("correctly matched")) {
    return "matching";
  }
  if (normalized.includes("how many")) {
    return "how-many";
  }
  if (normalized.startsWith("which of the following") || normalized.includes("which one of the following")) {
    return "which-following";
  }
  if (normalized.startsWith("consider the following")) {
    return "consider-following";
  }
  return "other";
}

function readNormalizedRows(): NormalizedRow[] {
  const scopes = listPaperScopes();
  const rows: NormalizedRow[] = [];
  for (const scope of scopes) {
    const artifacts = getPaperArtifacts(scope);
    if (!fs.existsSync(artifacts.normalizedPath)) {
      continue;
    }
    const normalized = readJson<NormalizedRow[]>(artifacts.normalizedPath);
    rows.push(...normalized);
  }
  return rows;
}

function main() {
  if (!fs.existsSync(METADATA_PATH)) {
    throw new Error(`Metadata file not found: ${METADATA_PATH}`);
  }

  const metadata = readJson<MetadataRecord[]>(METADATA_PATH);
  const subjectCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const conceptCounts = new Map<string, number>();

  for (const row of metadata) {
    const subject = row.subject?.trim() || "Unassigned";
    subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);

    const topic = row.topic?.trim() || "Unassigned";
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);

    for (const concept of row.conceptTags ?? []) {
      conceptCounts.set(concept, (conceptCounts.get(concept) ?? 0) + 1);
    }
  }

  const patternCounts = new Map<string, number>();
  for (const row of readNormalizedRows()) {
    if (row.paperType !== "GS1") {
      continue;
    }
    const pattern = classifyPattern(row.questionText || "");
    patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
  }

  const toSortedArray = (counts: Map<string, number>, key: string) =>
    [...counts.entries()]
      .map(([label, count]) => ({ [key]: label, count }))
      .sort((a, b) => b.count - a.count || String(a[key]).localeCompare(String(b[key])));

  const output = {
    generatedAt: new Date().toISOString(),
    totals: {
      questions: metadata.length,
      subjects: subjectCounts.size,
      topics: topicCounts.size,
      concepts: conceptCounts.size,
    },
    subjectFrequency: toSortedArray(subjectCounts, "subject"),
    topicRecurrence: toSortedArray(topicCounts, "topic"),
    conceptFrequency: toSortedArray(conceptCounts, "concept"),
    questionPatterns: toSortedArray(patternCounts, "pattern"),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Analytics written to ${OUTPUT_PATH}`);
}

main();
