import fs from "node:fs";
import path from "node:path";

type PyqRow = {
  id: string;
  year: number | null;
  examStage: string;
  paperType: string;
  subject?: string;
  questionText: string;
  options: string[];
  status: string;
};

const PYQ_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");
const OUTPUT_DIR = path.resolve(process.cwd(), "data/pyq/tagging");
const OUTPUT_JSON = path.resolve(OUTPUT_DIR, "seed-200.json");
const OUTPUT_CSV = path.resolve(OUTPUT_DIR, "seed-200.csv");
const OUTPUT_SUMMARY = path.resolve(OUTPUT_DIR, "seed-200-summary.json");
const OUTPUT_RULES = path.resolve(OUTPUT_DIR, "concept-naming-rules.txt");
const CONCEPT_SEED_FILE = path.resolve(OUTPUT_DIR, "concept-seed-v1.txt");

const SUBJECT_TARGETS: Record<string, number> = {
  Polity: 40,
  Economy: 40,
  Environment: 35,
  History: 30,
  Geography: 25,
  "Science & Technology": 15,
  "Current Affairs": 15,
};

const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i);
const YEAR_TARGET = 20;
const YEAR_MIN = 15;
const YEAR_MAX = 25;

const QUESTION_TYPE_RULES: Array<{ type: string; pattern: RegExp }> = [
  { type: "assertion_reason", pattern: /assertion\s*\(|assertion.*reason/i },
  { type: "match_the_following", pattern: /match (the )?following/i },
  { type: "statement_based", pattern: /consider the following statements/i },
  { type: "statement_correct", pattern: /which of the statements (given )?above/i },
  { type: "statement_correct", pattern: /which of the following statements/i },
  { type: "pair_match", pattern: /consider the following pairs/i },
  { type: "arrange_order", pattern: /correct chronological order|arrange/i },
  { type: "reasoning_passage", pattern: /read the following passage/i },
];

function inferQuestionType(text: string) {
  for (const rule of QUESTION_TYPE_RULES) {
    if (rule.pattern.test(text)) {
      return rule.type;
    }
  }
  if (/which of the following/i.test(text)) {
    return "mcq_standard";
  }
  return "mcq_standard";
}

function inferQuestionNature(text: string) {
  const lower = text.toLowerCase();
  if (/select the correct answer using the code/.test(lower)) {
    return "elimination";
  }
  if (/which of the following statements|consider the following statements/.test(lower)) {
    return "conceptual";
  }
  if (/which one of the following/.test(lower)) {
    return "factual";
  }
  return "conceptual";
}

function inferReasoningType(text: string) {
  const lower = text.toLowerCase();
  if (/corollary/.test(lower)) return "logical_corollary";
  if (/essential message|main message|main idea/.test(lower)) return "main_idea";
  if (/inference|most logical/.test(lower)) return "inference";
  if (/assumption/.test(lower)) return "assumption";
  if (/tone|attitude/.test(lower)) return "tone";
  if (/which of the following/.test(lower)) return "elimination";
  return "elimination";
}

function writeNamingRules() {
  const rules = [
    "Concept Naming Rules (Seed v1)",
    "- Use noun phrases (e.g., “Fiscal Federalism”, not “Finance Commission question”).",
    "- Keep concepts reusable across years; avoid overly narrow labels.",
    "- Prefer one canonical term; avoid synonyms (pick one and stick with it).",
    "- Keep 2–4 concepts per question (max 5 if truly needed).",
    "- Add a primary_concept when one is clearly dominant.",
    "- For RC questions: primary_concept should be the knowledge domain; use reasoning_type for skill.",
  ];
  fs.writeFileSync(OUTPUT_RULES, rules.join("\n"));
}

function readConceptSeed(): Map<string, string[]> {
  if (!fs.existsSync(CONCEPT_SEED_FILE)) {
    return new Map();
  }

  const lines = fs.readFileSync(CONCEPT_SEED_FILE, "utf-8").split(/\r?\n/);
  const map = new Map<string, string[]>();
  let current: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith("-")) {
      current = line;
      if (!map.has(current)) {
        map.set(current, []);
      }
      continue;
    }

    if (!current) continue;
    const concept = line.replace(/^-/, "").trim();
    if (!concept) continue;
    map.get(current)!.push(concept);
  }

  return map;
}

function suggestConcepts(row: PyqRow, conceptsBySubject: Map<string, string[]>) {
  const subject = row.subject?.trim();
  if (!subject) return [];
  const concepts = conceptsBySubject.get(subject) ?? [];
  if (concepts.length === 0) return [];

  const haystack = `${row.questionText} ${row.options.join(" ")}`.toLowerCase();
  const suggestions: string[] = [];

  for (const concept of concepts) {
    const phrase = concept.toLowerCase();
    const tokens = phrase.split(/\s+/).filter((token) => token.length > 4);
    const matched =
      haystack.includes(phrase) ||
      tokens.some((token) => haystack.includes(token));
    if (matched) {
      suggestions.push(concept);
    }
    if (suggestions.length >= 3) break;
  }

  return suggestions;
}

function inferDifficulty(text: string) {
  const lower = text.toLowerCase();
  if (/assertion.*reason|match (the )?following|consider the following statements/.test(lower)) {
    return "hard";
  }
  if (/which of the following/.test(lower)) {
    return "medium";
  }
  return "medium";
}

function inferStaticDynamic(text: string) {
  const lower = text.toLowerCase();
  if (
    /(recent|current|latest|summit|report|index|scheme|mission|year|202\d|2025|2024|2023)/.test(
      lower,
    )
  ) {
    return "dynamic";
  }
  return "static";
}

function readRows(): PyqRow[] {
  return JSON.parse(fs.readFileSync(PYQ_FILE, "utf-8")) as PyqRow[];
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickYear(
  subjectBuckets: Map<number, PyqRow[]>,
  yearCounts: Map<number, number>,
) {
  const available = YEARS.filter((year) => (subjectBuckets.get(year)?.length ?? 0) > 0);
  if (available.length === 0) {
    return null;
  }

  const candidates = available.filter((year) => (yearCounts.get(year) ?? 0) < YEAR_MAX);
  const pool = candidates.length > 0 ? candidates : available;

  const sorted = pool.sort((a, b) => {
    const countA = yearCounts.get(a) ?? 0;
    const countB = yearCounts.get(b) ?? 0;
    if (countA !== countB) return countA - countB;
    const remainingA = subjectBuckets.get(a)?.length ?? 0;
    const remainingB = subjectBuckets.get(b)?.length ?? 0;
    return remainingB - remainingA;
  });

  return sorted[0];
}

function buildSeed(rows: PyqRow[]) {
  const rng = makeRng(hashSeed("pyq-seed-200-v1"));
  const approved = rows.filter(
    (row) => row.status === "approved" && row.subject && row.year,
  );

  const buckets = new Map<string, Map<number, PyqRow[]>>();
  for (const subject of Object.keys(SUBJECT_TARGETS)) {
    buckets.set(subject, new Map());
    for (const year of YEARS) {
      buckets.get(subject)!.set(year, []);
    }
  }

  for (const row of approved) {
    const subject = row.subject?.trim();
    if (!subject || !buckets.has(subject) || !row.year) continue;
    buckets.get(subject)!.get(row.year)!.push(row);
  }

  for (const subjectBuckets of buckets.values()) {
    for (const year of YEARS) {
      const list = subjectBuckets.get(year)!;
      shuffle(list, rng);
    }
  }

  const yearCounts = new Map<number, number>();
  YEARS.forEach((year) => yearCounts.set(year, 0));
  const selected: PyqRow[] = [];

  for (const [subject, target] of Object.entries(SUBJECT_TARGETS)) {
    const subjectBuckets = buckets.get(subject)!;
    let picked = 0;

    while (picked < target) {
      const year = pickYear(subjectBuckets, yearCounts);
      if (year === null) {
        break;
      }

      const list = subjectBuckets.get(year)!;
      const row = list.pop();
      if (!row) {
        subjectBuckets.set(year, []);
        continue;
      }

      selected.push(row);
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      picked += 1;
    }
  }

  return { selected, yearCounts };
}

function toCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function writeOutputs(selected: PyqRow[], yearCounts: Map<number, number>) {
  ensureDir(OUTPUT_DIR);
  writeNamingRules();
  const conceptsBySubject = readConceptSeed();

  const sorted = selected.sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id.localeCompare(b.id));

  const csvHeader = [
    "questionId",
    "year",
    "subject",
    "questionType",
    "reasoning_type",
    "difficulty",
    "static_vs_dynamic",
    "suggested_difficulty",
    "suggested_static_vs_dynamic",
    "suggested_reasoning_type",
    "passage_id",
    "suggested_passage_id",
    "question_nature",
    "suggested_question_nature",
    "primary_concept",
    "concepts",
    "concept_suggestions",
    "questionText",
  ];

  const csvRows = [csvHeader.join(",")];

  for (const row of sorted) {
    const questionType = inferQuestionType(row.questionText);
    const suggestions = suggestConcepts(row, conceptsBySubject);
    const suggestedDifficulty = inferDifficulty(row.questionText);
    const suggestedStatic = inferStaticDynamic(row.questionText);
    const suggestedReasoning = inferReasoningType(row.questionText);
    const suggestedNature = inferQuestionNature(row.questionText);
    csvRows.push(
      [
        toCsvCell(row.id),
        toCsvCell(String(row.year ?? "")),
        toCsvCell(row.subject ?? ""),
        toCsvCell(questionType),
        toCsvCell(""),
        toCsvCell(""),
        toCsvCell(suggestedDifficulty),
        toCsvCell(suggestedStatic),
        toCsvCell(suggestedReasoning),
        toCsvCell(""),
        toCsvCell(""),
        toCsvCell(""),
        toCsvCell(suggestedNature),
        toCsvCell(""),
        toCsvCell(""),
        toCsvCell(suggestions.join("; ")),
        toCsvCell(row.questionText),
      ].join(","),
    );
  }

  fs.writeFileSync(OUTPUT_CSV, csvRows.join("\n"));
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(sorted, null, 2));

  const summary = {
    total: sorted.length,
    bySubject: Object.fromEntries(
      Object.keys(SUBJECT_TARGETS).map((subject) => [
        subject,
        sorted.filter((row) => row.subject === subject).length,
      ]),
    ),
    byYear: Object.fromEntries(
      YEARS.map((year) => [year, yearCounts.get(year) ?? 0]),
    ),
    yearTarget: { min: YEAR_MIN, target: YEAR_TARGET, max: YEAR_MAX },
  };

  fs.writeFileSync(OUTPUT_SUMMARY, JSON.stringify(summary, null, 2));

  const yearWarnings = YEARS.filter((year) => {
    const count = yearCounts.get(year) ?? 0;
    return count < YEAR_MIN || count > YEAR_MAX;
  });

  if (yearWarnings.length > 0) {
    console.warn(
      `⚠ Year distribution outside range (${YEAR_MIN}-${YEAR_MAX}): ${yearWarnings
        .map((year) => `${year}=${yearCounts.get(year) ?? 0}`)
        .join(", ")}`,
    );
  }
}

function main() {
  const rows = readRows();
  const { selected, yearCounts } = buildSeed(rows);
  writeOutputs(selected, yearCounts);
  console.log(`✅ Seed set created: ${selected.length} questions`);
  console.log(`→ ${OUTPUT_CSV}`);
  console.log(`→ ${OUTPUT_JSON}`);
  console.log(`→ ${OUTPUT_SUMMARY}`);
}

main();
