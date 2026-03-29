import { addDays, startOfWeek } from "date-fns";
import { test, expect } from "@playwright/test";

const TEST_USER_EMAIL = "test@example.com";
const TEST_USER_PASSWORD = "testpassword123";

test.beforeEach(async ({ page, request }) => {
  await request.post("/api/auth/register", {
    data: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
    failOnStatusCode: false,
  });

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(TEST_USER_EMAIL);
  await page.getByLabel("密码").fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("/");
});

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
  await page.goto("/?tab=work");
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  for (let index = 0; index < 3; index += 1) {
    const day = addDays(weekStart, index);
    await page.getByPlaceholder("任务标题").fill(`周报任务 ${index + 1}`);
    await page
      .getByPlaceholder("补充任务描述、会议纪要或进展背景。")
      .fill("通过测试用例创建");
    await page.getByRole("button", { name: "创建任务" }).click();
    await page.waitForSelector(`text=周报任务 ${index + 1}`);
    await page.getByRole("button", { name: new RegExp(`周报任务 ${index + 1}`) }).click();
    await page.waitForSelector(`text=任务状态已更新`);
  }

  await page.goto("/?tab=reports");
  await page.getByRole("button", { name: "一键生成本周周报" }).click();

  await expect(page.getByText("本周周报已生成。")).toBeVisible();
  await expect(page.getByText("已完成工作")).toBeVisible();
  await expect(page.getByText("周报任务 1")).toBeVisible();
});
