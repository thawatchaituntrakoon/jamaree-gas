import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * QA ตรวจซ้ำหลังแก้ตรรกะธุรกิจรอบใหญ่ — ไล่ทีละเรื่องตามที่แก้ไป
 * สั่งจากโฟลเดอร์หลัก: npx playwright test tests/qa-bugfixes-validation.spec.ts
 *
 * ⚠️ เทสต์ชุดนี้แก้ข้อมูลจริงในฐานที่ต่ออยู่ — Step 4 ทำหน้าที่คืนของกลับให้ครบ
 *    ห้ามเปิด fullyParallel เด็ดขาด (playwright.config.ts ปิดไว้แล้ว)
 */

const SOURCE_FILE = "JAMAREE GAS-2026-08-18.json";

interface SeedProduct {
  sku: string;
  name: string;
  kind: string;
  size?: string;
  active?: boolean;
}

const seeded: SeedProduct[] = (
  JSON.parse(readFileSync(SOURCE_FILE, "utf8")).products ?? []
).filter((p: SeedProduct) => p.active !== false);

/** หาชื่อสินค้าจากชนิด+ขนาด — เทสต์อ้างชนิดของจริง ไม่ผูกกับชื่อที่เจ้าของเปลี่ยนได้ */
function nameOf(kind: string, size?: string): string | null {
  const hit = seeded.find(
    (p) => p.kind === kind && (size === undefined || p.size === size),
  );
  return hit?.name ?? null;
}

const RAW = nameOf("ดิบ");
const NEW_4 = nameOf("ใหม่", "4kg");
const GAS_15 = nameOf("น้ำแก๊ส", "15kg");
const EMPTY_15 = nameOf("เปล่า", "15kg");

/** ถ้ามีสินค้าชนิด "เต็ม" ขนาดนี้ complete_order จะตัดถังเต็มแทนแก๊สดิบ — สูตร Step 3 จะไม่ตรง */
const FULL_15 = nameOf("เต็ม", "15kg");

const FILL_4 = 4;
const FILL_15 = 15;
const SIZE_15 = "15kg";

/** สต๊อกตั้งต้นก่อนเริ่มขาย — Step 4 เอาไว้เช็คว่ายกเลิกบิลแล้วคืนของครบ */
const base = { raw: 0, new4: 0, empty15: 0 };

/** บิลที่เทสต์เปิดไว้ ต้องยกเลิกให้หมดใน Step 4 ไม่งั้นของในคลังจะหายทุกรอบที่รัน */
const created: string[] = [];

/** อ่านตัวเลขไทยบนหน้าจอ เช่น "1,250.50 ถัง" → 1250.5 */
function parseQty(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** ค้นหาสินค้าในตาราง แล้วอ่านช่อง "คงเหลือ" ของแถวนั้น */
async function readStock(page: Page, name: string): Promise<number> {
  await page.goto("/products");
  await page.getByLabel("ค้นหาสินค้า").fill(name);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
  await expect(row, `ไม่เจอสินค้า "${name}" ในหน้าสินค้า`).toHaveCount(1);
  const qty = parseQty(await row.getByRole("cell").nth(1).innerText());
  expect(qty, `อ่านคงเหลือของ "${name}" ไม่ออก`).not.toBeNull();
  return qty!;
}

/**
 * ขายหน้าร้านแบบลูกค้าจร จ่ายสดเต็มจำนวน 1 หน่วย
 * คืนค่า id ของบิลที่เพิ่งปิด (อ่านจาก payload ที่ยิงเข้า complete_order)
 */
async function sellWalkIn(page: Page, productName: string): Promise<string> {
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "ขายหน้าร้าน" })).toBeVisible({
    timeout: 30_000,
  });

  // ตะกร้าเก็บค้างใน localStorage — เคลียร์ก่อนเสมอ ไม่งั้นของรอบก่อนติดมาด้วย
  const clear = page.getByRole("button", { name: "ล้างบิล" });
  if (await clear.count()) await clear.click();

  await page.getByPlaceholder("ค้นหาสินค้า…").fill(productName);
  const tile = page
    .getByRole("button")
    .filter({ hasText: productName })
    .first();
  await expect(tile, `ไม่เจอปุ่มสินค้า "${productName}" ใน POS`).toBeVisible();
  await tile.click();

  // ลูกค้าจรค้างบิลไม่ได้ ปุ่มปิดการขายจะถูกล็อก — ต้องจ่ายสดให้ครบก่อน
  await page.getByRole("button", { name: "เต็มจำนวน" }).first().click();

  const rpc = page.waitForResponse(
    (r) =>
      r.url().includes("/rpc/complete_order") &&
      r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /ปิดการขาย/ }).click();
  const res = await rpc;
  expect(res.ok(), `ปิดการขายไม่สำเร็จ (HTTP ${res.status()})`).toBeTruthy();

  await expect(page.getByText("ขายสำเร็จ")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "ขายบิลใหม่" }).click();

  const payload = JSON.parse(res.request().postData() ?? "{}");
  const orderId: string = payload.p_order_id ?? "";
  expect(
    orderId,
    "ไม่รู้ว่าบิลไหนถูกปิด — อ่าน p_order_id ไม่ได้",
  ).toBeTruthy();
  created.push(orderId);
  return orderId;
}

/** ยกเลิกบิลจากหน้าออเดอร์ (แท็บ "ทั้งหมด" เพราะบิลปิดแล้วไม่โผล่ในค้างส่ง) */
async function voidOrder(page: Page, orderId: string): Promise<void> {
  await page.goto("/orders");
  await page.getByRole("button", { name: "ทั้งหมด", exact: true }).click();

  const row = page
    .getByRole("row")
    .filter({ has: page.locator(`a[href="/orders/${orderId}"]`) });
  await expect(row, `ไม่เจอบิล ${orderId} ในตารางออเดอร์`).toHaveCount(1);

  const voidBtn = row.getByRole("button", { name: "ยกเลิกบิล", exact: true });
  await expect(
    voidBtn,
    "ไม่มีปุ่มยกเลิกบิล — บัญชีที่ล็อกอินต้องเป็น SUPER_ADMIN หรือ MANAGER",
  ).toHaveCount(1);
  await voidBtn.click();

  const dialog = page.getByRole("dialog");
  const rpc = page.waitForResponse(
    (r) =>
      r.url().includes("/rpc/void_order") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await dialog.getByRole("button", { name: "ยืนยันยกเลิกบิล" }).click();
  const res = await rpc;
  expect(res.ok(), `ยกเลิกบิลไม่สำเร็จ (HTTP ${res.status()})`).toBeTruthy();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("ตรวจซ้ำตรรกะที่เพิ่งแก้", () => {
  // ------------------------------------------------------------------
  test("1. สั่งแก๊สดิบเกินความจุถังเก็บใหญ่ต้องถูกบล็อก", async ({ page }) => {
    test.skip(!RAW, `ไม่มีสินค้าชนิด "ดิบ" ในไฟล์ ${SOURCE_FILE}`);

    await page.goto("/purchases");
    const newPo = page.getByRole("button", { name: "เปิดใบสั่งซื้อ" });
    await expect(newPo).toBeVisible({ timeout: 20_000 });
    test.skip(
      await newPo.isDisabled(),
      "ยังไม่มีผู้ขายในระบบ — เพิ่มผู้ขายก่อนแล้วค่อยรันใหม่",
    );
    await newPo.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // ต้องเลือกผู้ขายก่อน ไม่งั้นปุ่มบันทึกถูกล็อกด้วยเหตุผลอื่น แยกไม่ออกว่าด่านความจุทำงานจริงไหม
    const vendor = dialog.getByLabel("ผู้ขาย");
    const vendorId = await vendor
      .locator("option")
      .nth(1)
      .getAttribute("value");
    expect(vendorId, "ดรอปดาวน์ผู้ขายว่าง").toBeTruthy();
    await vendor.selectOption(vendorId!);

    const picker = dialog.getByLabel("เลือกสินค้า").first();
    const rawId = await picker
      .locator("option")
      .filter({ hasText: RAW! })
      .first()
      .getAttribute("value");
    expect(
      rawId,
      `ไม่เจอ "${RAW}" ในดรอปดาวน์สินค้าของใบสั่งซื้อ`,
    ).toBeTruthy();
    await picker.selectOption(rawId!);
    await dialog.getByLabel("จำนวน").first().fill("999999");

    await expect(
      dialog.getByText("สั่งแก๊สดิบเกินความจุถังเก็บใหญ่"),
      "ไม่ขึ้นคำเตือนเกินความจุ — ตั้งค่า “ความจุถังเก็บใหญ่” ในหน้าตั้งค่าหรือยัง?",
    ).toBeVisible();

    const save = dialog.getByRole("button", { name: "บันทึก", exact: true });
    await expect(
      save,
      "ปุ่มบันทึกต้องถูกล็อกเมื่อสั่งเกินความจุ",
    ).toBeDisabled();

    // กดจริงอีกทีเพื่อยืนยันว่าไม่มีทางหลุดไปบันทึกได้
    await save.click({ force: true });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  // ------------------------------------------------------------------
  test("2. ขายถังใหม่ 4kg — ถังหาย 1 ใบ แก๊สดิบหาย 4 กก.", async ({ page }) => {
    test.skip(
      !RAW || !NEW_4 || !EMPTY_15,
      "ไฟล์ต้นทางไม่มีสินค้าครบ (ดิบ / ใหม่ 4kg / เปล่า 15kg)",
    );

    base.raw = await readStock(page, RAW!);
    base.new4 = await readStock(page, NEW_4!);
    base.empty15 = await readStock(page, EMPTY_15!);

    test.skip(
      base.new4 < 1 || base.raw < FILL_4 + FILL_15,
      `ของไม่พอให้ทดสอบ (ถังใหม่ ${base.new4} ใบ · แก๊สดิบ ${base.raw} กก.) — รับของเข้าก่อน`,
    );

    await sellWalkIn(page, NEW_4!);

    expect(
      await readStock(page, NEW_4!),
      `"${NEW_4}" ควรเหลือ ${base.new4 - 1} หลังขาย 1 ใบ`,
    ).toBe(base.new4 - 1);
    expect(
      await readStock(page, RAW!),
      `แก๊สดิบควรเหลือ ${base.raw - FILL_4} กก. (บรรจุใส่ถังใหม่ไป ${FILL_4} กก.)`,
    ).toBe(base.raw - FILL_4);
    expect(
      await readStock(page, EMPTY_15!),
      "ขายถังใหม่ไม่ได้รับถังเปล่าคืน ยอดถังเปล่าต้องไม่ขยับ",
    ).toBe(base.empty15);
  });

  // ------------------------------------------------------------------
  test("3. ขายแก๊ส 15 กก. — แก๊สดิบหาย 15 กก. ได้ถังเปล่าคืน 1 ใบ", async ({
    page,
  }) => {
    test.skip(
      !RAW || !GAS_15 || !EMPTY_15,
      "ไฟล์ต้นทางไม่มีสินค้าครบ (ดิบ / น้ำแก๊ส 15kg / เปล่า 15kg)",
    );
    test.skip(
      !!FULL_15,
      `มีสินค้า "ถังเต็ม" ขนาด ${SIZE_15} อยู่ — ระบบจะตัดถังเต็มแทนแก๊สดิบ สูตรของเทสต์นี้ใช้ไม่ได้`,
    );

    const beforeRaw = await readStock(page, RAW!);
    const beforeEmpty = await readStock(page, EMPTY_15!);

    test.skip(
      beforeRaw < FILL_15,
      `แก๊สดิบเหลือแค่ ${beforeRaw} กก. ไม่พอบรรจุ ${FILL_15} กก.`,
    );

    await sellWalkIn(page, GAS_15!);

    expect(
      await readStock(page, RAW!),
      `แก๊สดิบควรเหลือ ${beforeRaw - FILL_15} กก.`,
    ).toBe(beforeRaw - FILL_15);
    expect(
      await readStock(page, EMPTY_15!),
      `ถังแลกถัง — "${EMPTY_15}" ควรเพิ่มเป็น ${beforeEmpty + 1} ใบ`,
    ).toBe(beforeEmpty + 1);
  });

  // ------------------------------------------------------------------
  test("4. ยกเลิกบิลแล้วสต๊อกต้องกลับมาเท่าเดิมทุกตัว", async ({ page }) => {
    test.skip(
      created.length === 0,
      "ไม่มีบิลที่เทสต์ก่อนหน้าเปิดไว้ — ไม่มีอะไรให้ยกเลิก",
    );

    for (const id of created) await voidOrder(page, id);

    expect(await readStock(page, RAW!), "แก๊สดิบไม่กลับมาเท่าเดิม").toBe(
      base.raw,
    );
    expect(await readStock(page, NEW_4!), `"${NEW_4}" ไม่กลับมาเท่าเดิม`).toBe(
      base.new4,
    );
    expect(
      await readStock(page, EMPTY_15!),
      `"${EMPTY_15}" ไม่กลับมาเท่าเดิม — ถังเปล่าที่รับคืนตอนขายต้องถูกหักออกด้วย`,
    ).toBe(base.empty15);

    created.length = 0;
  });

  // ------------------------------------------------------------------
  test("5. ลูกค้าฝากถัง 15kg 2 ใบ — ยอดฝากต้องเพิ่ม 2", async ({ page }) => {
    await page.goto("/customers");
    const firstCustomer = page.locator('a[href^="/customers/"]').first();
    await expect(firstCustomer, "ยังไม่มีลูกค้าในระบบ").toBeVisible({
      timeout: 20_000,
    });
    await firstCustomer.click();

    await expect(page.getByText("บัญชีถังของลูกค้า")).toBeVisible({
      timeout: 20_000,
    });

    /** อ่านยอดฝากจากคำใบ้ใต้ช่องจำนวน — "ตอนนี้ยืมไป x ถัง · ฝากไว้ y ถัง" */
    async function readDeposited(): Promise<number> {
      await page.getByRole("button", { name: "บันทึกรายการถัง" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("ขนาดถัง").selectOption(SIZE_15);
      const hint = await dialog
        .getByText(/ฝากไว้\s*[\d,.]+\s*ถัง/)
        .last()
        .innerText();
      const n = parseQty(hint.split("ฝากไว้")[1] ?? "");
      expect(n, "อ่านยอดฝากถังไม่ออก").not.toBeNull();
      return n!;
    }

    const before = await readDeposited();

    // ยังอยู่ในฟอร์มที่เพิ่งเปิด — กรอกต่อได้เลย
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("รายการ").selectOption("ฝาก");
    await dialog.getByLabel("จำนวน (ถัง)").fill("2");
    await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    await expect(
      page.getByRole("cell", { name: "ฝาก", exact: true }).first(),
      "ไม่เห็นรายการฝากถังในประวัติ",
    ).toBeVisible();

    expect(
      await readDeposited(),
      `ยอดฝาก ${SIZE_15} ควรเพิ่มเป็น ${before + 2}`,
    ).toBe(before + 2);

    // คืนสภาพ — ถอนฝากกลับ 2 ใบ ไม่งั้นรันซ้ำแล้วยอดบวกไปเรื่อย ๆ
    const back = page.getByRole("dialog");
    await back.getByLabel("ขนาดถัง").selectOption(SIZE_15);
    await back.getByLabel("รายการ").selectOption("ถอนฝาก");
    await back.getByLabel("จำนวน (ถัง)").fill("2");
    await back.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(back).toBeHidden({ timeout: 20_000 });
  });

  // ------------------------------------------------------------------
  test("6. ตั้งยอดยกมาถังเก็บใหญ่ — ตัวเลขบนการ์ดต้องขยับทันทีโดยไม่รีโหลด", async ({
    page,
  }) => {
    test.skip(!RAW, `ไม่มีสินค้าชนิด "ดิบ" ในไฟล์ ${SOURCE_FILE}`);

    await page.goto("/");
    // ยอดกิโลบนการ์ด = <p> ถัดจากหัวข้อ "แก๊สในถังเก็บใหญ่" — ค่าเดียวกันกับที่ป้อนกราฟวงกลม
    const amount = page.locator('p:text-is("แก๊สในถังเก็บใหญ่") + p');
    const adjustBtn = page.getByRole("button", {
      name: "ตั้งค่ายอดยกมา / ปรับปรุงสต๊อก",
    });
    await expect(amount, "ไม่เห็นตัวเลขแก๊สบนการ์ดถังเก็บใหญ่").toBeVisible({
      timeout: 30_000,
    });

    const before = parseQty(await amount.innerText());
    expect(before, "อ่านยอดแก๊สบนการ์ดไม่ออก").not.toBeNull();
    const target = before! + 7;

    /** เปิดฟอร์มปรับยอด กรอก แล้วบันทึก — ไม่รีโหลดหน้าระหว่างทาง */
    async function setVolume(kg: number, reason: string) {
      await adjustBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("ยอดจริงในถัง (กิโล)").fill(String(kg));
      await dialog.getByLabel("เหตุผล", { exact: true }).selectOption(reason);
      await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });
    }

    await test.step("ยอดเท่าเดิมต้องบันทึกไม่ได้", async () => {
      await adjustBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("ยอดเท่าเดิม ไม่ต้องปรับ")).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "บันทึก", exact: true }),
      ).toBeDisabled();
      await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
      await expect(dialog).toBeHidden();
    });

    await setVolume(target, "ยอดยกมาเริ่มต้น");

    // ไม่มี page.reload() ตรงนี้โดยตั้งใจ — ต้องเห็นเลขใหม่จาก state ที่รีเฟรชเอง
    await expect
      .poll(async () => parseQty(await amount.innerText()), {
        message:
          "ตัวเลขบนการ์ดไม่ขยับทันทีหลังบันทึก (กราฟวงกลมใช้ค่าเดียวกัน)",
        timeout: 15_000,
      })
      .toBe(target);

    await test.step("มีรายการปรับสต๊อกไว้ตามรอยย้อนหลัง", async () => {
      await page.goto("/products");
      await page.getByLabel("ค้นหาสินค้า").fill(RAW!);
      await page.getByRole("link", { name: RAW!, exact: true }).click();
      const row = page
        .getByRole("row")
        .filter({ hasText: "ยอดยกมาเริ่มต้น" })
        .first();
      await expect(row, "ไม่เจอรายการปรับสต๊อกในประวัติสินค้า").toBeVisible({
        timeout: 20_000,
      });
      await expect(row.getByText("ปรับเพิ่ม")).toBeVisible();
    });

    // คืนสภาพ — ปรับกลับไปเท่าเดิม
    await page.goto("/");
    await expect(amount).toBeVisible({ timeout: 30_000 });
    await setVolume(before!, "แก้ตัวเลขที่คีย์ผิด");
    expect(parseQty(await amount.innerText())).toBe(before);
  });
});
