import { fmtBaht, fmtQty } from "@/lib/constants";
import type { UUID } from "@/types";

/** บิลที่ขายจบแล้ว — แช่ไว้เพื่อโชว์/พิมพ์ เพราะตะกร้าถูกล้างไปแล้ว */
export interface PosReceipt {
  orderId: UUID;
  /** เวลาที่ปิดการขายจริง (ISO) — พิมพ์ทีหลังก็ยังได้เวลาที่ขาย */
  createdAt: string;
  date: string;
  shopName: string;
  customerName: string;
  lines: { name: string; qty: number; price: number; amount: number }[];
  total: number;
  paidCash: number;
  paidTransfer: number;
  change: number;
  remain: number;
}

export interface PrintOptions {
  /** ตัวอักษรต่อบรรทัด — กระดาษ 58มม.=32 · 80มม.=48 */
  cols?: number;
  /** รหัสหน้าภาษาไทยของเครื่องพิมพ์ (ESC t n) — ส่วนใหญ่ใช้ 255 = TIS-620 */
  codepage?: number;
}

export const PAPER_COLS = { "58mm": 32, "80mm": 48 } as const;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** สระบน/ล่างและวรรณยุกต์ไทย — เกาะอยู่บนตัวก่อนหน้า ไม่กินความกว้างบนกระดาษ */
const THAI_COMBINING = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

/** ความกว้างจริงบนกระดาษ — ใช้จัดคอลัมน์ให้ตรง ไม่ใช่ text.length */
export function printWidth(text: string): number {
  let width = 0;
  for (const ch of text) if (!THAI_COMBINING.test(ch)) width += 1;
  return width;
}

function clip(text: string, cols: number): string {
  if (printWidth(text) <= cols) return text;
  let out = "";
  for (const ch of text) {
    if (printWidth(out + ch) > cols) break;
    out += ch;
  }
  return out;
}

/**
 * แปลงข้อความเป็น TIS-620 — เบราว์เซอร์เข้ารหัสได้แค่ UTF-8 เครื่องพิมพ์ไทยอ่านไม่ออก
 * ช่วงภาษาไทย U+0E01–U+0E5B ตรงกับไบต์ 0xA1–0xFB พอดี บวก 0xA0 ก็จบ
 */
function encodeThai(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) out.push(code);
    else if (code >= 0x0e01 && code <= 0x0e5b) out.push(code - 0x0e00 + 0xa0);
    else out.push(0x3f);
  }
  return out;
}

function pushAll(target: number[], source: number[]) {
  for (const b of source) target.push(b);
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function thaiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** สร้างไบต์ ESC/POS ของใบเสร็จทั้งใบ */
export function buildReceiptBytes(
  receipt: PosReceipt,
  { cols = PAPER_COLS["58mm"], codepage = 255 }: PrintOptions = {},
): Uint8Array {
  const out: number[] = [];

  const text = (s: string) => pushAll(out, encodeThai(s));
  const line = (s = "") => {
    text(s);
    out.push(LF);
  };
  const align = (n: 0 | 1 | 2) => out.push(ESC, 0x61, n);
  const bold = (on: boolean) => out.push(ESC, 0x45, on ? 1 : 0);
  /** ตัวใหญ่ขึ้นกี่เท่า (1–4) */
  const scale = (w: number, h: number) =>
    out.push(GS, 0x21, ((w - 1) << 4) | (h - 1));
  const rule = () => line("-".repeat(cols));

  /** ซ้าย–ขวาชิดขอบคนละข้าง ถ้าซ้ายยาวเกินก็ตัดให้พอดี */
  const pair = (left: string, right: string) => {
    const room = Math.max(0, cols - printWidth(right) - 1);
    const head = clip(left, room);
    const gap = cols - printWidth(head) - printWidth(right);
    line(head + " ".repeat(Math.max(1, gap)) + right);
  };

  out.push(ESC, 0x40);
  out.push(ESC, 0x74, codepage);

  align(1);
  scale(2, 2);
  line(clip(receipt.shopName, Math.floor(cols / 2)));
  scale(1, 1);
  line("ใบเสร็จรับเงิน");

  align(0);
  rule();
  pair(
    `${thaiDate(receipt.createdAt)} ${timeOf(receipt.createdAt)}`.trim(),
    `#${receipt.orderId.slice(-6).toUpperCase()}`,
  );
  line(clip(`ลูกค้า ${receipt.customerName}`, cols));
  rule();

  for (const item of receipt.lines) {
    line(clip(item.name, cols));
    pair(
      `  ${fmtQty(item.qty)} x ${fmtBaht(item.price)}`,
      fmtBaht(item.amount),
    );
  }

  rule();
  bold(true);
  pair("รวมทั้งบิล", fmtBaht(receipt.total));
  bold(false);
  if (receipt.paidCash > 0) pair("เงินสด", fmtBaht(receipt.paidCash));
  if (receipt.paidTransfer > 0) pair("เงินโอน", fmtBaht(receipt.paidTransfer));
  if (receipt.change > 0) pair("เงินทอน", fmtBaht(receipt.change));
  if (receipt.remain > 0) {
    bold(true);
    pair("ค้างชำระ", fmtBaht(receipt.remain));
    bold(false);
  }

  align(1);
  line();
  line("ขอบคุณที่ใช้บริการ");

  out.push(LF, LF, LF, LF);
  out.push(GS, 0x56, 0x01);

  return new Uint8Array(out);
}
