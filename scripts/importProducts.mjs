/**
 * ย้าย "สินค้า" จากไฟล์สำรองเดิมของ erp.html ขึ้นตาราง products บน Supabase
 *
 * วิธีใช้ (สั่งจากโฟลเดอร์หลักของโปรเจกต์):
 *   node scripts/importProducts.mjs --dry-run      ดูก่อนว่าจะเข้ากี่ตัว ยังไม่เขียนจริง
 *   node scripts/importProducts.mjs                นำเข้าเฉพาะ sku ที่ยังไม่มีในฐานข้อมูล
 *   node scripts/importProducts.mjs --update       ของที่มีอยู่แล้ว ให้ทับชื่อ/ราคา/ต้นทุนด้วย
 *   node scripts/importProducts.mjs --file "อีกไฟล์.json"
 *
 * ⚠️ กติกาเหล็กที่สคริปต์นี้เคารพ:
 *   • จำนวนคงเหลือ (stock) ใส่ได้ตอน "สร้างใหม่" เท่านั้น — ตอนอัปเดตจะไม่แตะเด็ดขาด
 *     (ฐานข้อมูลมีตัวกันไว้อยู่แล้ว ต้องขยับผ่านรับเข้า/เบิกออก/ตรวจนับ)
 *   • รันซ้ำได้ ไม่สร้างของซ้ำ เพราะเช็คจาก sku ก่อนเสมอ
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// อ่านค่าตั้งต้นจากไฟล์ของเว็บก่อน (ที่เดียวกับที่เว็บใช้จริง) แล้วค่อยเสริมจาก .env ที่โฟลเดอร์หลัก
dotenv.config({ path: resolve(ROOT, "jamaree-web/.env.local"), quiet: true });
dotenv.config({ path: resolve(ROOT, ".env"), quiet: true });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DO_UPDATE = args.includes("--update");
const fileArg = args[args.indexOf("--file") + 1];
const SOURCE_FILE =
  args.includes("--file") && fileArg
    ? resolve(ROOT, fileArg)
    : resolve(ROOT, "JAMAREE GAS-2026-08-18.json");

/** ชนิดสินค้าที่ฐานข้อมูลยอมรับ — ต้องตรงกับ CHECK ในตาราง products */
const VALID_KINDS = new Set([
  "",
  "ดิบ",
  "น้ำแก๊ส",
  "เปล่า",
  "ใหม่",
  "ชำรุด",
  "ต่างยี่ห้อ",
  "หมุนเวียน",
  "เตาแก๊ส",
  "อุปกรณ์แก๊ส",
  "บริการ",
]);

/** ชนิดที่ต้องบอกกิโลต่อถัง ไม่งั้นตอนขายจะตัดแก๊สดิบไม่ได้ */
const NEEDS_FILL_KG = new Set(["น้ำแก๊ส", "หมุนเวียน"]);

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const text = (v) => (typeof v === "string" ? v.trim() : "");

function die(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/** เชื่อมต่อฐานข้อมูล — ต้องมีสิทธิ์เขียน ไม่งั้น RLS จะปฏิเสธทุกแถว */
async function connect() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;

  if (!url) die("ไม่พบ VITE_SUPABASE_URL — ตรวจไฟล์ jamaree-web/.env.local");

  if (serviceKey) {
    console.log(
      "🔑 ใช้ service_role key (ข้าม RLS) — ห้าม commit คีย์นี้เข้า git",
    );
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (!anonKey)
    die("ไม่พบ VITE_SUPABASE_ANON_KEY — ตรวจไฟล์ jamaree-web/.env.local");
  if (!email || !password) {
    die(
      "ตาราง products เปิด RLS ไว้ ต้องล็อกอินก่อนถึงจะเขียนได้\n" +
        "   ใส่ค่าพวกนี้ในไฟล์ .env ที่โฟลเดอร์หลัก (ไฟล์นี้ git ไม่เก็บอยู่แล้ว):\n" +
        "     SUPABASE_EMAIL=อีเมลที่ใช้ล็อกอินเว็บ\n" +
        "     SUPABASE_PASSWORD=รหัสผ่าน\n" +
        "   หรือถ้าถนัดกว่า ใช้ SUPABASE_SERVICE_ROLE_KEY=... แทนก็ได้",
    );
  }

  const db = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) die(`ล็อกอินไม่ผ่าน: ${error.message}`);
  console.log(`🔑 ล็อกอินเป็น ${email}`);
  return db;
}

/** แปลงสินค้า 1 ตัวจากโครงเดิม (camelCase) เป็นโครงใหม่ (snake_case) */
function toRow(old) {
  const kind = text(old.kind);
  const fillKg = num(old.fillKg, 0);
  return {
    sku: text(old.sku) || null,
    name: text(old.name),
    unit: text(old.unit) || "ชิ้น",
    kind: VALID_KINDS.has(kind) ? kind : "",
    size: text(old.size) || null,
    fill_kg: NEEDS_FILL_KG.has(kind) ? fillKg : fillKg > 0 ? fillKg : null,
    stock: num(old.stock),
    low_at: num(old.lowAt),
    price: num(old.price),
    cost: old.cost === undefined || old.cost === null ? null : num(old.cost),
    active: old.active !== false,
    image_url: null, // รูปยังไม่ย้าย — ค่อยอัปโหลดทีหลังจากหน้าสินค้า
  };
}

/** คัดของที่ฐานข้อมูลจะไม่ยอมรับออกก่อน จะได้ไม่พังกลางทาง */
function validate(rows) {
  const ok = [];
  const skipped = [];
  const seenSku = new Set();

  for (const row of rows) {
    if (!row.name) {
      skipped.push({ row, why: "ไม่มีชื่อสินค้า" });
      continue;
    }
    if (NEEDS_FILL_KG.has(row.kind) && !(row.fill_kg > 0)) {
      skipped.push({ row, why: `ชนิด "${row.kind}" ต้องมีกิโลแก๊สต่อถัง` });
      continue;
    }
    if (row.sku && seenSku.has(row.sku)) {
      skipped.push({ row, why: `รหัสสินค้า ${row.sku} ซ้ำในไฟล์` });
      continue;
    }
    if (row.sku) seenSku.add(row.sku);
    ok.push(row);
  }
  return { ok, skipped };
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(readFileSync(SOURCE_FILE, "utf8"));
  } catch (err) {
    die(`อ่านไฟล์ไม่ได้: ${SOURCE_FILE}\n   ${err.message}`);
  }

  const legacy = Array.isArray(raw.products) ? raw.products : [];
  if (!legacy.length) die(`ไม่พบ products ในไฟล์ ${SOURCE_FILE}`);

  console.log(`\n📄 ไฟล์ต้นทาง: ${SOURCE_FILE}`);
  console.log(`📦 เจอสินค้าในไฟล์ ${legacy.length} รายการ`);

  const { ok: rows, skipped } = validate(legacy.map(toRow));
  for (const s of skipped) {
    console.warn(`   ⚠️ ข้าม "${s.row.name || s.row.sku}" — ${s.why}`);
  }

  const db = await connect();

  const { data: existing, error: readErr } = await db
    .from("products")
    .select("id, sku, name, kind");
  if (readErr) die(`อ่านข้อมูลเดิมไม่ได้: ${readErr.message}`);

  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku, p]));
  const hasRawGas = existing.some((p) => p.kind === "ดิบ");

  const toInsert = [];
  const toUpdate = [];
  for (const row of rows) {
    const found = row.sku ? bySku.get(row.sku) : null;
    if (found) {
      toUpdate.push({ id: found.id, row });
      continue;
    }
    // ฐานข้อมูลยอมให้มีแก๊สดิบได้ถังเดียว
    if (row.kind === "ดิบ" && hasRawGas) {
      console.warn(`   ⚠️ ข้าม "${row.name}" — มีแก๊สดิบในระบบอยู่แล้ว`);
      continue;
    }
    toInsert.push(row);
  }

  console.log(
    `\nสรุป: เพิ่มใหม่ ${toInsert.length} · มีอยู่แล้ว ${toUpdate.length}` +
      `${DO_UPDATE ? " (จะทับข้อมูลให้)" : " (ข้ามไว้ ถ้าจะทับใส่ --update)"}`,
  );

  if (DRY_RUN) {
    console.table(
      toInsert.map((r) => ({
        sku: r.sku,
        name: r.name,
        kind: r.kind,
        stock: r.stock,
        price: r.price,
      })),
    );
    console.log("\n🧪 โหมดลองดูเฉย ๆ — ยังไม่ได้เขียนอะไรลงฐานข้อมูล\n");
    return;
  }

  if (toInsert.length) {
    const { data, error } = await db
      .from("products")
      .insert(toInsert)
      .select("sku");
    if (error) die(`เพิ่มสินค้าไม่สำเร็จ: ${error.message}`);
    console.log(`✅ เพิ่มใหม่ ${data.length} รายการ`);
  }

  if (DO_UPDATE && toUpdate.length) {
    let done = 0;
    for (const { id, row } of toUpdate) {
      // ตัด stock ออกเสมอ — ห้ามแก้จำนวนคงเหลือตรง ๆ (ฐานข้อมูลก็กันไว้อีกชั้น)
      const { stock: _skip, image_url: _keep, ...payload } = row;
      const { error } = await db.from("products").update(payload).eq("id", id);
      if (error) die(`อัปเดต ${row.sku} ไม่สำเร็จ: ${error.message}`);
      done++;
    }
    console.log(`✅ อัปเดตของเดิม ${done} รายการ (ไม่แตะจำนวนคงเหลือ)`);
  }

  const { count } = await db
    .from("products")
    .select("id", { count: "exact", head: true });
  console.log(`\n🎉 เสร็จแล้ว — ตอนนี้มีสินค้าในระบบทั้งหมด ${count} รายการ\n`);
}

main().catch((err) => die(err.message));
