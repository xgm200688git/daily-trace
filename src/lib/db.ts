import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { DatabaseSync, type RunResult } from "node:sqlite";

declare global {
  var __dailyTraceDb: DatabaseClient | undefined;
  var __usersDb: DatabaseClient | undefined;
}

type SqlValue = string | number | null;

export interface DatabaseClient {
  raw: DatabaseSync;
  get<T>(sql: string, params?: SqlValue[]): T | undefined;
  all<T>(sql: string, params?: SqlValue[]): T[];
  run(sql: string, params?: SqlValue[]): RunResult;
  transaction<T>(fn: () => T): T;
}

export function resolveDatabasePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    return resolve(process.cwd(), databaseUrl.slice(5));
  }

  return resolve(process.cwd(), databaseUrl);
}

function createUserSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);
}

function addColumnIfNotExists(db: DatabaseSync, tableName: string, columnDefinition: string) {
  const columnName = columnDefinition.split(' ')[0];
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  const hasColumn = columns.some(col => col.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

function migrateDatabase(db: DatabaseSync) {
  try {
    addColumnIfNotExists(db, 'profile_settings', 'deleted_at TEXT');
    addColumnIfNotExists(db, 'templates', 'deleted_at TEXT');
    addColumnIfNotExists(db, 'entries', 'deleted_at TEXT');
    addColumnIfNotExists(db, 'daily_records', 'deleted_at TEXT');
    addColumnIfNotExists(db, 'daily_records', 'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');
    addColumnIfNotExists(db, 'weekly_reports', 'deleted_at TEXT');
    addColumnIfNotExists(db, 'job_runs', 'deleted_at TEXT');
    addColumnIfNotExists(db, 'change_queue', 'source_hash TEXT NOT NULL DEFAULT \'\'');
    addColumnIfNotExists(db, 'change_queue', 'retry_count INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'change_queue', 'last_retry_at TEXT');
    addColumnIfNotExists(db, 'change_queue', 'error_message TEXT');
  } catch (error) {
    console.warn('Migration encountered an error (some columns may already exist):', error);
  }
}

function createSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profile_settings (
      id INTEGER PRIMARY KEY,
      timezone TEXT NOT NULL,
      week_starts_on INTEGER NOT NULL,
      ai_enabled INTEGER NOT NULL DEFAULT 0,
      default_template_id TEXT,
      deleted_at TEXT,
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
      deleted_at TEXT,
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
      deleted_at TEXT,
      created_at TEXT NOT NULL,
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
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
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
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profile_settings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      last_sync_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS change_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      change_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source_hash TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_retry_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_profile_settings_updated_at
      ON profile_settings(updated_at);
    CREATE INDEX IF NOT EXISTS idx_templates_updated_at
      ON templates(updated_at);
    CREATE INDEX IF NOT EXISTS idx_entries_updated_at
      ON entries(updated_at);
    CREATE INDEX IF NOT EXISTS idx_daily_records_updated_at
      ON daily_records(updated_at);
    CREATE INDEX IF NOT EXISTS idx_weekly_reports_updated_at
      ON weekly_reports(updated_at);
    CREATE INDEX IF NOT EXISTS idx_job_runs_updated_at
      ON job_runs(updated_at);
    CREATE INDEX IF NOT EXISTS idx_sync_status_updated_at
      ON sync_status(updated_at);
    CREATE INDEX IF NOT EXISTS idx_change_queue_status
      ON change_queue(status, created_at);

    CREATE TABLE IF NOT EXISTS conflict_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      local_updated_at TEXT,
      cloud_updated_at TEXT,
      local_source_hash TEXT,
      cloud_source_hash TEXT,
      resolved_strategy TEXT NOT NULL,
      winner_source TEXT NOT NULL,
      local_data TEXT,
      cloud_data TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conflict_history_table_record
      ON conflict_history(table_name, record_id);
    CREATE INDEX IF NOT EXISTS idx_conflict_history_created_at
      ON conflict_history(created_at);
  `);

  migrateDatabase(db);
}

function makeClient(db: DatabaseSync): DatabaseClient {
  return {
    raw: db,
    get<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    run(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).run(...params);
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

  const sqlite = new DatabaseSync(databasePath);
  createSchema(sqlite);
  migrateDatabase(sqlite);

  return makeClient(sqlite);
}

export const db =
  globalThis.__dailyTraceDb ?? createDatabaseClient(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalThis.__dailyTraceDb = db;
}

export function createUserDatabaseClient(
  databaseUrl = "file:./data/users.db",
): DatabaseClient {
  const databasePath = resolveDatabasePath(databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });

  const sqlite = new DatabaseSync(databasePath);
  createUserSchema(sqlite);

  return makeClient(sqlite);
}

export const usersDb =
  globalThis.__usersDb ?? createUserDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__usersDb = usersDb;
}

export function getUserDatabaseClient(userId: number): DatabaseClient {
  const databaseUrl = `file:./data/users/${userId}/daily-trace.db`;
  return createDatabaseClient(databaseUrl);
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

const userDbCache = new Map<number, DatabaseClient>();

export function getCurrentUserDb(userId: number): DatabaseClient {
  if (userDbCache.has(userId)) {
    return userDbCache.get(userId)!;
  }

  const db = getUserDatabaseClient(userId);
  userDbCache.set(userId, db);
  return db;
}
