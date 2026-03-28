import { runWeeklyCron } from "../src/features/reconcile/service.ts";

async function main() {
  await runWeeklyCron();
  console.log("weekly cron completed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
