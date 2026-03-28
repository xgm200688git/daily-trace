import { randomUUID } from "node:crypto";
import { subDays } from "date-fns";

import { listTrackedDates } from "@/features/diary/service";
import { generateDailyRecordsForDate } from "@/features/merge/service";
import { generateWeeklyReportForWeek } from "@/features/reports/service";
import { ensureProfileSettings } from "@/features/settings/service";
import { DEFAULT_PROFILE_ID, JOB_STATUS, JOB_TYPE } from "@/lib/constants";
import { db, nowIso, type DatabaseClient } from "@/lib/db";
import {
  todayKey,
  toLocalWeekStartKey,
  weekStartFromDateKey,
  yesterdayKey,
} from "@/lib/time";

async function markJobRun(
  jobType: string,
  jobKey: string,
  status: string,
  lastError: string | null,
  client: DatabaseClient,
) {
  const existing = client.get<{ id: string }>(
    "SELECT id FROM job_runs WHERE job_key = ? LIMIT 1",
    [jobKey],
  );
  const now = nowIso();

  if (existing) {
    client.run(
      `
        UPDATE job_runs
        SET type = ?, status = ?, last_error = ?, finished_at = ?, updated_at = ?, last_success_at = COALESCE(?, last_success_at)
        WHERE job_key = ?
      `,
      [
        jobType,
        status,
        lastError,
        now,
        now,
        status === JOB_STATUS.SUCCESS ? now : null,
        jobKey,
      ],
    );
    return;
  }

  client.run(
    `
      INSERT INTO job_runs (
        id,
        profile_id,
        type,
        job_key,
        status,
        last_success_at,
        last_error,
        started_at,
        finished_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      DEFAULT_PROFILE_ID,
      jobType,
      jobKey,
      status,
      status === JOB_STATUS.SUCCESS ? now : null,
      lastError,
      now,
      now,
      now,
      now,
    ],
  );
}

export async function runDailyCron(
  recordDate = yesterdayKey(),
  client: DatabaseClient = db,
) {
  try {
    await ensureProfileSettings(client);
    await generateDailyRecordsForDate(recordDate, client);
    await markJobRun(
      JOB_TYPE.DAILY_MERGE,
      `daily:${recordDate}`,
      JOB_STATUS.SUCCESS,
      null,
      client,
    );
  } catch (error) {
    await markJobRun(
      JOB_TYPE.DAILY_MERGE,
      `daily:${recordDate}`,
      JOB_STATUS.FAILED,
      error instanceof Error ? error.message : "未知错误",
      client,
    );
    throw error;
  }
}

export async function runWeeklyCron(
  referenceDate = new Date(),
  client: DatabaseClient = db,
) {
  let targetWeekStart = "";

  try {
    const profile = await ensureProfileSettings(client);
    targetWeekStart = toLocalWeekStartKey(
      subDays(referenceDate, 7),
      profile.timezone,
      profile.weekStartsOn,
    );
    await generateWeeklyReportForWeek(targetWeekStart, undefined, client);
    await markJobRun(
      JOB_TYPE.WEEKLY_REPORT,
      `weekly:${targetWeekStart}`,
      JOB_STATUS.SUCCESS,
      null,
      client,
    );
  } catch (error) {
    await markJobRun(
      JOB_TYPE.WEEKLY_REPORT,
      `weekly:${targetWeekStart}`,
      JOB_STATUS.FAILED,
      error instanceof Error ? error.message : "未知错误",
      client,
    );
    throw error;
  }
}

export async function reconcileOnAppOpen(client: DatabaseClient = db) {
  const profile = await ensureProfileSettings(client);
  const today = todayKey(profile.timezone);
  const trackedDates = await listTrackedDates(client);
  const derivedDates = client
    .all<{ record_date: string }>(
      `
        SELECT DISTINCT record_date
        FROM daily_records
        WHERE profile_id = ?
      `,
      [DEFAULT_PROFILE_ID],
    )
    .map((row) => row.record_date);
  const dates = Array.from(
    new Set([
      ...trackedDates.lifeDates,
      ...trackedDates.workDates,
      ...derivedDates,
      today,
    ]),
  ).sort();

  try {
    for (const date of dates) {
      await generateDailyRecordsForDate(date, client);
    }

    const weekStarts = Array.from(
      new Set(
        [
          ...trackedDates.workDates,
          ...derivedDates,
          ...client
            .all<{ week_start: string }>(
              `
                SELECT DISTINCT week_start
                FROM weekly_reports
                WHERE profile_id = ?
              `,
              [DEFAULT_PROFILE_ID],
            )
            .map((row) => row.week_start),
        ].map((date) => weekStartFromDateKey(date, profile.weekStartsOn)),
      ),
    ).sort();

    for (const weekStart of weekStarts) {
      await generateWeeklyReportForWeek(weekStart, undefined, client);
    }

    await markJobRun(
      JOB_TYPE.RECONCILE,
      `reconcile:${today}`,
      JOB_STATUS.SUCCESS,
      null,
      client,
    );
  } catch (error) {
    await markJobRun(
      JOB_TYPE.RECONCILE,
      `reconcile:${today}`,
      JOB_STATUS.FAILED,
      error instanceof Error ? error.message : "未知错误",
      client,
    );
    throw error;
  }
}
