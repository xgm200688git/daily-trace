import { WORK_TASK_STATUS } from "@/lib/constants";
import { db, type DatabaseClient } from "@/lib/db";
import { listLifeEntriesByDate, listWorkTasksForDashboard, parseTags } from "@/features/diary/service";
import { getCurrentWeeklyReport, listWeeklyReportHistory } from "@/features/reports/service";
import { ensureProfileSettings } from "@/features/settings/service";
import { listTemplates } from "@/features/templates/service";
import { getDailyRecordByDate } from "@/features/merge/service";
import { todayKey, toLocalWeekStartKey } from "@/lib/time";

export async function getDashboardData(client: DatabaseClient = db) {
  const profile = await ensureProfileSettings(client);
  const today = todayKey(profile.timezone);
  const currentWeekStart = toLocalWeekStartKey(
    new Date(),
    profile.timezone,
    profile.weekStartsOn,
  );

  const [
    lifeEntries,
    workEntries,
    lifeRecord,
    workRecord,
    currentWeeklyReport,
    templates,
    weeklyHistory,
  ] = await Promise.all([
    listLifeEntriesByDate(today, client),
    listWorkTasksForDashboard(client),
    getDailyRecordByDate(today, "life", client),
    getDailyRecordByDate(today, "work", client),
    getCurrentWeeklyReport(currentWeekStart, client),
    listTemplates(client),
    listWeeklyReportHistory(client),
  ]);

  return {
    profile,
    today,
    currentWeekStart,
    lifeEntries: lifeEntries.map((entry) => ({
      ...entry,
      tags: parseTags(entry.tagsJson),
    })),
    pendingWorkTasks: workEntries.filter(
      (entry) => entry.taskStatus !== WORK_TASK_STATUS.COMPLETED,
    ),
    completedWorkTasks: workEntries.filter(
      (entry) => entry.taskStatus === WORK_TASK_STATUS.COMPLETED,
    ),
    dailyRecords: [lifeRecord, workRecord].filter(
      (record): record is NonNullable<typeof record> => record !== null,
    ),
    currentWeeklyReport,
    templates,
    weeklyHistory,
  };
}
