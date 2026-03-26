import fs from "node:fs";
import path from "node:path";

type VersionBump = "major" | "minor" | "patch";

function parseArgs() {
  const typeIndex = process.argv.indexOf("--type");
  const versionIndex = process.argv.indexOf("--version");
  const type = typeIndex !== -1 ? (process.argv[typeIndex + 1] as VersionBump) : null;
  const version = versionIndex !== -1 ? process.argv[versionIndex + 1] : null;
  return { type, version };
}

function bumpSemver(current: string, type: VersionBump) {
  const [major, minor, patch] = current.split(".").map(Number);
  if ([major, minor, patch].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid current version: ${current}`);
  }
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function updateChangelog(nextVersion: string) {
  const changelogPath = path.resolve(process.cwd(), "..", "CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) {
    console.warn("CHANGELOG.md not found; skipping changelog update.");
    return;
  }
  const raw = fs.readFileSync(changelogPath, "utf-8");
  const date = new Date().toISOString().slice(0, 10);
  if (!raw.includes("## [Unreleased]")) {
    console.warn("CHANGELOG missing Unreleased section; skipping update.");
    return;
  }
  const releaseHeader = `## [${nextVersion}] - ${date}`;
  if (raw.includes(releaseHeader)) {
    console.warn("Changelog already contains this version; skipping.");
    return;
  }
  const updated = raw.replace("## [Unreleased]", `## [Unreleased]\n\n${releaseHeader}`);
  fs.writeFileSync(changelogPath, updated);
}

function main() {
  const { type, version } = parseArgs();
  if (!type && !version) {
    throw new Error("Usage: npm run bump:version -- --type <major|minor|patch> OR --version X.Y.Z");
  }
  const packagePath = path.resolve(process.cwd(), "package.json");
  const raw = fs.readFileSync(packagePath, "utf-8");
  const pkg = JSON.parse(raw) as { version: string };
  const nextVersion = version ?? bumpSemver(pkg.version, type as VersionBump);
  pkg.version = nextVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
  updateChangelog(nextVersion);
  console.log(`Version bumped to ${nextVersion}`);
  console.log(`Tag template: v${nextVersion}`);
}

main();
