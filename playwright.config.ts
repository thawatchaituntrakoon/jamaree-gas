import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// สั่งจากโฟลเดอร์หลักของโปรเจกต์เสมอ (ที่เดียวกับไฟล์นี้)
dotenv.config({ path: "jamaree-web/.env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // ทุกเทสต์ใช้ฐานข้อมูลก้อนเดียวกัน แย่งกันแก้ของจะเพี้ยน
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ล็อกอินรอบเดียว เก็บ session ไว้ให้ทุกเทสต์ใช้ต่อ
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    cwd: "jamaree-web",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
