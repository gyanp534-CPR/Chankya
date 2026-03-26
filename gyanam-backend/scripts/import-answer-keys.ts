import fs from "node:fs";
import path from "node:path";
import {
  ensureParentDir,
  parsePyqCliArgs,
  getPaperArtifacts,
  listPaperScopes,
} from "./pyq-paths.js";

type PaperType = "GS1" | "CSAT";

type AnswerReferenceRow = {
  referenceAnswer?: string | null;
  source?: string;
  sourceType?: "official" | "coaching" | "manual";
  publishedAt?: string;
  notes?: string;
};

const REFERENCE_ROOT = path.resolve(process.cwd(), "docs", "pyq-questions");

const RANGE_HEADER = /^\s*\d{1,3}\s*[-–—]\s*\d{1,3}\s*$/;
const ANSWER_LINE = /^\s*(\d{1,3})\s*[-:.)]\s*([A-Da-d])\b/;

function resolveAnswerKeyPath(year: number, paperType: PaperType) {
  const paperDir = paperType.toLowerCase();
  const fileName = `${paperType}-${year}-answers.txt`;
  return path.join(REFERENCE_ROOT, paperDir, "answer-keys", fileName);
}

function parseAnswerKey(raw: string) {
  const lines = raw.split(/\r?\n/);
  const answers = new Map<number, string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.replace(/[–—]/g, "-");
    if (RANGE_HEADER.test(normalized)) {
      continue;
    }

    const match = normalized.match(ANSWER_LINE);
    if (!match) {
      continue;
    }

    const number = Number(match[1]);
    if (!Number.isInteger(number)) {
      continue;
    }

    const answer = match[2]?.toUpperCase();
    if (!answer) {
      continue;
    }

    answers.set(number, answer);
  }

  return answers;
}

function writeAnswerReference(
  year: number,
  paperType: PaperType,
  answers: Map<number, string>,
  sourceFile: string,
) {
  const artifacts = getPaperArtifacts({ year, paperType });
  const payload: Record<string, AnswerReferenceRow> = {};

  for (const [questionNumber, answer] of answers.entries()) {
    const id = `UPSC_${year}_${paperType}_Q${questionNumber}`;
    payload[id] = {
      referenceAnswer: answer,
      source: "manual-answer-key",
      sourceType: "official",
      publishedAt: "",
      notes: `imported from ${path.basename(sourceFile)}`,
    };
  }

  ensureParentDir(artifacts.answerReferencesPath);
  fs.writeFileSync(artifacts.answerReferencesPath, JSON.stringify(payload, null, 2));
  return artifacts.answerReferencesPath;
}

function inferScopes(args: ReturnType<typeof parsePyqCliArgs>): Array<{ year: number; paperType: PaperType }> {
  if (args.year && args.paperType) {
    return [{ year: args.year, paperType: args.paperType }];
  }

  if (args.paperType) {
    return listPaperScopes().filter((scope) => scope.paperType === args.paperType);
  }

  return listPaperScopes();
}

function expectedCount(paperType: PaperType) {
  return paperType === "GS1" ? 100 : 80;
}

function main() {
  const args = parsePyqCliArgs();
  const scopes = inferScopes(args);

  if (scopes.length === 0) {
    throw new Error("No paper scopes found to import answer keys.");
  }

  for (const scope of scopes) {
    const answerKeyPath = resolveAnswerKeyPath(scope.year, scope.paperType);
    if (!fs.existsSync(answerKeyPath)) {
      console.warn(`Missing answer key: ${answerKeyPath}`);
      continue;
    }

    const raw = fs.readFileSync(answerKeyPath, "utf-8");
    const answers = parseAnswerKey(raw);
    const outputPath = writeAnswerReference(
      scope.year,
      scope.paperType,
      answers,
      answerKeyPath,
    );

    const expected = expectedCount(scope.paperType);
    if (answers.size !== expected) {
      console.warn(
        `⚠ ${scope.year} ${scope.paperType}: parsed ${answers.size} answers (expected ${expected}).`,
      );
    }

    console.log(
      `Imported ${answers.size} answers for ${scope.year} ${scope.paperType} -> ${path.relative(process.cwd(), outputPath)}`,
    );
  }
}

main();
