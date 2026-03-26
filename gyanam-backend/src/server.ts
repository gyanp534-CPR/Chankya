import { createApp } from "./app.js";
import { exec } from "node:child_process";

function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (stdout) {
        console.log(stdout.trim());
      }
      if (stderr) {
        console.error(stderr.trim());
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main() {
  if (process.env.AUTO_MIGRATE === "true") {
    console.log("AUTO_MIGRATE enabled. Running prisma migrate deploy...");
    await runCommand("npx prisma migrate deploy");
  }
  if (process.env.AUTO_SEED === "true") {
    console.log("AUTO_SEED enabled. Running prisma db seed...");
    await runCommand("npx prisma db seed");
  }
  const { app, env } = await createApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
