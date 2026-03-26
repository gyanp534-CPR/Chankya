import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "node:fs";
import { parsePyqCliArgs, resolveNormalizedPath } from "./pyq-paths.js";

// Must run before PrismaClient is constructed
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL as string 
});

const prisma = new PrismaClient({ adapter });
// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type StagedNormalizedRow = {
  id           : string;
  year         : number | null;
  examStage    : string;
  paperType    : string;
  sourceFile   : string;
  questionText : string;
  options      : string[];
  status       : "pending_review" | "approved" | "rejected";
  reviewNotes  : string;
  subject     ?: string;
  correctAnswer?: string;
  answerStatus ?: string;
  answerSource ?: string;
};

type ApprovedIngestRow = {
  id           : string;
  year         : number;
  examStage    : string;
  subject      : string;
  questionText : string;
  options      : string[];
  correctAnswer: string;
  answerStatus ?: string;
  answerSource ?: string;
};

// ─────────────────────────────────────────────────────────────
// BUG FIX 1 — Subject inference instead of hard throw
// Many approved rows in your dataset have no subject field.
// Throwing here means the entire ingestion fails on the first
// missing subject. Instead: infer from keywords, warn, continue.
// ─────────────────────────────────────────────────────────────

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  "History"          : ["revolt", "dynasty", "british", "mughal", "colonial", "ancient", "medieval",
                        "sangam", "stupa", "vijayanagara", "charter act", "regulating act", "constituent assembly"],
  "Geography"        : ["river", "lake", "mountain", "monsoon", "coast", "port", "soil",
                        "climate", "earthquake", "delta", "plateau", "latitude", "rainfall"],
  "Polity"           : ["constitution", "parliament", "fundamental rights", "president", "governor",
                        "article", "amendment", "schedule", "lok sabha", "rajya sabha", "election commission"],
  "Economy"          : ["gdp", "rbi", "inflation", "budget", "tax", "gst", "bank", "capital market",
                        "trade", "fiscal", "monetary", "investment", "msme", "shg"],
  "Environment"      : ["wildlife", "species", "forest", "biodiversity", "pollution", "climate change",
                        "carbon", "ecosystem", "wetland", "conservation", "iucn"],
  "Science & Technology": ["satellite", "missile", "nuclear", "dna", "biotechnology", "space",
                           "isro", "accelerometer", "sensor", "genome", "vaccine"],
  "Current Affairs"  : ["g-20", "g20", "united nations", "who", "recently", "coup", "summit",
                        "chess olympiad", "sports award", "khel ratna"],
};

function inferSubject(questionText: string): string | null {
  const lower = questionText.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    scores[subject] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] <= 0) {
    return null;
  }

  return best[0];
}

// ─────────────────────────────────────────────────────────────
// BUG FIX 2 & 3 — Skip unresolved answers instead of throwing
// Approved rows with answerStatus "pending" have no correctAnswer.
// The script throws on missing correctAnswer first (BUG 2), then
// throws again on answerStatus "pending" (BUG 3).
// Fix: skip these rows gracefully, log them for later resolution.
// ─────────────────────────────────────────────────────────────

type SkipReason = "missing_year" | "missing_subject" | "missing_answer" | "unresolved_answer" | "dropped";

const EXPECTED_GS1_COUNT = 100;
const GS1_ALLOWED_COUNTS_BY_YEAR: Record<number, number> = {
  2023: 100,
};
const GS1_MIN_ACCEPTABLE = 95;
const GS1_MAX_ACCEPTABLE = 105;

function validateGs1Counts(rows: StagedNormalizedRow[]) {
  const counts = new Map<number, number>();

  for (const row of rows) {
    if (row.paperType?.toUpperCase() !== "GS1") {
      continue;
    }
    if (!row.year) {
      continue;
    }
    counts.set(row.year, (counts.get(row.year) ?? 0) + 1);
  }

  const failures: Array<{ year: number; count: number }> = [];

  for (const [year, count] of counts.entries()) {
    const expected = GS1_ALLOWED_COUNTS_BY_YEAR[year] ?? EXPECTED_GS1_COUNT;
    if (count !== expected) {
      console.warn(`⚠️  GS1 ${year} count=${count} (expected ${expected})`);
    }
    if (count < GS1_MIN_ACCEPTABLE || count > GS1_MAX_ACCEPTABLE) {
      failures.push({ year, count });
    }
  }

  if (failures.length > 0) {
    const detail = failures.map((entry) => `${entry.year}=${entry.count}`).join(", ");
    throw new Error(`GS1 count validation failed: ${detail}`);
  }
}

function getApprovedRows(rows: StagedNormalizedRow[]): {
  ingestable : ApprovedIngestRow[];
  skipped    : Array<{ id: string; reason: SkipReason; detail: string }>;
} {
  const approved = rows.filter((r) => r.status === "approved");
  const ingestable: ApprovedIngestRow[] = [];
  const skipped: Array<{ id: string; reason: SkipReason; detail: string }> = [];

  for (const row of approved) {
    // Skip dropped questions
    if (row.answerStatus === "dropped") {
      skipped.push({ id: row.id, reason: "dropped", detail: "answerStatus=dropped" });
      continue;
    }

    // BUG FIX 1 — missing year
    if (row.year === null || row.year === undefined) {
      skipped.push({ id: row.id, reason: "missing_year", detail: "year is null" });
      continue;
    }

    // BUG FIX 1 — missing subject: infer instead of throw
    let subject = row.subject?.trim();
    if (!subject) {
      const inferred = inferSubject(row.questionText);
      if (inferred) {
        subject = inferred;
        console.warn(`  ⚠ Subject inferred for ${row.id}: "${inferred}"`);
      } else {
        skipped.push({ id: row.id, reason: "missing_subject", detail: "subject missing and could not be inferred" });
        continue;
      }
    }

    // BUG FIX 2 & 3 — missing or unresolved answer: skip, don't throw
    if (!row.correctAnswer) {
      skipped.push({ id: row.id, reason: "missing_answer", detail: `answerStatus=${row.answerStatus ?? "none"}` });
      continue;
    }

    if (row.answerStatus === "pending" || row.answerStatus === "conflict") {
      skipped.push({ id: row.id, reason: "unresolved_answer", detail: `answerStatus=${row.answerStatus}` });
      continue;
    }

    ingestable.push({
      id           : row.id,
      year         : row.year,
      examStage    : row.examStage,
      subject,
      questionText : row.questionText,
      options      : row.options,
      correctAnswer: row.correctAnswer,
      answerStatus : row.answerStatus,
      answerSource : row.answerSource,
    });
  }

  return { ingestable, skipped };
}

// ─────────────────────────────────────────────────────────────
// BUG FIX 4 — inserted vs updated counter was wrong
// prisma.upsert() always returns the record — you can't tell
// if it was created or updated from the return value alone.
// Fix: check existence before upsert to track correctly.
// ─────────────────────────────────────────────────────────────

function answerToIndex(answer: string): number {
  const index = answer.trim().toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  if (index < 0 || index > 3) {
    throw new Error(`Invalid answer option: "${answer}"`);
  }
  return index;
}

const PYQ_TOPIC_NAME = "PYQ Ingested";

async function getOrCreateSubject(name: string, cache: Map<string, string>): Promise<string> {
  if (cache.has(name)) return cache.get(name)!;

  const existing = await prisma.subject.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
  });

  if (existing) { cache.set(name, existing.id); return existing.id; }

  const maxOrder = await prisma.subject.aggregate({ _max: { order: true } });
  const created  = await prisma.subject.create({
    data: { name, order: (maxOrder._max.order ?? 0) + 1 },
  });

  cache.set(name, created.id);
  return created.id;
}

async function getOrCreateTopic(subjectId: string, cache: Map<string, string>): Promise<string> {
  const key = `${subjectId}:${PYQ_TOPIC_NAME}`;
  if (cache.has(key)) return cache.get(key)!;

  const existing = await prisma.topic.findFirst({
    where: { subjectId, name: PYQ_TOPIC_NAME, deletedAt: null },
  });

  if (existing) { cache.set(key, existing.id); return existing.id; }

  const created = await prisma.topic.create({
    data: { subjectId, name: PYQ_TOPIC_NAME, weight: 1 },
  });

  cache.set(key, created.id);
  return created.id;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  const args = parsePyqCliArgs();
  const inputFile = args.year && args.paperType
    ? resolveNormalizedPath(args)
    : resolve(__dirname, "../data/pyq/pyq.prelims.v1.json");
  const raw = fs.readFileSync(inputFile, "utf-8");
  const pyqRows = JSON.parse(raw.replace(/^\uFEFF/, "")) as StagedNormalizedRow[];
  validateGs1Counts(pyqRows);
  const { ingestable, skipped } = getApprovedRows(pyqRows);

  if (ingestable.length === 0) {
    console.error("❌ No rows ready for ingestion.");
    console.log("   Check that approved rows have correctAnswer and a resolved answerStatus.");
    process.exit(1);
  }

  const subjectCache = new Map<string, string>();
  const topicCache   = new Map<string, string>();

  // BUG FIX 4 — correct inserted/updated tracking
  let inserted = 0;
  let updated  = 0;
  let errors   = 0;

  console.log(`\n🚀 PYQ Ingestion Starting`);
  console.log(`   Source          : ${inputFile}`);
  console.log(`   Ready to ingest : ${ingestable.length}`);
  console.log(`   Skipped         : ${skipped.length}`);
  console.log("");

  for (const row of ingestable) {
    if (row.options.length !== 4) {
      console.warn(`  ⚠ Skipping ${row.id}: expected 4 options, got ${row.options.length}`);
      errors++;
      continue;
    }

    try {
      const subjectId = await getOrCreateSubject(row.subject, subjectCache);
      const topicId   = await getOrCreateTopic(subjectId, topicCache);

      // BUG FIX 4 — check existence before upsert
      const exists = await prisma.question.findUnique({ where: { id: row.id } });

      const payload = {
        topicId,
        year        : row.year,
        examStage   : row.examStage,
        source      : "pyq_ingest_v1",
        stem        : row.questionText,
        options     : row.options,
        correctIndex: answerToIndex(row.correctAnswer),
        difficulty  : "medium" as const,
        tags        : [
          "pyq",
          `year:${row.year}`,
          `subject:${row.subject}`,
          ...(row.answerStatus ? [`answer_status:${row.answerStatus}`] : []),
          ...(row.answerSource ? [`answer_source:${row.answerSource}`] : []),
        ],
      };

      await prisma.question.upsert({
        where : { id: row.id },
        create: { id: row.id, ...payload },
        update: payload,
      });

      if (exists) updated++; else inserted++;
    } catch (err) {
      console.error(`  ✗ Failed ${row.id}: ${(err as Error).message}`);
      errors++;
    }
  }

  // ── Summary ────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log("✅ PYQ Ingestion Complete");
  console.log("─".repeat(50));
  console.log(`  Inserted  : ${inserted}`);
  console.log(`  Updated   : ${updated}`);
  console.log(`  Errors    : ${errors}`);
  console.log(`  Skipped   : ${skipped.length}`);

  if (skipped.length > 0) {
    // Group skipped by reason
    const byReason: Record<string, string[]> = {};
    skipped.forEach(({ id, reason }) => {
      if (!byReason[reason]) byReason[reason] = [];
      byReason[reason].push(id);
    });

    console.log("\n  Skipped breakdown:");
    for (const [reason, ids] of Object.entries(byReason)) {
      console.log(`    ${reason.padEnd(20)} ${ids.length} questions`);
    }

    console.log("\n  Action required:");
    if (byReason["missing_answer"] || byReason["unresolved_answer"]) {
      console.log("  → Resolve answers in pyq.answer-reference.v1.json");
      console.log("    then re-run this script. These will be picked up automatically.");
    }
    if (byReason["missing_subject"]) {
      console.log("  → Add subject field to these rows in pyq.prelims.v1.json:");
      byReason["missing_subject"].forEach((id) => console.log(`    - ${id}`));
    }
  }

  console.log("─".repeat(50) + "\n");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
