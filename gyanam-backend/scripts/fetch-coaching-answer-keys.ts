import axios from "axios";
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import type { NormalizedPyqRecord } from "./pyq-review-utils.js";
import {
  ensureParentDir,
  parsePyqCliArgs,
  resolveAnswerReferencesPath,
  resolveCoachingConsensusPath,
  resolveCoachingManifestPath,
  resolveNormalizedPath,
} from "./pyq-paths.js";

const PYQ_FILE = path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json");
const REFERENCES_FILE = path.resolve(process.cwd(), "data/pyq/pyq.answer-reference.v1.json");
const MANIFEST_FILE = path.resolve(process.cwd(), "data/pyq/coaching-answer-key-sources.v1.json");
const CONSENSUS_FILE = path.resolve(process.cwd(), "data/pyq/coaching-answer-consensus.v1.json");

type PaperType = "GS1" | "CSAT";
type AnswerOption = "A" | "B" | "C" | "D";
type SourceType = "html" | "pdf";

type CoachingSourceManifest = {
  source: string;
  year: number;
  paperType: PaperType;
  url: string;
  responseType?: SourceType;
};

type ReferenceMapValue =
  | AnswerOption
  | {
      referenceAnswer?: AnswerOption | null;
      source?: string;
      sourceType?: "coaching";
      publishedAt?: string;
      notes?: string;
    };

type ConsensusRecord = {
  id: string;
  answer: AnswerOption | null;
  votes: Record<string, AnswerOption>;
  agreementCount: number;
  totalSources: number;
  confidence: number;
  status: "provisional_correct" | "conflict" | "pending";
};

function readPyqRows(pyqFile: string): NormalizedPyqRecord[] {
  return JSON.parse(fs.readFileSync(pyqFile, "utf-8")) as NormalizedPyqRecord[];
}

function readReferenceMap(referencesFile: string): Record<string, ReferenceMapValue> {
  if (!fs.existsSync(referencesFile)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(referencesFile, "utf-8")) as Record<string, ReferenceMapValue>;
}

function writeReferenceMap(referencesFile: string, data: Record<string, ReferenceMapValue>) {
  ensureParentDir(referencesFile);
  fs.writeFileSync(referencesFile, JSON.stringify(data, null, 2));
}

function readManifest(manifestFile: string): CoachingSourceManifest[] {
  if (!fs.existsSync(manifestFile)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(manifestFile, "utf-8")) as CoachingSourceManifest[];
}

async function readPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy();
  return data.text;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractAnswerPairs(rawText: string) {
  const pairs = new Map<number, AnswerOption>();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const exact = line.match(/^(\d{1,3})\s+([ABCD])$/i);
    const exactQuestion = exact?.[1];
    const exactAnswer = exact?.[2];
    if (exactQuestion && exactAnswer) {
      pairs.set(Number(exactQuestion), exactAnswer.toUpperCase() as AnswerOption);
      continue;
    }

    const embedded = [...line.matchAll(/(?:^|\s)(\d{1,3})\s+([ABCD])(?=\s|$)/gi)];
    for (const match of embedded) {
      const embeddedQuestion = match[1];
      const embeddedAnswer = match[2];
      if (embeddedQuestion && embeddedAnswer) {
        pairs.set(Number(embeddedQuestion), embeddedAnswer.toUpperCase() as AnswerOption);
      }
    }
  }

  return pairs;
}

async function fetchSourceAnswers(source: CoachingSourceManifest) {
  const response = await axios.get<ArrayBuffer | string>(source.url, {
    responseType: source.responseType === "pdf" ? "arraybuffer" : "text",
  });

  let rawText = "";
  if (source.responseType === "pdf") {
    rawText = await readPdfText(Buffer.from(response.data as ArrayBuffer));
  } else {
    const $ = cheerio.load(String(response.data));
    rawText = $.text();
  }

  return extractAnswerPairs(rawText);
}

function buildConsensusRecord(
  id: string,
  votes: Record<string, AnswerOption>,
  totalSources: number,
): ConsensusRecord {
  const counts = new Map<AnswerOption, number>();
  Object.values(votes).forEach((answer) => {
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  });

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topAnswer, agreementCount] = ranked[0] ?? [null, 0];
  const secondCount = ranked[1]?.[1] ?? 0;
  const confidence = totalSources === 0 ? 0 : agreementCount / totalSources;

  return {
    id,
    answer: topAnswer,
    votes,
    agreementCount,
    totalSources,
    confidence,
    status:
      !topAnswer || agreementCount === 0
        ? "pending"
        : secondCount === agreementCount
          ? "conflict"
          : "provisional_correct",
  };
}

async function main() {
  const args = parsePyqCliArgs();
  const year = args.year ?? 2023;
  const paperType = args.paperType ?? "GS1";
  const pyqFile = args.year && args.paperType ? resolveNormalizedPath(args) : PYQ_FILE;
  const referencesFile = args.year && args.paperType ? resolveAnswerReferencesPath(args) : REFERENCES_FILE;
  const manifestFile = args.year && args.paperType ? resolveCoachingManifestPath(args) : MANIFEST_FILE;
  const consensusFile = args.year && args.paperType ? resolveCoachingConsensusPath(args) : CONSENSUS_FILE;

  const approvedRows = readPyqRows(pyqFile).filter(
    (row) => row.status === "approved" && row.year === year && row.paperType === paperType,
  );

  if (approvedRows.length === 0) {
    throw new Error(`No approved rows found for ${year} ${paperType}.`);
  }

  const manifest = readManifest(manifestFile).filter((entry) => entry.year === year && entry.paperType === paperType);
  if (manifest.length === 0) {
    throw new Error(`No coaching sources configured for ${year} ${paperType} in ${manifestFile}.`);
  }

  const sourceResults = await Promise.all(
    manifest.map(async (entry) => ({
      source: entry.source,
      url: entry.url,
      answers: await fetchSourceAnswers(entry),
    })),
  );

  const consensusRows = approvedRows.map((row) => {
    const questionNumber = Number(row.id.match(/_Q(\d+)$/)?.[1] ?? 0);
    const votes = Object.fromEntries(
      sourceResults
        .map((result) => [result.source, result.answers.get(questionNumber)] as const)
        .filter((entry): entry is [string, AnswerOption] => Boolean(entry[1])),
    );

    return buildConsensusRecord(row.id, votes, sourceResults.length);
  });

  ensureParentDir(consensusFile);
  fs.writeFileSync(consensusFile, JSON.stringify(consensusRows, null, 2));

  const referenceMap = readReferenceMap(referencesFile);
  let provisionalCorrect = 0;
  let conflicts = 0;

  for (const row of consensusRows) {
    if (row.status === "provisional_correct" && row.answer) {
      referenceMap[row.id] = {
        referenceAnswer: row.answer,
        source: `coaching_consensus:${Object.keys(row.votes).join(",")}`,
        sourceType: "coaching",
        publishedAt: "",
        notes: `consensus ${row.agreementCount}/${row.totalSources}`,
      };
      provisionalCorrect += 1;
      continue;
    }

    if (row.status === "conflict") {
      conflicts += 1;
    }
  }

  writeReferenceMap(referencesFile, referenceMap);

  console.log(
    JSON.stringify(
      {
        year,
        paperType,
        pyqFile,
        sources: sourceResults.length,
        provisionalCorrect,
        conflicts,
        pending: consensusRows.filter((row) => row.status === "pending").length,
        consensusFile,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
