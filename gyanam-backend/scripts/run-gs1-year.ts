import { spawnSync } from "node:child_process";

const IS_WINDOWS = process.platform === "win32";
const NPM_CMD = "npm";

function getYearArg() {
  const index = process.argv.indexOf("--year");
  if (index === -1) {
    throw new Error("Usage: npm run gs1:year -- --year <YYYY>");
  }
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value)) {
    throw new Error("Invalid --year value");
  }
  return value;
}

function runCommand(args: string[]) {
  const result = IS_WINDOWS
    ? spawnSync("cmd", ["/c", NPM_CMD, "run", ...args], { encoding: "utf-8" })
    : spawnSync(NPM_CMD, ["run", ...args], { encoding: "utf-8" });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    console.error(`Command failed: ${NPM_CMD} ${args.join(" ")}`);
    if (result.error) {
      console.error(`Spawn error: ${result.error.message}`);
    }
    return false;
  }
  return true;
}

function main() {
  const year = getYearArg();
  console.log(`\n=== GS1 ${year}: OCR parse (refresh) ===`);
  const parseOk = runCommand(["parse:pyq", "--", "--year", String(year), "--paper", "GS1", "--refresh"]);
  if (!parseOk) {
    process.exitCode = 1;
    return;
  }
  console.log(`\n=== GS1 ${year}: normalize ===`);
  const normalizeOk = runCommand(["normalize:pyq", "--", "--year", String(year), "--paper", "GS1"]);
  if (!normalizeOk) {
    process.exitCode = 1;
    return;
  }
  console.log(`\n=== GS1 ${year}: trim ===`);
  const trimOk = runCommand(["trim:pyq", "--", "--year", String(year), "--paper", "GS1"]);
  if (!trimOk) {
    process.exitCode = 1;
  }
}

main();
