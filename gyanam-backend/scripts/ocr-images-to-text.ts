import fs from "node:fs";
import path from "node:path";
import { createWorker, PSM } from "tesseract.js";
import { getPaperArtifacts, parsePyqCliArgs } from "./pyq-paths.js";

const IMAGE_FILE_REGEX = /^page-(\d+)\.clean\.png$/i;

function getArg(args: string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function listCleanImages(
  imageDir: string,
  options: { from?: number; to?: number; oddOnly?: boolean },
) {
  if (!fs.existsSync(imageDir)) {
    throw new Error(`OCR cleaned directory not found: ${imageDir}`);
  }
  return fs
    .readdirSync(imageDir)
    .filter((name) => IMAGE_FILE_REGEX.test(name))
    .map((name) => ({
      name,
      index: Number(name.match(IMAGE_FILE_REGEX)?.[1] ?? "0"),
      fullPath: path.join(imageDir, name),
    }))
    .filter((entry) => (options.from ? entry.index >= options.from : true))
    .filter((entry) => (options.to ? entry.index <= options.to : true))
    .filter((entry) => (options.oddOnly ? entry.index % 2 === 1 : true))
    .sort((left, right) => left.index - right.index);
}

async function ocrImages(
  imageDir: string,
  outputPath: string,
  options: { from?: number; to?: number; oddOnly?: boolean },
) {
  const images = listCleanImages(imageDir, options);
  if (images.length === 0) {
    throw new Error(`No cleaned images found in ${imageDir}`);
  }

  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: String(PSM.SINGLE_COLUMN),
    preserve_interword_spaces: "1",
  });

  const chunks: string[] = [];
  for (const image of images) {
    const result = await worker.recognize(image.fullPath);
    const text = result.data.text.trim();
    chunks.push(`-- OCR image ${image.name} --`);
    chunks.push(text);
    chunks.push("");
  }

  await worker.terminate();
  fs.writeFileSync(outputPath, `${chunks.join("\n").trim()}\n`, "utf-8");
}

async function main() {
  const args = parsePyqCliArgs();
  if (!args.year || !args.paperType) {
    throw new Error("Usage: node scripts/ocr-images-to-text.ts --year <YYYY> --paper <GS1|CSAT>");
  }

  const cliArgs = process.argv.slice(2);
  const fromArg = getArg(cliArgs, "--from");
  const toArg = getArg(cliArgs, "--to");
  const oddOnly = cliArgs.includes("--odd");
  const from = fromArg ? Number(fromArg) : undefined;
  const to = toArg ? Number(toArg) : undefined;
  const options = {
    from: Number.isInteger(from) ? from : undefined,
    to: Number.isInteger(to) ? to : undefined,
    oddOnly,
  };

  const artifacts = getPaperArtifacts({ year: args.year, paperType: args.paperType });
  const imageDir = path.join(artifacts.rawDir, "ocr-cleaned");
  await ocrImages(imageDir, artifacts.questionTextPath, options);
  console.log(`Wrote OCR text to ${artifacts.questionTextPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
