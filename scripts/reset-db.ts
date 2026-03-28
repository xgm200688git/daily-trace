import { rmSync } from "node:fs";

import { createDatabaseClient, resolveDatabasePath } from "../src/lib/db.ts";

function main() {
  const databaseUrl = process.env.DATABASE_URL || "file:./data/daily-trace.db";
  const databasePath = resolveDatabasePath(databaseUrl);

  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-journal`, { force: true });
  createDatabaseClient(databaseUrl);
  console.log("database reset");
}

main();
