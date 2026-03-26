// fetch-upsc-answer-key.ts
// Automated pipeline:
// 1. Try scraping 3 coaching sites and use majority vote
// 2. Fall back to hardcoded known answers
// 3. Flag low-confidence answers for manual review
import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";
import type { NormalizedPyqRecord } from "./pyq-review-utils.js";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveAnswerKeyCachePath,
  resolveAnswerReferencesPath,
  resolveNormalizedPath,
} from "./pyq-paths.js";

const PYQ_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");
const REFERENCES_FILE = path.resolve(process.cwd(), "data/pyq/pyq.answer-reference.v1.json");
const CACHE_DIR = path.resolve(process.cwd(), "data/answer-key-cache");

type PaperType = "GS1" | "CSAT";
type Answer = "A" | "B" | "C" | "D" | "dropped";
type AnswerMap = Map<number, Answer>;

type ReferenceMapValue = {
  referenceAnswer?: "A" | "B" | "C" | "D" | null;
  source?: string;
  sourceType?: "official" | "coaching";
  confidence?: "high" | "medium" | "low";
  publishedAt?: string;
  notes?: string;
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Coaching site sources per year/paper ─────────────────────────────────
// Add new year URLs here each year — usually published same day as exam
const SOURCES: Record<number, Record<string, string[]>> = {
  2024: {
    GS1: [
      "https://www.drishtiias.com/upsc-prelims-2024-answer-key",
      "https://www.iasbaba.com/2024/06/upsc-cse-prelims-2024-gs-paper-1-answer-key/",
      "https://www.visionias.in/resources/upsc-prelims-2024-answer-key",
    ],
    CSAT: [
      "https://www.drishtiias.com/upsc-prelims-2024-csat-answer-key",
      "https://www.iasbaba.com/2024/06/upsc-cse-prelims-2024-csat-answer-key/",
    ],
  },
  2023: {
    GS1: [
      "https://www.drishtiias.com/upsc-prelims-2023-answer-key",
      "https://www.iasbaba.com/2023/05/upsc-cse-prelims-2023-gs-paper-1-answer-key/",
      "https://www.visionias.in/resources/upsc-prelims-2023-answer-key",
    ],
    CSAT: [
      "https://www.drishtiias.com/upsc-prelims-2023-csat-answer-key",
      "https://www.iasbaba.com/2023/05/upsc-cse-prelims-2023-csat-paper-2-answer-key/",
    ],
  },
  2022: {
    GS1: [
      "https://www.drishtiias.com/upsc-prelims-2022-answer-key",
      "https://www.iasbaba.com/2022/06/upsc-cse-prelims-2022-gs-paper-1-answer-key/",
    ],
    CSAT: ["https://www.drishtiias.com/upsc-prelims-2022-csat-answer-key"],
  },
  2021: {
    GS1: ["https://www.drishtiias.com/upsc-prelims-2021-answer-key"],
    CSAT: ["https://www.drishtiias.com/upsc-prelims-2021-csat-answer-key"],
  },
  2020: {
    GS1: ["https://www.drishtiias.com/upsc-prelims-2020-answer-key"],
    CSAT: ["https://www.drishtiias.com/upsc-prelims-2020-csat-answer-key"],
  },
  2019: {
    GS1: ["https://www.drishtiias.com/upsc-prelims-2019-answer-key"],
    CSAT: ["https://www.drishtiias.com/upsc-prelims-2019-csat-answer-key"],
  },
};

// ─── Hardcoded fallback (manually verified from official PDFs) ────────────
const HARDCODED: Record<number, Record<string, Record<number, string>>> = {
  2023: {
    GS1: {
      1:"A",2:"B",3:"B",4:"A",5:"D",6:"D",7:"C",8:"A",9:"D",10:"D",
      11:"C",12:"C",13:"A",14:"A",15:"C",16:"D",17:"B",18:"C",19:"B",20:"C",
      21:"D",22:"A",23:"B",24:"A",25:"B",26:"B",27:"C",28:"C",29:"B",30:"C",
      31:"A",32:"A",33:"C",34:"dropped",35:"A",36:"D",37:"B",38:"B",39:"B",40:"C",
      41:"A",42:"B",43:"B",44:"D",45:"D",46:"B",47:"B",48:"A",49:"C",50:"D",
      51:"B",52:"C",53:"A",54:"C",55:"B",56:"A",57:"D",58:"D",59:"B",60:"C",
      61:"A",62:"C",63:"D",64:"D",65:"C",66:"D",67:"A",68:"C",69:"A",70:"A",
      71:"B",72:"C",73:"D",74:"B",75:"B",76:"C",77:"B",78:"D",79:"C",80:"A",
      81:"A",82:"B",83:"A",84:"D",85:"C",86:"C",87:"C",88:"D",89:"A",90:"D",
      91:"B",92:"B",93:"D",94:"C",95:"B",96:"B",97:"D",98:"D",99:"C",100:"C"
    }
  }
};

// ─── Args ──────────────────────────────────────────────────────────────────
function readPyqRows(pyqFile: string): NormalizedPyqRecord[] {
  return JSON.parse(fs.readFileSync(pyqFile, "utf-8")) as NormalizedPyqRecord[];
}
function readReferenceMap(referencesFile: string): Record<string, ReferenceMapValue> {
  if (!fs.existsSync(referencesFile)) return {};
  return JSON.parse(fs.readFileSync(referencesFile, "utf-8")) as Record<string, ReferenceMapValue>;
}
function writeReferenceMap(referencesFile: string, data: Record<string, ReferenceMapValue>) {
  ensureParentDir(referencesFile);
  fs.writeFileSync(referencesFile, JSON.stringify(data, null, 2));
}

// ─── Cache helpers ─────────────────────────────────────────────────────────
function getCachePath(year: number, paperType: string, scoped: boolean) {
  return scoped
    ? resolveAnswerKeyCachePath({ year, paperType: paperType as PaperType })
    : path.join(CACHE_DIR, `${year}_${paperType}_answers.json`);
}
function loadCache(year: number, paperType: string, scoped: boolean): Record<number, string> | null {
  const p = getCachePath(year, paperType, scoped);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function saveCache(year: number, paperType: string, data: Record<number, string>, scoped: boolean) {
  const cachePath = getCachePath(year, paperType, scoped);
  ensureParentDir(cachePath);
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}

// ─── Parse answers from page text ─────────────────────────────────────────
function parseAnswersFromText(text: string): AnswerMap {
  const pairs = new Map<number, Answer>();
  const upper = text.toUpperCase().replace(/\s+/g, " ");

  // Pattern: number followed by A/B/C/D (handles "1. A", "1) A", "1 - A", "Q1 A")
  const regex = /\b(\d{1,3})\s*[.):\-–]?\s*([ABCD])\b/g;
  let m;
  while ((m = regex.exec(upper)) !== null) {
    const q = Number(m[1]);
    if (q >= 1 && q <= 100 && !pairs.has(q)) {
      pairs.set(q, m[2] as Answer);
    }
  }
  return pairs;
}

// ─── Scrape a single URL ───────────────────────────────────────────────────
async function scrapeSource(url: string): Promise<{ map: AnswerMap; count: number }> {
  try {
    const { data: html } = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 20000,
    });
    const $ = cheerio.load(html);
    $("nav,footer,header,script,style,.ads,.sidebar,.comments").remove();
    const text = $("body").text();
    const map = parseAnswersFromText(text);
    return { map, count: map.size };
  } catch (err: any) {
    console.warn(`    ⚠️  ${url.split("/").pop()}: ${err.message}`);
    return { map: new Map(), count: 0 };
  }
}

// ─── Majority vote across sources ─────────────────────────────────────────
function majorityVote(
  sources: { map: AnswerMap; url: string }[]
): {
  answers: AnswerMap;
  confidence: Map<number, "high" | "medium" | "low">;
  agreementLog: string[];
} {
  const answers = new Map<number, Answer>();
  const confidence = new Map<number, "high" | "medium" | "low">();
  const agreementLog: string[] = [];

  const validSources = sources.filter((s) => s.map.size >= 50);
  console.log(`\n  Voting across ${validSources.length} valid sources...`);

  for (let q = 1; q <= 100; q++) {
    const votes: Record<string, number> = {};
    for (const s of validSources) {
      const ans = s.map.get(q);
      if (ans) votes[ans] = (votes[ans] ?? 0) + 1;
    }

    if (Object.keys(votes).length === 0) continue;

    // Pick answer with most votes
    const best = Object.entries(votes).sort(([, a], [, b]) => b - a)[0];
    if (!best) {
      continue;
    }
    const [bestAns, bestCount] = best;
    const total = validSources.length;

    answers.set(q, bestAns as Answer);

    // Confidence based on agreement ratio
    if (bestCount === total && total >= 2) {
      confidence.set(q, "high");
    } else if (bestCount >= total / 2) {
      confidence.set(q, "medium");
      agreementLog.push(`Q${q}: ${JSON.stringify(votes)} → picked ${bestAns} (medium confidence)`);
    } else {
      confidence.set(q, "low");
      agreementLog.push(`Q${q}: ${JSON.stringify(votes)} → picked ${bestAns} ⚠️ LOW CONFIDENCE`);
    }
  }

  return { answers, confidence, agreementLog };
}

// ─── Main pipeline ─────────────────────────────────────────────────────────
async function fetchAnswerKey(
  year: number,
  paperType: PaperType,
  forceRefresh: boolean,
  scoped: boolean
): Promise<{
  answers: AnswerMap;
  confidence: Map<number, "high" | "medium" | "low">;
  source: string;
}> {
  // 1. Check cache (skip if --refresh flag)
  if (!forceRefresh) {
    const cached = loadCache(year, paperType, scoped);
    if (cached && Object.keys(cached).length >= 90) {
      console.log(`  📦 Cache hit: ${Object.keys(cached).length} answers`);
      const map = new Map(Object.entries(cached).map(([k, v]) => [Number(k), v as Answer]));
      const conf = new Map([...map.keys()].map((key) => [key, "high" as const]));
      return { answers: map, confidence: conf, source: "cache" };
    }
  }

  // 2. Check hardcoded fallback first
  const hardcoded = HARDCODED[year]?.[paperType];
  if (hardcoded && !forceRefresh) {
    console.log(`  📋 Using verified hardcoded answers for ${year} ${paperType}`);
    const map = new Map(Object.entries(hardcoded).map(([k, v]) => [Number(k), v as Answer]));
    const conf = new Map([...map.keys()].map(k => [k, "high" as const]));
    return { answers: map, confidence: conf, source: "official-pdf-verified" };
  }

  // 3. Scrape coaching sites
  const urls = SOURCES[year]?.[paperType] ?? [];
  if (urls.length === 0) {
    throw new Error(`No sources configured for ${year} ${paperType}. Add URLs to SOURCES.`);
  }
  const fallbackUrl = urls[0];
  if (!fallbackUrl) {
    throw new Error(`No usable source URL found for ${year} ${paperType}.`);
  }

  console.log(`\n  Scraping ${urls.length} sources for ${year} ${paperType}...`);
  const scraped: { map: AnswerMap; url: string }[] = [];

  for (const url of urls) {
    console.log(`  → ${url}`);
    const { map, count } = await scrapeSource(url);
    console.log(`    Got ${count} answers`);
    scraped.push({ map, url });
    await new Promise((r) => setTimeout(r, 1500)); // polite delay
  }

  // 4. Majority vote
  const { answers, confidence, agreementLog } = majorityVote(scraped);

  // Log disagreements
  if (agreementLog.length > 0) {
    console.log("\n  ⚠️  Disagreements between sources:");
    agreementLog.forEach((l) => console.log(`    ${l}`));
  }

  // 5. Cache result
  if (answers.size >= 50) {
    const obj = Object.fromEntries([...answers.entries()].map(([k, v]) => [k, v]));
    saveCache(year, paperType, obj as Record<number, string>, scoped);
    console.log(`  💾 Cached to ${getCachePath(year, paperType, scoped)}`);
  }

  const primaryUrl = scraped.find((s) => s.map.size >= 80)?.url ?? fallbackUrl;
  return { answers, confidence, source: primaryUrl };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = parsePyqCliArgs();
  const year = args.year ?? 2023;
  const paperType = args.paperType ?? "GS1";
  const forceRefresh = args.refresh;
  const scoped = Boolean(args.year && args.paperType);
  const pyqFile = scoped ? resolveNormalizedPath(args) : PYQ_FILE;
  const referencesFile = scoped ? resolveAnswerReferencesPath(args) : REFERENCES_FILE;

  const approvedRows = readPyqRows(pyqFile).filter(
    (row) => row.status === "approved" && row.year === year && row.paperType === paperType
  );
  if (approvedRows.length === 0) {
    throw new Error(`No approved rows for ${year} ${paperType}`);
  }

  console.log(`\nFetching answer key: ${year} ${paperType}${forceRefresh ? " (force refresh)" : ""}`);
  const { answers, confidence, source } = await fetchAnswerKey(year, paperType, forceRefresh, scoped);

  const referenceMap = readReferenceMap(referencesFile);
  let mapped = 0, dropped = 0, notFound = 0, lowConf = 0;

  for (const row of approvedRows) {
    const match = row.id.match(/_Q(\d+)$/);
    const qNo = Number(match?.[1] ?? 0);
    const ans = answers.get(qNo);
    const conf = confidence.get(qNo) ?? "low";

    if (ans === "dropped") {
      referenceMap[row.id] = {
        referenceAnswer: null,
        source,
        sourceType: "official",
        confidence: "high",
        notes: "dropped by UPSC",
      };
      dropped++;
    } else if (ans && /^[ABCD]$/.test(ans)) {
      referenceMap[row.id] = {
        referenceAnswer: ans as "A" | "B" | "C" | "D",
        source,
        sourceType: source === "official-pdf-verified" ? "official" : "coaching",
        confidence: conf,
        notes: conf === "low" ? "low confidence — verify manually" : "",
      };
      if (conf === "low") lowConf++;
      mapped++;
    } else {
      referenceMap[row.id] = {
        referenceAnswer: null,
        source,
        sourceType: "coaching",
        confidence: "low",
        notes: "not found in any source",
      };
      notFound++;
    }
  }

  writeReferenceMap(referencesFile, referenceMap);

  console.log("\n" + JSON.stringify({
    year,
    paperType,
    pyqFile,
    referencesFile,
    source,
    extractedPairs: answers.size,
    mapped,
    dropped,
    notFound,
    lowConfidence: lowConf,
    approvedRows: approvedRows.length,
  }, null, 2));

  if (lowConf > 0) {
    console.log(`\n⚠️  ${lowConf} answers have low confidence. Run with --refresh to re-scrape.`);
  }
  if (answers.size < 90 && !HARDCODED[year]?.[paperType]) {
    console.log(`\n💡 Tip: Upload the official PDF to Claude chat to get verified answers, then add to HARDCODED.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
