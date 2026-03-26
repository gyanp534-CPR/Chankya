import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PDFParse } from "pdf-parse";
import pdfPoppler from "pdf-poppler";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import {
  ensureParentDir,
  getPaperArtifacts,
  listPaperScopes,
  parsePyqCliArgs,
} from "./pyq-paths.js";
import {
  PYQ_EXTRACTION_METHODS,
  type PyqExtractionMethodId,
} from "./pyq-extraction-methods.js";

const PDF_DIR = path.resolve(process.cwd(), "data/raw_pyq_pdf");
const TEXT_DIR = path.resolve(process.cwd(), "data/raw_pyq_text");
const TESSDATA_DIR = path.resolve(process.cwd(), "data", "tessdata");
const OCR_CLEAN_DIR_NAME = "ocr-cleaned";
const OCR_HIGH_DPI = 400;
const PYTHON_OCR_SCRIPT = path.resolve(process.cwd(), "scripts", "python", "ocr_pdf_to_text.py");

function hasUsefulText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 2000) {
    return false;
  }

  const alphaCount = (normalized.match(/[A-Za-z]/g) ?? []).length;
  return alphaCount >= 1000;
}

async function parsePDF(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy();
  return data.text;
}

async function preprocessOcrImage(inputPath: string, outputDir: string) {
  const baseName = path.basename(inputPath).replace(/\.png$/i, "");
  const outputPath = path.join(outputDir, `${baseName}.clean.png`);
  await sharp(inputPath)
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(180)
    .toFile(outputPath);
  return outputPath;
}

async function ocrPDF(filePath: string, outputDir: string) {
  if (!fs.existsSync(path.join(TESSDATA_DIR, "eng.traineddata.gz")) || !fs.existsSync(path.join(TESSDATA_DIR, "hin.traineddata.gz"))) {
    throw new Error(`OCR fallback requires eng/hin traineddata under ${TESSDATA_DIR}`);
  }

  const imageDir = path.join(outputDir, "ocr-pages");
  fs.mkdirSync(imageDir, { recursive: true });
  const cleanDir = path.join(outputDir, OCR_CLEAN_DIR_NAME);
  fs.mkdirSync(cleanDir, { recursive: true });

  const popplerOptions: Record<string, number | string | null> = {
    format: "png",
    out_dir: imageDir,
    out_prefix: "page",
    page: null,
  };
  if (getOcrHighQuality()) {
    popplerOptions.dpi = OCR_HIGH_DPI;
  }
  await pdfPoppler.convert(filePath, popplerOptions);

  const imageFiles = fs.readdirSync(imageDir)
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (imageFiles.length === 0) {
    throw new Error(`OCR fallback produced no page images for ${filePath}`);
  }

  const worker = await createWorker("eng+hin", 1, {
    langPath: TESSDATA_DIR,
    cacheMethod: "none",
  });

  await worker.setParameters({
    tessedit_pageseg_mode: getOcrFastMode()
      ? PSM.SPARSE_TEXT
      : getOcrHighQuality()
        ? PSM.SINGLE_COLUMN
        : PSM.AUTO,
    preserve_interword_spaces: "1",
    ...(getOcrHighQuality()
      ? {
          tessedit_ocr_engine_mode: "1",
          user_defined_dpi: String(OCR_HIGH_DPI),
        }
      : {}),
  });

  try {
    const pageTexts: string[] = [];
    const maxPages = getMaxPages();
    const filesToProcess = maxPages ? imageFiles.slice(0, maxPages) : imageFiles;
    for (const imageFile of filesToProcess) {
      const imagePath = path.join(imageDir, imageFile);
      let ocrSourcePath = imagePath;
      if (!getOcrSkipPreprocess()) {
        try {
          ocrSourcePath = await preprocessOcrImage(imagePath, cleanDir);
        } catch (error) {
          console.warn(`OCR preprocess failed for ${imageFile}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const metadata = await sharp(ocrSourcePath).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      if (!getOcrNoSplit() && width > 0 && height > 0) {
        const halfWidth = Math.floor(width / 2);
        const gutter = Math.max(10, Math.floor(width * 0.01));
        const leftWidth = Math.max(1, halfWidth - gutter);
        const rightLeft = Math.min(width - 1, halfWidth + gutter);
        const rightWidth = Math.max(1, width - rightLeft);
        const halfHeight = Math.floor(height / 2);
        const gutterHeight = Math.max(10, Math.floor(height * 0.01));
        const topHeight = Math.max(1, halfHeight - gutterHeight);
        const bottomTop = Math.min(height - 1, halfHeight + gutterHeight);
        const bottomHeight = Math.max(1, height - bottomTop);
        const leftPath = path.join(cleanDir, imageFile.replace(".png", ".left.clean.png"));
        const rightPath = path.join(cleanDir, imageFile.replace(".png", ".right.clean.png"));
        const topPath = path.join(cleanDir, imageFile.replace(".png", ".top.clean.png"));
        const bottomPath = path.join(cleanDir, imageFile.replace(".png", ".bottom.clean.png"));

        await sharp(ocrSourcePath)
          .extract({ left: 0, top: 0, width: leftWidth, height })
          .toFile(leftPath);
        await sharp(ocrSourcePath)
          .extract({ left: rightLeft, top: 0, width: rightWidth, height })
          .toFile(rightPath);
        await sharp(ocrSourcePath)
          .extract({ left: 0, top: 0, width, height: topHeight })
          .toFile(topPath);
        await sharp(ocrSourcePath)
          .extract({ left: 0, top: bottomTop, width, height: bottomHeight })
          .toFile(bottomPath);

        const left = await worker.recognize(leftPath);
        const right = await worker.recognize(rightPath);
        const top = await worker.recognize(topPath);
        const bottom = await worker.recognize(bottomPath);
        pageTexts.push(`\n-- OCR ${imageFile} left --\n${left.data.text}`);
        pageTexts.push(`\n-- OCR ${imageFile} right --\n${right.data.text}`);
        pageTexts.push(`\n-- OCR ${imageFile} top --\n${top.data.text}`);
        pageTexts.push(`\n-- OCR ${imageFile} bottom --\n${bottom.data.text}`);
        continue;
      }

      const result = await worker.recognize(ocrSourcePath);
      pageTexts.push(`\n-- OCR ${imageFile} --\n${result.data.text}`);
    }

    return pageTexts.join("\n");
  } finally {
    await worker.terminate();
  }
}

function resolvePythonBinary() {
  const venv = process.env.VIRTUAL_ENV;
  if (venv) {
    const candidate = path.join(venv, "Scripts", "python.exe");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const localVenv = path.resolve(process.cwd(), ".venv", "Scripts", "python.exe");
  if (fs.existsSync(localVenv)) {
    return localVenv;
  }

  return "python";
}

function ocrPDFWithPython(filePath: string, outputDir: string) {
  if (!fs.existsSync(PYTHON_OCR_SCRIPT)) {
    throw new Error(`Python OCR script not found: ${PYTHON_OCR_SCRIPT}`);
  }

  const outputPath = path.join(outputDir, "question-paper.txt");
  const dpi = getOcrHighQuality() ? OCR_HIGH_DPI : 300;
  const args = [
    PYTHON_OCR_SCRIPT,
    "--pdf",
    filePath,
    "--out",
    outputPath,
    "--dpi",
    String(dpi),
    "--oem",
    "1",
    "--psm",
    getOcrHighQuality() ? "4" : "6",
  ];

  if (getOcrPythonNoSplit()) {
    args.push("--no-split");
  }

  const result = spawnSync(resolvePythonBinary(), args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Python OCR failed with exit code ${result.status}`);
  }

  return fs.readFileSync(outputPath, "utf-8");
}

async function parseScopedPaper(year: number, paperType: "GS1" | "CSAT", refresh = false) {
  const artifacts = getPaperArtifacts({ year, paperType });
  if (!fs.existsSync(artifacts.questionPdfPath)) {
    throw new Error(`Question paper PDF not found for ${year} ${paperType}: ${artifacts.questionPdfPath}`);
  }

  if (!refresh && fs.existsSync(artifacts.questionTextPath)) {
    console.log(`Skipped: ${year} ${paperType} (text already exists)`);
    return;
  }

  ensureParentDir(artifacts.questionTextPath);
  let text = await parsePDF(artifacts.questionPdfPath);
  let mode: PyqExtractionMethodId = PYQ_EXTRACTION_METHODS.nativePdfText.id;

  if (!hasUsefulText(text)) {
    if (getOcrPython()) {
      text = ocrPDFWithPython(artifacts.questionPdfPath, artifacts.rawDir);
      mode = PYQ_EXTRACTION_METHODS.ocrBilingualDespread.id;
    } else {
      text = await ocrPDF(artifacts.questionPdfPath, artifacts.rawDir);
      mode = PYQ_EXTRACTION_METHODS.ocrBilingualDespread.id;
    }
  }

  fs.writeFileSync(artifacts.questionTextPath, text);
  console.log(`Parsed: ${year} ${paperType} (${mode})`);
}

async function main() {
  const args = parsePyqCliArgs();

  if (args.year && args.paperType) {
    await parseScopedPaper(args.year, args.paperType, args.refresh);
    return;
  }

  const scopes = listPaperScopes().filter((scope) => fs.existsSync(getPaperArtifacts(scope).questionPdfPath));
  if (args.all || scopes.length > 0) {
    for (const scope of scopes) {
      await parseScopedPaper(scope.year, scope.paperType, args.refresh);
    }
    return;
  }

  if (!fs.existsSync(TEXT_DIR)) {
    fs.mkdirSync(TEXT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(PDF_DIR);

  for (const file of files) {
    if (!file.endsWith(".pdf")) {
      continue;
    }

    const filePath = path.join(PDF_DIR, file);
    const text = await parsePDF(filePath);
    const output = path.join(TEXT_DIR, file.replace(".pdf", ".txt"));

    fs.writeFileSync(output, text);
    console.log("Parsed:", file);
  }
}

main();

function getMaxPages() {
  const index = process.argv.indexOf("--max-pages");
  if (index === -1) {
    return null;
  }
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Invalid --max-pages value");
  }
  return value;
}

function getOcrFastMode() {
  return process.argv.includes("--ocr-fast");
}

function getOcrNoSplit() {
  return process.argv.includes("--ocr-no-split");
}

function getOcrSkipPreprocess() {
  return process.argv.includes("--ocr-skip-preprocess");
}

function getOcrHighQuality() {
  return process.argv.includes("--ocr-high");
}

function getOcrPython() {
  return process.argv.includes("--ocr-python");
}

function getOcrPythonNoSplit() {
  return process.argv.includes("--ocr-python-no-split");
}
