import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function createPrismaClient(
  databaseUrl = process.env.DATABASE_URL || "file:./data/daily-trace.db",
): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma =
  globalThis.__prismaClient ?? createPrismaClient(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}
