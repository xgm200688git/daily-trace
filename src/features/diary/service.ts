import { randomUUID } from "node:crypto";

import {
  DEFAULT_PROFILE_ID,
  ENTRY_MODULE,
  WORK_TASK_STATUS,
} from "@/lib/constants";
import { db, nowIso, type DatabaseClient } from "@/lib/db";
import { parseJson, toJsonString } from "@/lib/json";
import { toLocalDateKey } from "@/lib/time";
import { ensureProfileSettings } from "@/features/settings/service";

export interface EntryRecord {
  id: string;
  profileId: number;
  module: "life" | "work";
  occurredAt: string;
  localDate: string;
  title: string | null;
  content: string;
  mood: string | null;
  tagsJson: string | null;
  taskStatus: "pending" | "completed" | null;
  completedAt: string | null;
  completedLocalDate: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LifeEntryInput {
  content: string;
  mood?: string;
  tags?: string[];
  occurredAt?: Date;
}

export interface WorkTaskInput {
  title: string;
  description?: string;
  occurredAt?: Date;
  completedAt?: Date;
  status?: "pending" | "completed";
}

function mapEntry(row: {
  id: string;
  profile_id: number;
  module: "life" | "work";
  occurred_at: string;
  local_date: string;
  title: string | null;
  content: string;
  mood: string | null;
  tags_json: string | null;
  task_status: "pending" | "completed" | null;
  completed_at: string | null;
  completed_local_date: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}): EntryRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    module: row.module,
    occurredAt: row.occurred_at,
    localDate: row.local_date,
    title: row.title,
    content: row.content,
    mood: row.mood,
    tagsJson: row.tags_json,
    taskStatus: row.task_status,
    completedAt: row.completed_at,
    completedLocalDate: row.completed_local_date,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeTags(input: string | string[] | undefined): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map((tag) => tag.trim()).filter(Boolean);
  }

  return input
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseTags(tagsJson: string | null): string[] {
  return parseJson<string[]>(tagsJson, []);
}

export async function createLifeEntry(
  input: LifeEntryInput,
  client: DatabaseClient = db,
) {
  const profile = await ensureProfileSettings(client);
  const occurredAt = input.occurredAt ?? new Date();
  const now = nowIso();
  const id = randomUUID();

  client.run(
    `
      INSERT INTO entries (
        id,
        profile_id,
        module,
        occurred_at,
        local_date,
        title,
        content,
        mood,
        tags_json,
        task_status,
        completed_at,
        completed_local_date,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      DEFAULT_PROFILE_ID,
      ENTRY_MODULE.LIFE,
      occurredAt.toISOString(),
      toLocalDateKey(occurredAt, profile.timezone),
      null,
      input.content.trim(),
      input.mood?.trim() || null,
      input.tags?.length ? toJsonString(input.tags) : null,
      null,
      null,
      null,
      null,
      now,
      now,
    ],
  );

  return getEntryById(id, client);
}

export async function updateLifeEntry(
  entryId: string,
  input: LifeEntryInput,
  client: DatabaseClient = db,
) {
  const existing = await getEntryById(entryId, client);
  const profile = await ensureProfileSettings(client);
  const occurredAt = input.occurredAt ?? new Date(existing.occurredAt);

  client.run(
    `
      UPDATE entries
      SET content = ?, mood = ?, tags_json = ?, occurred_at = ?, local_date = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      input.content.trim(),
      input.mood?.trim() || null,
      input.tags?.length ? toJsonString(input.tags) : null,
      occurredAt.toISOString(),
      toLocalDateKey(occurredAt, profile.timezone),
      nowIso(),
      entryId,
    ],
  );

  return getEntryById(entryId, client);
}

export async function createWorkTask(
  input: WorkTaskInput,
  client: DatabaseClient = db,
) {
  const profile = await ensureProfileSettings(client);
  const occurredAt = input.occurredAt ?? new Date();
  const nextStatus = input.status ?? WORK_TASK_STATUS.PENDING;
  const completedAt =
    nextStatus === WORK_TASK_STATUS.COMPLETED ? input.completedAt ?? occurredAt : null;
  const now = nowIso();
  const id = randomUUID();

  client.run(
    `
      INSERT INTO entries (
        id,
        profile_id,
        module,
        occurred_at,
        local_date,
        title,
        content,
        mood,
        tags_json,
        task_status,
        completed_at,
        completed_local_date,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      DEFAULT_PROFILE_ID,
      ENTRY_MODULE.WORK,
      occurredAt.toISOString(),
      toLocalDateKey(occurredAt, profile.timezone),
      input.title.trim(),
      input.description?.trim() || "",
      null,
      null,
      nextStatus,
      completedAt?.toISOString() || null,
      completedAt ? toLocalDateKey(completedAt, profile.timezone) : null,
      null,
      now,
      now,
    ],
  );

  return getEntryById(id, client);
}

export async function updateWorkTask(
  entryId: string,
  input: WorkTaskInput,
  client: DatabaseClient = db,
) {
  client.run(
    `
      UPDATE entries
      SET title = ?, content = ?, updated_at = ?
      WHERE id = ?
    `,
    [input.title.trim(), input.description?.trim() || "", nowIso(), entryId],
  );

  return getEntryById(entryId, client);
}

export async function toggleWorkTaskStatus(
  entryId: string,
  client: DatabaseClient = db,
) {
  const existing = await getEntryById(entryId, client);
  const profile = await ensureProfileSettings(client);
  const nextStatus =
    existing.taskStatus === WORK_TASK_STATUS.COMPLETED
      ? WORK_TASK_STATUS.PENDING
      : WORK_TASK_STATUS.COMPLETED;
  const completedAt =
    nextStatus === WORK_TASK_STATUS.COMPLETED ? new Date() : null;

  client.run(
    `
      UPDATE entries
      SET task_status = ?, completed_at = ?, completed_local_date = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      nextStatus,
      completedAt?.toISOString() || null,
      completedAt ? toLocalDateKey(completedAt, profile.timezone) : null,
      nowIso(),
      entryId,
    ],
  );

  return getEntryById(entryId, client);
}

export async function softDeleteEntry(
  entryId: string,
  client: DatabaseClient = db,
) {
  client.run(
    `
      UPDATE entries
      SET deleted_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [nowIso(), nowIso(), entryId],
  );
}

export async function getEntryById(
  entryId: string,
  client: DatabaseClient = db,
): Promise<EntryRecord> {
  const row = client.get<{
    id: string;
    profile_id: number;
    module: "life" | "work";
    occurred_at: string;
    local_date: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags_json: string | null;
    task_status: "pending" | "completed" | null;
    completed_at: string | null;
    completed_local_date: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM entries WHERE id = ?", [entryId]);

  if (!row) {
    throw new Error("找不到对应的记录。");
  }

  return mapEntry(row);
}

export async function listLifeEntriesByDate(
  localDate: string,
  client: DatabaseClient = db,
): Promise<EntryRecord[]> {
  const rows = client.all<{
    id: string;
    profile_id: number;
    module: "life" | "work";
    occurred_at: string;
    local_date: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags_json: string | null;
    task_status: "pending" | "completed" | null;
    completed_at: string | null;
    completed_local_date: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM entries
      WHERE profile_id = ?
        AND module = ?
        AND local_date = ?
        AND deleted_at IS NULL
      ORDER BY occurred_at ASC
    `,
    [DEFAULT_PROFILE_ID, ENTRY_MODULE.LIFE, localDate],
  );

  return rows.map(mapEntry);
}

export async function listWorkTasksForDashboard(
  client: DatabaseClient = db,
): Promise<EntryRecord[]> {
  const rows = client.all<{
    id: string;
    profile_id: number;
    module: "life" | "work";
    occurred_at: string;
    local_date: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags_json: string | null;
    task_status: "pending" | "completed" | null;
    completed_at: string | null;
    completed_local_date: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM entries
      WHERE profile_id = ?
        AND module = ?
        AND deleted_at IS NULL
      ORDER BY
        CASE task_status WHEN 'pending' THEN 0 ELSE 1 END,
        updated_at DESC
    `,
    [DEFAULT_PROFILE_ID, ENTRY_MODULE.WORK],
  );

  return rows.map(mapEntry);
}

export async function listCompletedWorkEntriesByDate(
  localDate: string,
  client: DatabaseClient = db,
): Promise<EntryRecord[]> {
  const rows = client.all<{
    id: string;
    profile_id: number;
    module: "life" | "work";
    occurred_at: string;
    local_date: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags_json: string | null;
    task_status: "pending" | "completed" | null;
    completed_at: string | null;
    completed_local_date: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM entries
      WHERE profile_id = ?
        AND module = ?
        AND task_status = ?
        AND completed_local_date = ?
        AND deleted_at IS NULL
      ORDER BY completed_at ASC
    `,
    [
      DEFAULT_PROFILE_ID,
      ENTRY_MODULE.WORK,
      WORK_TASK_STATUS.COMPLETED,
      localDate,
    ],
  );

  return rows.map(mapEntry);
}

export async function listTrackedDates(
  client: DatabaseClient = db,
): Promise<{ lifeDates: string[]; workDates: string[] }> {
  const lifeDates = client
    .all<{ local_date: string }>(
      `
        SELECT DISTINCT local_date
        FROM entries
        WHERE profile_id = ?
          AND module = ?
          AND deleted_at IS NULL
        ORDER BY local_date ASC
      `,
      [DEFAULT_PROFILE_ID, ENTRY_MODULE.LIFE],
    )
    .map((row) => row.local_date);

  const workDates = client
    .all<{ completed_local_date: string }>(
      `
        SELECT DISTINCT completed_local_date
        FROM entries
        WHERE profile_id = ?
          AND module = ?
          AND task_status = ?
          AND completed_local_date IS NOT NULL
          AND deleted_at IS NULL
        ORDER BY completed_local_date ASC
      `,
      [DEFAULT_PROFILE_ID, ENTRY_MODULE.WORK, WORK_TASK_STATUS.COMPLETED],
    )
    .map((row) => row.completed_local_date);

  return { lifeDates, workDates };
}
