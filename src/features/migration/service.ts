import { mkdirSync, copyFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { DatabaseSync } from "node:sqlite";

import {
  nowIso,
  resolveDatabasePath,
  type DatabaseClient,
  createDatabaseClient,
} from "@/lib/db";
import { DEFAULT_PROFILE_ID } from "@/lib/constants";

export interface MigrationProgress {
  step: string;
  progress: number;
  total: number;
  message: string;
}

export interface MigrationResult {
  success: boolean;
  backupPath?: string;
  migratedCounts: {
    profileSettings: number;
    templates: number;
    entries: number;
    dailyRecords: number;
    weeklyReports: number;
    jobRuns: number;
  };
  error?: string;
}

export class MigrationService {
  private progressCallbacks: ((progress: MigrationProgress) => void)[] = [];
  private oldDbPath: string;
  private newDbPath: string;

  constructor(
    oldDbPath = "./data/daily-trace-old.db",
    newDbPath = "./data/daily-trace.db",
  ) {
    this.oldDbPath = resolveDatabasePath(oldDbPath);
    this.newDbPath = resolveDatabasePath(newDbPath);
  }

  onProgress(callback: (progress: MigrationProgress) => void) {
    this.progressCallbacks.push(callback);
  }

  private emitProgress(step: string, progress: number, total: number, message: string) {
    const progressData: MigrationProgress = { step, progress, total, message };
    for (const callback of this.progressCallbacks) {
      callback(progressData);
    }
  }

  private backupDatabase(): string {
    this.emitProgress("备份", 0, 1, "正在备份目标数据库...");
    
    if (!existsSync(this.newDbPath)) {
      this.emitProgress("备份", 1, 1, "目标数据库不存在，跳过备份");
      return "";
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = dirname(this.newDbPath);
    const backupPath = join(backupDir, `daily-trace-backup-${timestamp}.db`);
    
    mkdirSync(backupDir, { recursive: true });
    copyFileSync(this.newDbPath, backupPath);
    
    this.emitProgress("备份", 1, 1, `备份完成: ${backupPath}`);
    return backupPath;
  }

  private checkOldDatabase(): boolean {
    this.emitProgress("检查", 0, 1, "检查旧版数据库...");
    
    if (!existsSync(this.oldDbPath)) {
      throw new Error(`旧版数据库不存在: ${this.oldDbPath}`);
    }

    this.emitProgress("检查", 1, 1, "旧版数据库存在");
    return true;
  }

  private getOldDbTables(oldDb: DatabaseSync): string[] {
    const tables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    return tables.map(t => t.name);
  }

  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedCounts: {
        profileSettings: 0,
        templates: 0,
        entries: 0,
        dailyRecords: 0,
        weeklyReports: 0,
        jobRuns: 0,
      },
    };

    try {
      result.backupPath = this.backupDatabase();
      this.checkOldDatabase();

      const oldDb = new DatabaseSync(this.oldDbPath);
      const oldTables = this.getOldDbTables(oldDb);

      const newDb = createDatabaseClient(this.newDbPath);

      if (oldTables.includes("profile_settings")) {
        result.migratedCounts.profileSettings = this.migrateProfileSettings(oldDb, newDb);
      }

      if (oldTables.includes("templates")) {
        result.migratedCounts.templates = this.migrateTemplates(oldDb, newDb);
      }

      if (oldTables.includes("entries")) {
        result.migratedCounts.entries = this.migrateEntries(oldDb, newDb);
      }

      if (oldTables.includes("daily_records")) {
        result.migratedCounts.dailyRecords = this.migrateDailyRecords(oldDb, newDb);
      }

      if (oldTables.includes("weekly_reports")) {
        result.migratedCounts.weeklyReports = this.migrateWeeklyReports(oldDb, newDb);
      }

      if (oldTables.includes("job_runs")) {
        result.migratedCounts.jobRuns = this.migrateJobRuns(oldDb, newDb);
      }

      result.success = true;
      this.emitProgress("完成", 1, 1, "数据迁移完成！");

    } catch (error) {
      result.error = error instanceof Error ? error.message : "未知错误";
      this.emitProgress("错误", 0, 1, `迁移失败: ${result.error}`);
    }

    return result;
  }

  private migrateProfileSettings(oldDb: DatabaseSync, newDb: DatabaseClient): number {
    this.emitProgress("迁移设置", 0, 1, "正在迁移用户设置...");
    
    const rows = oldDb.prepare("SELECT * FROM profile_settings").all() as Record<string, unknown>[];
    
    if (rows.length === 0) {
      this.emitProgress("迁移设置", 1, 1, "无设置数据可迁移");
      return 0;
    }

    newDb.transaction(() => {
      for (const row of rows) {
        newDb.run(
          `
            INSERT OR REPLACE INTO profile_settings (
              id, timezone, week_starts_on, ai_enabled, default_template_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            (row.id as number) || DEFAULT_PROFILE_ID,
            row.timezone as string,
            row.week_starts_on as number,
            row.ai_enabled as number,
            row.default_template_id as string | null,
            (row.created_at as string) || nowIso(),
            (row.updated_at as string) || nowIso(),
          ],
        );
      }
    });

    this.emitProgress("迁移设置", 1, 1, `已迁移 ${rows.length} 条设置记录`);
    return rows.length;
  }

  private migrateTemplates(oldDb: DatabaseSync, newDb: DatabaseClient): number {
    this.emitProgress("迁移模板", 0, 1, "正在迁移模板...");
    
    const rows = oldDb.prepare("SELECT * FROM templates").all() as Record<string, unknown>[];
    
    if (rows.length === 0) {
      this.emitProgress("迁移模板", 1, 1, "无模板数据可迁移");
      return 0;
    }

    newDb.transaction(() => {
      for (const row of rows) {
        newDb.run(
          `
            INSERT OR REPLACE INTO templates (
              id, profile_id, name, version, is_default, definition_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.id as string,
            (row.profile_id as number) || DEFAULT_PROFILE_ID,
            row.name as string,
            row.version as number,
            row.is_default as number,
            row.definition_json as string,
            (row.created_at as string) || nowIso(),
            (row.updated_at as string) || nowIso(),
          ],
        );
      }
    });

    this.emitProgress("迁移模板", 1, 1, `已迁移 ${rows.length} 个模板`);
    return rows.length;
  }

  private migrateEntries(oldDb: DatabaseSync, newDb: DatabaseClient): number {
    this.emitProgress("迁移记录", 0, 1, "正在迁移日记/任务记录...");
    
    const rows = oldDb.prepare("SELECT * FROM entries").all() as Record<string, unknown>[];
    
    if (rows.length === 0) {
      this.emitProgress("迁移记录", 1, 1, "无记录数据可迁移");
      return 0;
    }

    newDb.transaction(() => {
      for (const row of rows) {
        newDb.run(
          `
            INSERT OR REPLACE INTO entries (
              id, profile_id, module, occurred_at, local_date, title, content, mood, tags_json,
              task_status, completed_at, completed_local_date, deleted_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.id as string,
            (row.profile_id as number) || DEFAULT_PROFILE_ID,
            row.module as string,
            row.occurred_at as string,
            row.local_date as string,
            row.title as string | null,
            row.content as string,
            row.mood as string | null,
            row.tags_json as string | null,
            row.task_status as string | null,
            row.completed_at as string | null,
            row.completed_local_date as string | null,
            row.deleted_at as string | null,
            (row.created_at as string) || nowIso(),
            (row.updated_at as string) || nowIso(),
          ],
        );
      }
    });

    this.emitProgress("迁移记录", 1, 1, `已迁移 ${rows.length} 条记录`);
    return rows.length;
  }

  private migrateDailyRecords(oldDb: DatabaseSync, newDb: DatabaseClient): number {
    this.emitProgress("迁移日报", 0, 1, "正在迁移日报记录...");
    
    const rows = oldDb.prepare("SELECT * FROM daily_records").all() as Record<string, unknown>[];
    
    if (rows.length === 0) {
      this.emitProgress("迁移日报", 1, 1, "无日报数据可迁移");
      return 0;
    }

    newDb.transaction(() => {
      for (const row of rows) {
        newDb.run(
          `
            INSERT OR REPLACE INTO daily_records (
              id, profile_id, module, record_date, content_markdown, content_json,
              source_ids_json, source_hash, generator_mode, generated_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.id as string,
            (row.profile_id as number) || DEFAULT_PROFILE_ID,
            row.module as string,
            row.record_date as string,
            row.content_markdown as string,
            row.content_json as string,
            row.source_ids_json as string,
            row.source_hash as string,
            row.generator_mode as string,
            (row.generated_at as string) || nowIso(),
            (row.updated_at as string) || nowIso(),
          ],
        );
      }
    });

    this.emitProgress("迁移日报", 1, 1, `已迁移 ${rows.length} 条日报`);
    return rows.length;
  }

  private migrateWeeklyReports(oldDb: DatabaseSync, newDb: DatabaseClient): number {
    this.emitProgress("迁移周报", 0, 1, "正在迁移周报记录...");
    
    const rows = oldDb.prepare("SELECT * FROM weekly_reports").all() as Record<string, unknown>[];
    
    if (rows.length === 0) {
      this.emitProgress("迁移周报", 1, 1, "无周报数据可迁移");
      return 0;
    }

    newDb.transaction(() => {
      for (const row of rows) {
        newDb.run(
          `
            INSERT OR REPLACE INTO weekly_reports (
              id, profile_id, template_id, week_start, week_end, revision, is_current,
              content_markdown, sections_json, source_record_ids_json, source_hash,
              generator_mode, generated_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.id as string,
            (row.profile_id as number) || DEFAULT_PROFILE_ID,
            row.template_id as string | null,
            row.week_start as string,
            row.week_end as string,
            row.revision as number,
            row.is_current as number,
            row.content_markdown as string,
            row.sections_json as string,
            row.source_record_ids_json as string,
            row.source_hash as string,
            row.generator_mode as string,
            (row.generated_at as string) || nowIso(),
            (row.created_at as string) || nowIso(),
          ],
        );
      }
    });

    this.emitProgress("迁移周报", 1, 1, `已迁移 ${rows.length} 条周报`);
    return rows.length;
  }

  private migrateJobRuns(oldDb: DatabaseSync, newDb: DatabaseClient): number {
    this.emitProgress("迁移任务", 0, 1, "正在迁移定时任务记录...");
    
    const rows = oldDb.prepare("SELECT * FROM job_runs").all() as Record<string, unknown>[];
    
    if (rows.length === 0) {
      this.emitProgress("迁移任务", 1, 1, "无任务记录可迁移");
      return 0;
    }

    newDb.transaction(() => {
      for (const row of rows) {
        newDb.run(
          `
            INSERT OR REPLACE INTO job_runs (
              id, profile_id, type, job_key, status, last_success_at, last_error,
              started_at, finished_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.id as string,
            (row.profile_id as number) || DEFAULT_PROFILE_ID,
            row.type as string,
            row.job_key as string,
            row.status as string,
            row.last_success_at as string | null,
            row.last_error as string | null,
            (row.started_at as string) || nowIso(),
            row.finished_at as string | null,
            (row.created_at as string) || nowIso(),
            (row.updated_at as string) || nowIso(),
          ],
        );
      }
    });

    this.emitProgress("迁移任务", 1, 1, `已迁移 ${rows.length} 条任务记录`);
    return rows.length;
  }
}

export async function migrateData(
  oldDbPath?: string,
  newDbPath?: string,
  progressCallback?: (progress: MigrationProgress) => void,
): Promise<MigrationResult> {
  const service = new MigrationService(oldDbPath, newDbPath);
  
  if (progressCallback) {
    service.onProgress(progressCallback);
  }

  return await service.migrate();
}
