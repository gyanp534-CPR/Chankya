import fs from "node:fs";
import path from "node:path";
import type { PaperType } from "./pyq-review-utils.js";

export type PyqCliOptions = {
  year?: number;
  paperType?: PaperType;
  all: boolean;
  refresh: boolean;
  noMerge: boolean;
  skipReference: boolean;
};

export type PaperScope = {
  year: number;
  paperType: PaperType;
};

export type PaperArtifactPaths = {
  scope: PaperScope;
  rootDir: string;
  rawDir: string;
  questionPdfPath: string;
  questionTextPath: string;
  normalizedPath: string;
  enrichmentPath: string;
  answerProposalsPath: string;
  answerReferencesPath: string;
  coachingManifestPath: string;
  coachingConsensusPath: string;
  answerKeyCachePath: string;
};

export const LEGACY_PATHS = {
  rawPdfDir: path.resolve(process.cwd(), "data/raw_pyq_pdf"),
  rawTextDir: path.resolve(process.cwd(), "data/raw_pyq_text"),
  normalizedPath: path.resolve(process.cwd(), "data/pyq/pyq.prelims.v1.json"),
  enrichmentPath: path.resolve(process.cwd(), "data/pyq/pyq.enrichment.v1.json"),
  answerProposalsPath: path.resolve(process.cwd(), "data/pyq/pyq.answer-proposals.v1.json"),
  answerReferencesPath: path.resolve(process.cwd(), "data/pyq/pyq.answer-reference.v1.json"),
  coachingManifestPath: path.resolve(process.cwd(), "data/pyq/coaching-answer-key-sources.v1.json"),
  coachingConsensusPath: path.resolve(process.cwd(), "data/pyq/coaching-answer-consensus.v1.json"),
  answerKeyCacheDir: path.resolve(process.cwd(), "data/answer-key-cache"),
} as const;

function parsePaperType(value: string | undefined): PaperType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "GS1" || normalized === "CSAT") {
    return normalized;
  }

  throw new Error(`Invalid paper type: ${value}. Expected GS1 or CSAT.`);
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parsePyqCliArgs(argv = process.argv.slice(2)): PyqCliOptions {
  const yearArg = getArg(argv, "--year");
  const year = yearArg ? Number(yearArg) : undefined;

  if (yearArg && !Number.isInteger(year)) {
    throw new Error(`Invalid year: ${yearArg}`);
  }

  return {
    year,
    paperType: parsePaperType(getArg(argv, "--paper")),
    all: argv.includes("--all"),
    refresh: argv.includes("--refresh"),
    noMerge: argv.includes("--no-merge"),
    skipReference: argv.includes("--skip-reference"),
  };
}

export function hasPaperScope(options: { year?: number; paperType?: PaperType }): options is PaperScope {
  return Number.isInteger(options.year) && Boolean(options.paperType);
}

export function getPaperScopeOrThrow(options: { year?: number; paperType?: PaperType }): PaperScope {
  if (!hasPaperScope(options)) {
    throw new Error("This command requires both --year <YYYY> and --paper <GS1|CSAT>.");
  }

  return {
    year: options.year,
    paperType: options.paperType,
  };
}

export function getPaperArtifacts(scope: PaperScope): PaperArtifactPaths {
  const paperSlug = scope.paperType.toLowerCase();
  const rootDir = path.resolve(process.cwd(), "data", "pyq", "papers", String(scope.year), paperSlug);
  const rawDir = path.join(rootDir, "raw");

  return {
    scope,
    rootDir,
    rawDir,
    questionPdfPath: path.join(rawDir, "question-paper.pdf"),
    questionTextPath: path.join(rawDir, "question-paper.txt"),
    normalizedPath: path.join(rootDir, "normalized.json"),
    enrichmentPath: path.join(rootDir, "enrichment.json"),
    answerProposalsPath: path.join(rootDir, "answer-proposals.json"),
    answerReferencesPath: path.join(rootDir, "answer-reference.json"),
    coachingManifestPath: path.join(rootDir, "coaching-answer-key-sources.json"),
    coachingConsensusPath: path.join(rootDir, "coaching-answer-consensus.json"),
    answerKeyCachePath: path.join(rootDir, "answer-key-cache.json"),
  };
}

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureParentDir(filePath: string) {
  ensureDir(path.dirname(filePath));
}

export function resolveNormalizedPath(options: { year?: number; paperType?: PaperType }): string {
  return hasPaperScope(options) ? getPaperArtifacts(options).normalizedPath : LEGACY_PATHS.normalizedPath;
}

export function resolveEnrichmentPath(options: { year?: number; paperType?: PaperType }): string {
  return hasPaperScope(options) ? getPaperArtifacts(options).enrichmentPath : LEGACY_PATHS.enrichmentPath;
}

export function resolveAnswerProposalsPath(options: { year?: number; paperType?: PaperType }): string {
  return hasPaperScope(options) ? getPaperArtifacts(options).answerProposalsPath : LEGACY_PATHS.answerProposalsPath;
}

export function resolveAnswerReferencesPath(options: { year?: number; paperType?: PaperType }): string {
  return hasPaperScope(options) ? getPaperArtifacts(options).answerReferencesPath : LEGACY_PATHS.answerReferencesPath;
}

export function resolveCoachingManifestPath(options: { year?: number; paperType?: PaperType }): string {
  if (hasPaperScope(options)) {
    const perPaper = getPaperArtifacts(options).coachingManifestPath;
    if (fs.existsSync(perPaper)) {
      return perPaper;
    }
  }

  return LEGACY_PATHS.coachingManifestPath;
}

export function resolveCoachingConsensusPath(options: { year?: number; paperType?: PaperType }): string {
  return hasPaperScope(options) ? getPaperArtifacts(options).coachingConsensusPath : LEGACY_PATHS.coachingConsensusPath;
}

export function resolveAnswerKeyCachePath(options: { year?: number; paperType?: PaperType }): string {
  if (hasPaperScope(options)) {
    return getPaperArtifacts(options).answerKeyCachePath;
  }

  return path.join(LEGACY_PATHS.answerKeyCacheDir, "default-answer-key-cache.json");
}

export function listPaperScopes(): PaperScope[] {
  const papersRoot = path.resolve(process.cwd(), "data", "pyq", "papers");
  if (!fs.existsSync(papersRoot)) {
    return [];
  }

  const scopes: PaperScope[] = [];
  for (const yearEntry of fs.readdirSync(papersRoot, { withFileTypes: true })) {
    if (!yearEntry.isDirectory()) {
      continue;
    }

    const year = Number(yearEntry.name);
    if (!Number.isInteger(year)) {
      continue;
    }

    const yearDir = path.join(papersRoot, yearEntry.name);
    for (const paperEntry of fs.readdirSync(yearDir, { withFileTypes: true })) {
      if (!paperEntry.isDirectory()) {
        continue;
      }

      const normalizedPaper = paperEntry.name.toUpperCase();
      if (normalizedPaper === "GS1" || normalizedPaper === "CSAT") {
        scopes.push({ year, paperType: normalizedPaper });
      }
    }
  }

  return scopes.sort((a, b) => a.year - b.year || a.paperType.localeCompare(b.paperType));
}
