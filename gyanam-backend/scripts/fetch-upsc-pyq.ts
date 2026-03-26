import axios from "axios";
import * as cheerio from "cheerio";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ensureParentDir,
  getPaperArtifacts,
  parsePyqCliArgs,
} from "./pyq-paths.js";

const UPSC_URL = "https://upsc.gov.in/examinations/previous-question-papers";
const UPSC_ARCHIVE_URL = "https://upsc.gov.in/examinations/previous-question-papers/archives";
const UPSC_BASE_URL = "https://upsc.gov.in";

type PaperType = "GS1" | "CSAT" | "unknown";

type PyqLink = {
  url: string;
  year: number | null;
  paper: Exclude<PaperType, "unknown">;
  label: string;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesPattern(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function detectPaperType(input: string): PaperType {
  const lower = normalizeText(input);

  if (
    matchesPattern(lower, /\bpaper[\s\-_]*ii\b/) ||
    matchesPattern(lower, /\bgeneral studies paper[\s\-_]*ii\b/) ||
    matchesPattern(lower, /\bgs paper[\s\-_]*ii\b/) ||
    lower.includes("csat")
  ) {
    return "CSAT";
  }

  if (
    matchesPattern(lower, /\bpaper[\s\-_]*1\b/) ||
    matchesPattern(lower, /\bpaper[\s\-_]*i\b/) ||
    matchesPattern(lower, /\bgeneral studies paper[\s\-_]*1\b/) ||
    matchesPattern(lower, /\bgeneral studies paper[\s\-_]*i\b/) ||
    matchesPattern(lower, /\bgs paper[\s\-_]*i\b/) ||
    lower.includes("gs1")
  ) {
    return "GS1";
  }

  return "unknown";
}

function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  return `${UPSC_BASE_URL}${href.startsWith("/") ? href : `/${href}`}`;
}

function inferFileName(link: PyqLink): string {
  const rawName = link.url.split("/").pop() ?? "upsc_pyq.pdf";
  return `${link.paper}_${rawName}`;
}

function parseYear(input: string): number | null {
  const fourDigit = input.match(/20\d{2}/);
  if (fourDigit?.[0]) {
    return Number(fourDigit[0]);
  }

  const cspShort = input.match(/csp[-_](\d{2})/i);
  if (cspShort?.[1]) {
    return Number(`20${cspShort[1]}`);
  }

  return null;
}

function addLink(
  seen: Set<string>,
  links: PyqLink[],
  href: string,
  label: string,
  context: string,
) {
  const normalizedHref = normalizeText(href);
  if (!normalizedHref.includes(".pdf")) {
    return;
  }

  const fullUrl = toAbsoluteUrl(href);
  const paper = detectPaperType(`${href} ${label}`);
  const year = parseYear(`${context} ${href} ${label}`);

  if (paper === "unknown" || year === null || seen.has(fullUrl)) {
    return;
  }

  seen.add(fullUrl);
  links.push({
    url: fullUrl,
    year,
    paper,
    label: label.trim(),
  });
}

async function fetchCurrentPageLinks(seen: Set<string>): Promise<PyqLink[]> {
  const response = await axios.get(UPSC_URL);
  const $ = cheerio.load(response.data);
  const links: PyqLink[] = [];

  $("table").each((_, table) => {
    const captionText = normalizeText($(table).find("caption").text());
    if (!captionText.includes("civil services (preliminary) examination")) {
      return;
    }

    $(table).find("li").each((__, item) => {
      const href = $(item).find("a").attr("href");
      const label = $(item).text();
      if (!href) {
        return;
      }

      addLink(seen, links, href, label, captionText);
    });
  });

  return links;
}

async function fetchArchiveLinks(seen: Set<string>): Promise<PyqLink[]> {
  const response = await axios.get(UPSC_ARCHIVE_URL);
  const $ = cheerio.load(response.data);
  const links: PyqLink[] = [];

  $("table").each((_, table) => {
    const captionText = $(table).find("caption").text().trim();
    if (!/civil services/i.test(captionText) || !/prelim/i.test(captionText)) {
      return;
    }

    $(table).find("li").each((__, item) => {
      const href = $(item).find("a").attr("href");
      const label = $(item).text();
      if (!href) {
        return;
      }

      addLink(seen, links, href, label, captionText);
    });
  });

  return links;
}

async function fetchPYQLinks(): Promise<PyqLink[]> {
  const seen = new Set<string>();
  const [currentLinks, archiveLinks] = await Promise.all([
    fetchCurrentPageLinks(seen),
    fetchArchiveLinks(seen),
  ]);

  return [...currentLinks, ...archiveLinks].sort(
    (a, b) => (a.year ?? 0) - (b.year ?? 0) || a.paper.localeCompare(b.paper),
  );
}

async function downloadPDF(link: PyqLink): Promise<void> {
  if (link.year === null) {
    console.warn(`Skipping unresolved year: ${link.label}`);
    return;
  }

  const artifacts = getPaperArtifacts({ year: link.year, paperType: link.paper });
  ensureParentDir(artifacts.questionPdfPath);

  if (existsSync(artifacts.questionPdfPath)) {
    console.log(`Already downloaded: ${link.year} ${link.paper}`);
    return;
  }

  const response = await axios.get<ArrayBuffer>(link.url, {
    responseType: "arraybuffer",
  });

  writeFileSync(artifacts.questionPdfPath, Buffer.from(response.data));
  console.log(`Downloaded: ${link.year} ${link.paper} -> ${path.relative(process.cwd(), artifacts.questionPdfPath)}`);
}

async function main() {
  const args = parsePyqCliArgs();
  const links = await fetchPYQLinks();
  const filteredLinks = links.filter((link) => {
    if (args.year && link.year !== args.year) {
      return false;
    }

    if (args.paperType && link.paper !== args.paperType) {
      return false;
    }

    return true;
  });

  if (args.year && filteredLinks.length === 0) {
    throw new Error(`No UPSC prelims PDF matched year=${args.year}${args.paperType ? ` paper=${args.paperType}` : ""}.`);
  }

  if (!args.all && !args.year && !args.paperType) {
    console.log("No --year/--paper provided; fetching all detected prelims papers.");
  }

  console.log(`Detected ${links.length} prelims PDF links. Downloading ${filteredLinks.length}.`);

  for (const link of filteredLinks) {
    await downloadPDF(link);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
