import { createDatabaseClient } from "../src/lib/db.ts";

function main() {
  createDatabaseClient(process.env.DATABASE_URL);
  console.log("database initialized");
}

main();
