import { runDailyCron } from "../src/features/reconcile/service.ts";

async function main() {
  await runDailyCron();
  console.log("daily cron completed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
