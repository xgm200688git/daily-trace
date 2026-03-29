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
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 30000 });
});

test("可以创建生活记录", async ({ page }) => {
  await page.goto("/?tab=life");
  const testContent = "测试生活记录 " + Date.now();
  await page
    .getByPlaceholder("写下今天的片段、情绪或一句话。")
    .fill(testContent);
  await page.getByRole("button", { name: "保存生活记录" }).click();

  await expect(page.getByText("生活记录已保存。")).toBeVisible();
  await expect(page.locator('p').filter({ hasText: testContent }).first()).toBeVisible();
});

test("可以创建并完成工作任务", async ({ page }) => {
  await page.goto("/?tab=work");
  const testTitle = "测试工作任务 " + Date.now();
  await page.getByPlaceholder("任务标题").fill(testTitle);
  await page
    .getByPlaceholder("补充任务描述、会议纪要或进展背景。")
    .fill("测试描述");
  await page.getByRole("button", { name: "创建任务" }).click();
  
  await page.waitForSelector(`text=${testTitle}`);
  await page.getByRole("button", { name: new RegExp(`○ ${testTitle}`) }).first().click();
});

test("可以生成本周周报", async ({ page }) => {
  await page.goto("/?tab=work");

  for (let index = 0; index < 3; index += 1) {
    const taskTitle = `周报测试任务 ${Date.now()}-${index}`;
    await page.getByPlaceholder("任务标题").fill(taskTitle);
    await page
      .getByPlaceholder("补充任务描述、会议纪要或进展背景。")
      .fill("通过测试用例创建");
    await page.getByRole("button", { name: "创建任务" }).click();
    await page.waitForSelector(`text=${taskTitle}`);
    await page.getByRole("button", { name: new RegExp(`○ ${taskTitle}`) }).first().click();
  }

  await page.goto("/?tab=reports");
  await page.getByRole("button", { name: "一键生成本周周报" }).click();

  await expect(page.getByText("本周周报已生成。")).toBeVisible();
});
