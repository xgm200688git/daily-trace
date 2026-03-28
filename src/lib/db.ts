import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import "dotenv/config";
import Database from "better-sqlite3";

declare global {
  var __dailyTraceDb: DatabaseClient | undefined;
}

type SqlValue = string | number | null;

export interface DatabaseClient {
  raw: Database.Database;
  get<T>(sql: string, params?: SqlValue[]): T | undefined;
  all<T>(sql: string, params?: SqlValue[]): T[];
  run(sql: string, params?: SqlValue[]): void;
  transaction<T>(fn: () => T): T;
}

export function resolveDatabasePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    return resolve(process.cwd(), databaseUrl.slice(5));
  }

  return resolve(process.cwd(), databaseUrl);
}

function createSchema(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile_settings (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      timezone TEXT NOT NULL,
      week_starts_on INTEGER NOT NULL,
      ai_enabled INTEGER NOT NULL DEFAULT 0,
      default_template_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      definition_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profile_settings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      mood TEXT,
      tags_json TEXT,
      task_status TEXT,
      completed_at TEXT,
      completed_local_date TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profile_settings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_records (
      id TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      record_date TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      content_json TEXT NOT NULL,
      source_ids_json TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      generator_mode TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profile_settings(id) ON DELETE CASCADE,
      UNIQUE (profile_id, module, record_date)
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      template_id TEXT,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      revision INTEGER NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      content_markdown TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      source_record_ids_json TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      generator_mode TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profile_settings(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
      UNIQUE (profile_id, week_start, revision)
    );

    CREATE TABLE IF NOT EXISTS job_runs (
      id TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      job_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      last_success_at TEXT,
      last_error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profile_settings(id) ON DELETE CASCADE
    );
  `);

  try {
    const columns = db.prepare("PRAGMA table_info(profile_settings)").all() as { name: string }[];
    const hasUserId = columns.some((col) => col.name === "user_id");
    if (!hasUserId) {
      db.exec("ALTER TABLE profile_settings ADD COLUMN user_id INTEGER");
    }
  } catch (e) {
    console.log("Could not add user_id column, it may already exist:", e);
  }

  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_settings_user_id ON profile_settings(user_id)");
  } catch (e) {
    console.log("Could not create index, it may already exist:", e);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entries_module_date
      ON entries(profile_id, module, local_date);
    CREATE INDEX IF NOT EXISTS idx_entries_completed_date
      ON entries(profile_id, module, completed_local_date);
    CREATE INDEX IF NOT EXISTS idx_daily_records_date
      ON daily_records(profile_id, record_date);
    CREATE INDEX IF NOT EXISTS idx_weekly_reports_current
      ON weekly_reports(profile_id, week_start, is_current);
    CREATE INDEX IF NOT EXISTS idx_templates_default
      ON templates(profile_id, is_default);
    CREATE INDEX IF NOT EXISTS idx_job_runs_type
      ON job_runs(profile_id, type, updated_at);
  `);
}

function makeClient(db: Database.Database): DatabaseClient {
  return {
    raw: db,
    get<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    run(sql: string, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    transaction<T>(fn: () => T) {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

export function createDatabaseClient(
  databaseUrl = process.env.DATABASE_URL || "file:./data/daily-trace.db",
): DatabaseClient {
  const databasePath = resolveDatabasePath(databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  createSchema(sqlite);

  return makeClient(sqlite);
}

export const db =
  globalThis.__dailyTraceDb ?? createDatabaseClient(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalThis.__dailyTraceDb = db;
}

export function fromDbBoolean(value: number | null | undefined): boolean {
  return value === 1;
}

export function toDbBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}
