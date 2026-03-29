"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createLifeEntry,
  createWorkTask,
  getEntryById,
  normalizeTags,
  softDeleteEntry,
  toggleWorkTaskStatus,
  updateLifeEntry,
  updateWorkTask,
} from "@/features/diary/service";
import { generateDailyRecord } from "@/features/merge/service";
import { generateWeeklyReportForWeek } from "@/features/reports/service";
import { ensureProfileSettings, setAiEnabled } from "@/features/settings/service";
import { saveTemplateFromRawJson, setDefaultTemplate } from "@/features/templates/service";
import {
  fromDateTimeLocalValue,
  todayKey,
  toLocalWeekStartKey,
  weekStartFromDateKey,
} from "@/lib/time";
import { requireCurrentUserDbClient } from "@/lib/auth";

function withStatus(tab: string, message: string, tone: "success" | "error") {
  const params = new URLSearchParams({
    tab,
    message,
    tone,
  });

  return `/?${params.toString()}`;
}

async function resolveWeekStart(dateKey: string, client: import("@/lib/db").DatabaseClient) {
  const profile = await ensureProfileSettings(client);
  return weekStartFromDateKey(dateKey, profile.weekStartsOn);
}

async function parseDateInput(value: FormDataEntryValue | null, client: import("@/lib/db").DatabaseClient): Promise<Date | undefined> {
  if (!value || typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const profile = await ensureProfileSettings(client);
    return fromDateTimeLocalValue(value, profile.timezone);
  } catch {
    return undefined;
  }
}

export async function createLifeEntryAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const content = String(formData.get("content") || "").trim();

  if (!content) {
    redirect(withStatus("life", "生活记录不能为空。", "error"));
  }

  const entry = await createLifeEntry(
    {
      content,
      mood: String(formData.get("mood") || "").trim() || undefined,
      tags: normalizeTags(String(formData.get("tags") || "")),
      occurredAt: await parseDateInput(formData.get("occurredAt"), client),
    },
    client,
  );
  await generateDailyRecord(entry.localDate, "life", client);

  revalidatePath("/");
  redirect(withStatus("life", "生活记录已保存。", "success"));
}

export async function updateLifeEntryAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const entryId = String(formData.get("entryId") || "");
  const content = String(formData.get("content") || "").trim();

  if (!entryId || !content) {
    redirect(withStatus("life", "生活记录更新失败。", "error"));
  }

  const entry = await updateLifeEntry(
    entryId,
    {
      content,
      mood: String(formData.get("mood") || "").trim() || undefined,
      tags: normalizeTags(String(formData.get("tags") || "")),
      occurredAt: await parseDateInput(formData.get("occurredAt"), client),
    },
    client,
  );
  await generateDailyRecord(entry.localDate, "life", client);

  revalidatePath("/");
  redirect(withStatus("life", "生活记录已更新。", "success"));
}

export async function createWorkTaskAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const title = String(formData.get("title") || "").trim();

  if (!title) {
    redirect(withStatus("work", "任务标题不能为空。", "error"));
  }

  await createWorkTask(
    {
      title,
      description: String(formData.get("description") || "").trim() || undefined,
    },
    client,
  );

  revalidatePath("/");
  redirect(withStatus("work", "工作任务已创建。", "success"));
}

export async function updateWorkTaskAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const entryId = String(formData.get("entryId") || "");
  const title = String(formData.get("title") || "").trim();

  if (!entryId || !title) {
    redirect(withStatus("work", "任务更新失败。", "error"));
  }

  const task = await updateWorkTask(
    entryId,
    {
      title,
      description: String(formData.get("description") || "").trim() || undefined,
    },
    client,
  );

  if (task.completedLocalDate) {
    await generateDailyRecord(task.completedLocalDate, "work", client);
    await generateWeeklyReportForWeek(await resolveWeekStart(task.completedLocalDate, client), {}, client);
  }

  revalidatePath("/");
  redirect(withStatus("work", "任务已更新。", "success"));
}

export async function toggleWorkTaskStatusAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const entryId = String(formData.get("entryId") || "");

  if (!entryId) {
    redirect(withStatus("work", "任务状态切换失败。", "error"));
  }

  const previous = await getEntryById(entryId, client);
  const updated = await toggleWorkTaskStatus(entryId, client);

  const affectedDates = Array.from(
    new Set(
      [previous.completedLocalDate, updated.completedLocalDate].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );

  for (const date of affectedDates) {
    await generateDailyRecord(date, "work", client);
    await generateWeeklyReportForWeek(await resolveWeekStart(date, client), {}, client);
  }

  revalidatePath("/");
  redirect(withStatus("work", "任务状态已更新。", "success"));
}

export async function deleteEntryAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const entryId = String(formData.get("entryId") || "");
  const tab = String(formData.get("tab") || "life");

  if (!entryId) {
    redirect(withStatus(tab, "删除失败。", "error"));
  }

  const entry = await getEntryById(entryId, client);
  await softDeleteEntry(entryId, client);

  if (entry.module === "life") {
    await generateDailyRecord(entry.localDate, "life", client);
  }

  if (entry.module === "work") {
    const affectedDate = entry.completedLocalDate ?? entry.localDate;
    await generateDailyRecord(affectedDate, "work", client);
    await generateWeeklyReportForWeek(await resolveWeekStart(affectedDate, client), {}, client);
  }

  revalidatePath("/");
  redirect(withStatus(tab, "记录已删除。", "success"));
}

export async function generateCurrentWeekReportAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const profile = await ensureProfileSettings(client);
  const weekStart =
    String(formData.get("weekStart") || "").trim() ||
    toLocalWeekStartKey(new Date(), profile.timezone, profile.weekStartsOn);
  const templateId = String(formData.get("templateId") || "").trim() || undefined;

  const report = await generateWeeklyReportForWeek(weekStart, { templateId }, client);
  revalidatePath("/");
  redirect(
    withStatus(
      "reports",
      report ? "本周周报已生成。" : "当前周还没有已完成任务，暂无可生成内容。",
      report ? "success" : "error",
    ),
  );
}

export async function saveTemplateAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const rawJson = String(formData.get("definitionJson") || "").trim();

  if (!rawJson) {
    redirect(withStatus("reports", "模板 JSON 不能为空。", "error"));
  }

  try {
    await saveTemplateFromRawJson(
      rawJson,
      String(formData.get("name") || "").trim() || undefined,
      String(formData.get("templateId") || "").trim() || undefined,
      client,
    );
  } catch (error) {
    redirect(
      withStatus(
        "reports",
        error instanceof Error ? error.message : "模板保存失败。",
        "error",
      ),
    );
  }

  revalidatePath("/");
  redirect(withStatus("reports", "模板已保存。", "success"));
}

export async function setDefaultTemplateAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  const templateId = String(formData.get("templateId") || "");

  if (!templateId) {
    redirect(withStatus("reports", "默认模板设置失败。", "error"));
  }

  await setDefaultTemplate(templateId, client);
  revalidatePath("/");
  redirect(withStatus("reports", "默认模板已切换。", "success"));
}

export async function toggleAiAction(formData: FormData) {
  const client = await requireCurrentUserDbClient();
  await setAiEnabled(formData.get("aiEnabled") === "on", client);
  revalidatePath("/");
  redirect(withStatus("reports", "AI 设置已更新。", "success"));
}

export async function jumpToTodayAction() {
  const client = await requireCurrentUserDbClient();
  const profile = await ensureProfileSettings(client);
  redirect(`/?tab=life&today=${todayKey(profile.timezone)}`);
}
