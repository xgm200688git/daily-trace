import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "mobile-chrome",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    command: "npm run db:reset && npm run dev:test",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
