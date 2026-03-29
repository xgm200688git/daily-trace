import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: false,
  },
  webServer: {
    command: "npm run db:reset && npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
