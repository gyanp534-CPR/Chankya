import { spawnSync } from "node:child_process";

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2024, 2025];
const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";

function runCommand(args: string[]) {
  const result = spawnSync(NPM_CMD, args, { stdio: "inherit" });
  return result.status === 0;
}

function main() {
  const failures: Array<{ year: number }> = [];
  for (const year of YEARS) {
    console.log(`\n=== GS1 ${year}: trim to 100 ===`);
    const ok = runCommand(["run", "trim:pyq", "--", "--year", String(year), "--paper", "GS1"]);
    if (!ok) {
      failures.push({ year });
    }
  }

  if (failures.length > 0) {
    console.error("\nCompleted with failures:");
    for (const failure of failures) {
      console.error(`- ${failure.year}`);
    }
    process.exitCode = 1;
  }
}

main();
