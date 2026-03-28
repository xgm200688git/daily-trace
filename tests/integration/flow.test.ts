import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createDatabaseClient } from "@/lib/db";
import { weekStartFromDateKey } from "@/lib/time";
import { createWorkTask, toggleWorkTaskStatus } from "@/features/diary/service";
import { generateDailyRecordsForDate, getDailyRecordByDate } from "@/features/merge/service";
import { generateWeeklyReportForWeek, getCurrentWeeklyReport } from "@/features/reports/service";
import {
  saveTemplateFromRawJson,
  setDefaultTemplate,
} from "@/features/templates/service";

function createIsolatedClient() {
  const folder = mkdtempSync(join(tmpdir(), "daily-trace-test-"));
  const databaseUrl = `file:${join(folder, "test.db")}`;

  return {
    folder,
    client: createDatabaseClient(databaseUrl),
  };
}

describe("integration flow", () => {
  it("includes only completed tasks in the work daily record", async () => {
    const { folder, client } = createIsolatedClient();

    try {
      await createWorkTask(
        {
          title: "已完成任务",
          description: "进入日报",
          status: "completed",
          occurredAt: new Date("2026-03-24T02:00:00.000Z"),
          completedAt: new Date("2026-03-24T02:00:00.000Z"),
        },
        client,
      );
      await createWorkTask(
        {
          title: "未完成任务",
          description: "不应进入日报",
        },
        client,
      );

      await generateDailyRecordsForDate("2026-03-24", client);
      const dailyRecord = await getDailyRecordByDate("2026-03-24", "work", client);

      expect(dailyRecord?.contentMarkdown).toContain("已完成任务");
      expect(dailyRecord?.contentMarkdown).not.toContain("未完成任务");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("creates a new weekly report revision when the default template changes", async () => {
    const { folder, client } = createIsolatedClient();

    try {
      for (const dateKey of ["2026-03-23", "2026-03-24", "2026-03-25"]) {
        await createWorkTask(
          {
            title: `任务 ${dateKey}`,
            description: "用于周报测试",
            status: "completed",
            occurredAt: new Date(`${dateKey}T02:00:00.000Z`),
            completedAt: new Date(`${dateKey}T02:00:00.000Z`),
          },
          client,
        );
        await generateDailyRecordsForDate(dateKey, client);
      }

      const weekStart = weekStartFromDateKey("2026-03-23");
      const firstReport = await generateWeeklyReportForWeek(weekStart, undefined, client);

      const customTemplate = await saveTemplateFromRawJson(
        JSON.stringify({
          version: 1,
          name: "极简模板",
          sections: [
            { key: "completedWork", title: "本周交付", type: "bullet" },
            { key: "nextPlan", title: "继续推进", type: "bullet" },
          ],
        }),
        "极简模板",
        undefined,
        client,
      );
      await setDefaultTemplate(customTemplate.id, client);
      const secondReport = await generateWeeklyReportForWeek(weekStart, undefined, client);

      expect(firstReport?.revision).toBe(1);
      expect(secondReport?.revision).toBe(2);
      expect(secondReport?.contentMarkdown).toContain("## 本周交付");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("does not create a new weekly report revision when nothing changed", async () => {
    const { folder, client } = createIsolatedClient();

    try {
      await createWorkTask(
        {
          title: "稳定生成",
          description: "校验重复生成",
          status: "completed",
          occurredAt: new Date("2026-03-24T02:00:00.000Z"),
          completedAt: new Date("2026-03-24T02:00:00.000Z"),
        },
        client,
      );

      await generateDailyRecordsForDate("2026-03-24", client);
      const weekStart = weekStartFromDateKey("2026-03-24");
      const firstReport = await generateWeeklyReportForWeek(weekStart, undefined, client);
      const secondReport = await generateWeeklyReportForWeek(weekStart, undefined, client);
      const weeklyCount = client.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM weekly_reports WHERE week_start = ?",
        [weekStart],
      );

      expect(firstReport?.revision).toBe(1);
      expect(secondReport?.revision).toBe(1);
      expect(secondReport?.id).toBe(firstReport?.id);
      expect(weeklyCount?.count).toBe(1);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("creates a new weekly report revision when editing the same template", async () => {
    const { folder, client } = createIsolatedClient();

    try {
      await createWorkTask(
        {
          title: "模板联动任务",
          description: "观察同一模板更新",
          status: "completed",
          occurredAt: new Date("2026-03-24T02:00:00.000Z"),
          completedAt: new Date("2026-03-24T02:00:00.000Z"),
        },
        client,
      );
      await generateDailyRecordsForDate("2026-03-24", client);

      const template = await saveTemplateFromRawJson(
        JSON.stringify({
          version: 1,
          name: "可编辑模板",
          sections: [
            { key: "completedWork", title: "初版标题", type: "bullet" },
            { key: "nextPlan", title: "继续推进", type: "bullet" },
          ],
        }),
        undefined,
        undefined,
        client,
      );
      await setDefaultTemplate(template.id, client);

      const weekStart = weekStartFromDateKey("2026-03-24");
      const firstReport = await generateWeeklyReportForWeek(weekStart, undefined, client);

      await saveTemplateFromRawJson(
        JSON.stringify({
          version: 2,
          name: "可编辑模板",
          sections: [
            { key: "completedWork", title: "更新后的标题", type: "bullet" },
            { key: "nextPlan", title: "继续推进", type: "bullet" },
          ],
        }),
        undefined,
        template.id,
        client,
      );

      const secondReport = await generateWeeklyReportForWeek(weekStart, undefined, client);

      expect(firstReport?.revision).toBe(1);
      expect(secondReport?.revision).toBe(2);
      expect(secondReport?.templateId).toBe(template.id);
      expect(secondReport?.contentMarkdown).toContain("## 更新后的标题");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("clears the current weekly report after the last completed task is reverted", async () => {
    const { folder, client } = createIsolatedClient();

    try {
      const task = await createWorkTask(
        {
          title: "唯一完成项",
          description: "之后会回退成未完成",
          status: "completed",
          occurredAt: new Date("2026-03-24T02:00:00.000Z"),
          completedAt: new Date("2026-03-24T02:00:00.000Z"),
        },
        client,
      );

      await generateDailyRecordsForDate("2026-03-24", client);
      const weekStart = weekStartFromDateKey("2026-03-24");
      const firstReport = await generateWeeklyReportForWeek(weekStart, undefined, client);

      await toggleWorkTaskStatus(task.id, client);
      await generateDailyRecordsForDate("2026-03-24", client);
      const nextResult = await generateWeeklyReportForWeek(weekStart, undefined, client);
      const currentReport = await getCurrentWeeklyReport(weekStart, client);
      const dailyRecord = await getDailyRecordByDate("2026-03-24", "work", client);

      expect(firstReport).not.toBeNull();
      expect(nextResult).toBeNull();
      expect(currentReport).toBeNull();
      expect(dailyRecord?.contentMarkdown).toContain("今天没有已完成的工作任务");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
