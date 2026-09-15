import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * QA อัตโนมัติ — เทียบของจริงบนหน้าเว็บกับไฟล์สำรองที่นำเข้าไป
 * สั่งจากโฟลเดอร์หลัก: npm run test:e2e
 */

const SOURCE_FILE = "JAMAREE GAS-2026-08-18.json";

interface LegacyProduct {
  sku: string;
  name: string;
  unit: string;
  kind: string;
  size?: string;
  stock: number;
  price: number;
  active?: boolean;
}

const imported: LegacyProduct[] = (
  JSON.parse(readFileSync(SOURCE_FILE, "utf8")).products ?? []
).filter((p: LegacyProduct) => p.active !== false);

/** ชนิดที่ตัดจากถังเก็บใหญ่หรือไม่นับสต๊อกเลย — ใช้ทดสอบการตัดสต๊อกตรง ๆ ไม่ได้ */
const NO_OWN_STOCK = ["น้ำแก๊ส", "หมุนเวียน", "บริการ", "ดิบ"];

/** อ่านตัวเลขไทยบนหน้าจอ เช่น "1,250.50 ถัง" → 1250.5 */
function parseQty(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** ค้นหาสินค้าในตาราง แล้วอ่านช่อง "คงเหลือ" ของแถวนั้น */
async function readStock(page: Page, name: string): Promise<number | null> {
  await page.goto("/products");
  await page.getByLabel("ค้นหาสินค้า").fill(name);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
  await expect(row).toHaveCount(1);
  return parseQty(await row.getByRole("cell").nth(1).innerText());
}

async function orderLinks(page: Page): Promise<string[]> {
  return page
    .locator('a[href^="/orders/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
}

test.describe("ระบบหลัก", () => {
  test("สินค้าที่นำเข้ามาแสดงครบในหน้าสินค้า", async ({ page }) => {
    expect(
      imported.length,
      `ไม่พบสินค้าในไฟล์ ${SOURCE_FILE} — เทสต์นี้ต้องมีข้อมูลต้นทาง`,
    ).toBeGreaterThan(0);

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "สินค้า" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 20_000 });

    const missing: string[] = [];
    for (const p of imported) {
      const link = page.getByRole("link", { name: p.name, exact: true });
      if ((await link.count()) === 0) missing.push(`${p.sku} · ${p.name}`);
    }
    expect(
      missing,
      `สินค้าเหล่านี้ยังไม่อยู่ในระบบ (สั่ง npm run import:products หรือยัง?):\n${missing.join("\n")}`,
    ).toEqual([]);

    // เช็คว่าไม่ได้แค่ชื่อเข้า — ราคาที่แมปไว้ต้องตรงด้วย
    for (const p of imported.slice(0, 3)) {
      const row = page
        .getByRole("row")
        .filter({ has: page.getByRole("link", { name: p.name, exact: true }) });
      const price = parseQty(await row.getByRole("cell").nth(3).innerText());
      expect(price, `ราคาของ "${p.name}" ไม่ตรงกับไฟล์ต้นทาง`).toBe(p.price);
    }
  });

  test("เปิดบิลแล้วปิดบิล — สต๊อกต้องถูกตัด", async ({ page }) => {
    // ต้องเป็นสินค้าที่มีสต๊อกของตัวเอง ไม่งั้นระบบจะไปตัดกิโลจากถังเก็บใหญ่แทน
    const candidates = imported.filter((p) => !NO_OWN_STOCK.includes(p.kind));

    let target: LegacyProduct | null = null;
    let before = 0;
    for (const p of candidates) {
      const stock = await readStock(page, p.name);
      if (stock !== null && stock >= 1) {
        target = p;
        before = stock;
        break;
      }
    }
    test.skip(
      !target,
      "ไม่มีสินค้าที่มีของเหลือในสต๊อก — รับของเข้าก่อนแล้วค่อยรันใหม่",
    );
    const product = target!;

    await page.goto("/orders");
    const linksBefore = await orderLinks(page);

    await test.step("เปิดบิลใหม่", async () => {
      await page.getByRole("button", { name: "เปิดบิลใหม่" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const select = dialog.getByLabel("สินค้าบรรทัดที่ 1");
      const value = await select
        .locator("option")
        .filter({ hasText: product.name })
        .first()
        .getAttribute("value");
      expect(value, `ไม่เจอ "${product.name}" ในดรอปดาวน์สินค้า`).toBeTruthy();
      await select.selectOption(value!);
      await dialog.getByLabel("จำนวนบรรทัดที่ 1").fill("1");

      await dialog.getByRole("button", { name: "บันทึกบิล" }).click();
      await expect(dialog).toBeHidden({ timeout: 15_000 });
    });

    const linksAfter = await orderLinks(page);
    const created = linksAfter.find((href) => !linksBefore.includes(href));
    expect(created, "บันทึกบิลแล้วแต่ไม่เห็นบิลใหม่ในตาราง").toBeTruthy();

    await page.goto(created!);
    await expect(page.getByText(product.name).first()).toBeVisible();

    await test.step("ปิดบิล & ตัดสต๊อก", async () => {
      const close = page.getByRole("button", { name: "ปิดบิล & ตัดสต๊อก" });
      await close.click();
      await expect(close).toBeHidden({ timeout: 20_000 });
    });

    const after = await readStock(page, product.name);
    expect(
      after,
      `"${product.name}" ควรเหลือ ${before - 1} หลังปิดบิล 1 ${product.unit}`,
    ).toBe(before - 1);

    // คืนของกลับสต๊อก ไม่งั้นรันเทสต์ซ้ำ ๆ ของในคลังจะหายไปเรื่อย ๆ
    await test.step("ยกเลิกบิลทดสอบแล้วสต๊อกต้องกลับมาเท่าเดิม", async () => {
      await page.goto(created!);
      await page
        .getByRole("button", { name: "ยกเลิกบิล", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "ยืนยันยกเลิกบิล" }).click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });
      await expect(page.getByText("ยกเลิกแล้ว").first()).toBeVisible();

      expect(await readStock(page, product.name)).toBe(before);
    });
  });
});
