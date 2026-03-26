import { createApp } from "../src/app.js";

async function main() {
  const args = process.argv.slice(2);
  const userArg = args.find((arg) => arg.startsWith("--userId="));

  const { app, masteryService } = await createApp();
  if (!masteryService) {
    throw new Error("Mastery service is not available in this app configuration.");
  }

  if (userArg) {
    const userId = userArg.split("=")[1];
    if (!userId) {
      throw new Error("Invalid --userId argument.");
    }
    await masteryService.recomputeForUser(userId, "manual_recompute");
    console.log(`Recomputed mastery for ${userId}`);
  } else {
    await masteryService.recomputeForAllUsers();
    console.log("Recomputed mastery for all users");
  }

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
