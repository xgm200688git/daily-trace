import { addDays, startOfWeek } from "date-fns";
import { test, expect } from "@playwright/test";

import { createWorkTask } from "@/features/diary/service";
import { generateDailyRecordsForDate } from "@/features/merge/service";
import { weekStartFromDateKey, toLocalDateKey } from "@/lib/time";

test("提供手机安装所需的 PWA 元数据", async ({ page, request }) => {
  await page.goto("/");

  const manifestHref = await page.locator("link[rel='manifest']").getAttribute("href");
  expect(manifestHref).toBe("/manifest.webmanifest");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();

  expect(manifest.name).toBe("每日轨迹");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((icon: { sizes?: string }) => icon.sizes === "192x192")).toBeTruthy();
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBeTruthy();

  const swResponse = await request.get("/sw.js");
  expect(swResponse.ok()).toBeTruthy();
});

test("可以创建生活记录", async ({ page }) => {
  await page.goto("/?tab=life");
  await page
    .getByLabel("生活内容")
    .fill("今天晚上散步 30 分钟，脑子终于慢下来。");
  await page.getByRole("button", { name: "保存生活记录" }).click();

  await expect(page.getByText("生活记录已保存。")).toBeVisible();
  await expect(
    page.locator("p").filter({ hasText: "今天晚上散步 30 分钟" }).first(),
  ).toBeVisible();
});

test("可以创建并完成工作任务", async ({ page }) => {
  await page.goto("/?tab=work");
  await page.getByLabel("任务标题").fill("补齐首页数据视图");
  await page
    .getByLabel("任务描述")
    .fill("把生活、工作、报告三块数据接起来。");
  await page.getByRole("button", { name: "创建任务" }).click();
  await page.getByRole("button", { name: "标记完成" }).first().click();

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
  const weeklyPreview = page.locator("pre").filter({ hasText: "已完成工作" }).first();
  await expect(weeklyPreview).toBeVisible();
  await expect(weeklyPreview).toContainText("周报任务 1");
  expect(weekStartFromDateKey(toLocalDateKey(new Date()))).toBeTruthy();
});

test("手机视口不会出现横向溢出", async ({ page }) => {
  await page.goto("/?tab=reports");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(1);
});
