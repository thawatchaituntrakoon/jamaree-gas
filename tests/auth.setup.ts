import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";

const STATE = "tests/.auth/user.json";

/** ล็อกอินครั้งเดียวแล้วเก็บ session ไว้ เทสต์อื่นจะได้ไม่ต้องล็อกอินซ้ำทุกไฟล์ */
setup("ล็อกอินเข้าระบบ", async ({ page }) => {
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;

  mkdirSync("tests/.auth", { recursive: true });

  if (!email || !password) {
    // ยังไม่ได้ตั้งค่าบัญชีทดสอบ — เขียนไฟล์เปล่าไว้ก่อน เทสต์จะได้ไม่ล้มตั้งแต่ยังไม่เริ่ม
    writeFileSync(STATE, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(
      true,
      "ยังไม่มี SUPABASE_EMAIL / SUPABASE_PASSWORD ในไฟล์ .env ที่โฟลเดอร์หลัก",
    );
    return;
  }

  await page.goto("/");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeHidden({
    timeout: 20_000,
  });

  await page.context().storageState({ path: STATE });
});
