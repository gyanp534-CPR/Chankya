const fs = require("node:fs");
const path = require("node:path");

const inputPath = path.resolve(
  __dirname,
  "../docs/pyq-questions/gs1/ManualUpload2016.ts",
);
const txtOutputPath = path.resolve(
  __dirname,
  "../docs/pyq-questions/gs1/gs1-2016.txt",
);
const normalizedOutputPath = path.resolve(
  __dirname,
  "../data/pyq/papers/2016/gs1/normalized.json",
);

if (!fs.existsSync(inputPath)) {
  console.error(`Manual upload file not found: ${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf-8");
const lines = raw.split(/\r?\n/);

const questionStart = /^(\d{1,3})\.\s*(.*)$/;
const optionStart = /^\(([a-d])\)\s*(.*)$/i;
const promptLine = /^(Select the correct answer|Which of the statements given above|Which of the above statements|Choose the correct answer)/i;

const textReplacements = [
  [/[\u201C\u201D]/g, '"'],
  [/[\u2018\u2019]/g, "'"],
  [/[\u2010\u2011\u2012\u2013\u2014]/g, "-"],
  [/\u2026/g, "..."],
];

let currentNumber = null;
let questionLines = [];
let options = [];
let collectingOptions = false;

const records = [];

function normalizeText(value) {
  let result = value ?? "";
  for (const [pattern, replacement] of textReplacements) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

function formatQuestion(parts) {
  const cleaned = parts.map((part) => normalizeText(part)).filter(Boolean);
  if (cleaned.length <= 2) {
    return cleaned.join(" ").trim();
  }

  let promptIndex = cleaned.findIndex((line) => promptLine.test(line));
  if (promptIndex === -1) {
    promptIndex = cleaned.length;
  }

  const intro = [cleaned[0]];
  const body = cleaned.slice(1, promptIndex);
  const outro = cleaned.slice(promptIndex);
  const hasExplicitNumbering = body.some((line) => /^\d+\./.test(line));
  const headerLikeBodyLine =
    body.length > 1 && /:\s*$/.test(body[0]) && !/[.?!]$/.test(body[0]);

  const formattedBody = body.map((line, index) => {
    if (hasExplicitNumbering) {
      return line;
    }
    if (headerLikeBodyLine && index === 0) {
      return line;
    }
    if (body.length >= 2) {
      const number = headerLikeBodyLine ? index : index + 1;
      return `${number}. ${line}`;
    }
    return line;
  });

  return [...intro, ...formattedBody, ...outro].join(" ").trim();
}

function flush() {
  if (currentNumber === null) {
    return;
  }

  const questionText = formatQuestion(questionLines);
  const normalizedOptions = options.map((option) => normalizeText(option));

  while (normalizedOptions.length < 4) {
    normalizedOptions.push("[option missing]");
  }

  records.push({
    number: currentNumber,
    questionText,
    options: normalizedOptions.slice(0, 4),
  });

  currentNumber = null;
  questionLines = [];
  options = [];
  collectingOptions = false;
}

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) {
    continue;
  }

  const questionMatch = line.match(questionStart);
  if (questionMatch) {
    flush();
    currentNumber = Number(questionMatch[1]);
    const remainder = normalizeText(questionMatch[2] || "");
    if (remainder) {
      questionLines.push(remainder);
    }
    collectingOptions = false;
    continue;
  }

  const optionMatch = line.match(optionStart);
  if (optionMatch) {
    options.push(normalizeText(optionMatch[2] || ""));
    collectingOptions = true;
    continue;
  }

  if (collectingOptions && options.length > 0) {
    options[options.length - 1] = normalizeText(`${options[options.length - 1]} ${line}`);
    continue;
  }

  if (currentNumber !== null) {
    questionLines.push(normalizeText(line));
  }
}

flush();

const txtLines = [];
const normalizedRecords = [];

for (const record of records) {
  txtLines.push(`ID: UPSC_2016_GS1_Q${record.number}`);
  txtLines.push(`Q${record.number}. ${record.questionText}`);
  txtLines.push(`A) ${record.options[0]}`);
  txtLines.push(`B) ${record.options[1]}`);
  txtLines.push(`C) ${record.options[2]}`);
  txtLines.push(`D) ${record.options[3]}`);
  txtLines.push("");

  normalizedRecords.push({
    id: `UPSC_2016_GS1_Q${record.number}`,
    year: 2016,
    examStage: "prelims",
    paperType: "GS1",
    sourceFile: "ManualUpload2016.ts",
    questionText: record.questionText,
    options: record.options,
    status: "pending_review",
    reviewNotes: "manual-upload-cleaned",
    confidenceScore: 100,
    confidenceFlags: [],
  });
}

fs.writeFileSync(txtOutputPath, `${txtLines.join("\n").trim()}\n`);
fs.writeFileSync(normalizedOutputPath, `${JSON.stringify(normalizedRecords, null, 2)}\n`);

console.log(`Wrote ${records.length} questions to ${txtOutputPath}`);
console.log(`Wrote normalized JSON to ${normalizedOutputPath}`);
