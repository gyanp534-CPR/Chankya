import { spawnSync } from "node:child_process";

const YEARS = Array.from({ length: 10 }, (_, index) => 2016 + index).filter((year) => year !== 2023);

function runCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runYear(year: number) {
  console.log(`\n=== GS1 ${year}: OCR parse ===`);
  runCommand("npm", ["run", "parse:pyq", "--", "--year", String(year), "--paper", "GS1"]);
  console.log(`\n=== GS1 ${year}: normalize ===`);
  runCommand("npm", ["run", "normalize:pyq", "--", "--year", String(year), "--paper", "GS1"]);
}

function main() {
  for (const year of YEARS) {
    runYear(year);
  }
}

main();
