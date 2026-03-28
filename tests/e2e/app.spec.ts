import { addDays, startOfWeek } from "date-fns";
import { test, expect } from "@playwright/test";

import { createWorkTask } from "@/features/diary/service";
import { generateDailyRecordsForDate } from "@/features/merge/service";
import { weekStartFromDateKey, toLocalDateKey } from "@/lib/time";

test("可以创建生活记录", async ({ page }) => {
  await page.goto("/?tab=life");
  await page
    .getByPlaceholder("写下今天的片段、情绪或一句话。")
    .fill("今天晚上散步 30 分钟，脑子终于慢下来。");
  await page.getByRole("button", { name: "保存生活记录" }).click();

  await expect(page.getByText("生活记录已保存。")).toBeVisible();
  await expect(page.getByText("今天晚上散步 30 分钟")).toBeVisible();
});

test("可以创建并完成工作任务", async ({ page }) => {
  await page.goto("/?tab=work");
  await page.getByPlaceholder("任务标题").fill("补齐首页数据视图");
  await page
    .getByPlaceholder("补充任务描述、会议纪要或进展背景。")
    .fill("把生活、工作、报告三块数据接起来。");
  await page.getByRole("button", { name: "创建任务" }).click();
  await page.getByRole("button", { name: /补齐首页数据视图/ }).click();

  await expect(page.getByText("任务状态已更新。")).toBeVisible();
  await expect(page.getByText("1 项已完成")).toBeVisible();
});

test("可以生成本周周报", async ({ page }) => {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  for (let index = 0; index < 3; index += 1) {
    const day = addDays(weekStart, index);
    const dateKey = toLocalDateKey(day);

    await createWorkTask({
      title: `周报任务 ${index + 1}`,
      description: "通过脚本预置到数据库",
      status: "completed",
      occurredAt: day,
      completedAt: day,
    });
    await generateDailyRecordsForDate(dateKey);
  }

  await page.goto("/?tab=reports");
  await page.getByRole("button", { name: "一键生成本周周报" }).click();

  await expect(page.getByText("本周周报已生成。")).toBeVisible();
  await expect(page.getByText("已完成工作")).toBeVisible();
  await expect(page.getByText(`周报任务 1`)).toBeVisible();
  expect(weekStartFromDateKey(toLocalDateKey(new Date()))).toBeTruthy();
});
