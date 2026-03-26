import { createApp } from "./app.js";

async function main() {
  const { app, env } = await createApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
