/**
 * พิมพ์ใบเสร็จเป็น "ภาพ" (ESC/POS raster) แทนการส่งตัวอักษรดิบ
 *
 * ทำไมต้องเป็นภาพ: เครื่องพิมพ์ความร้อนจีนส่วนใหญ่ (รวม RP21UB-Y) มากับ code page
 * CP437/U.S.A. และไม่มีฟอนต์ไทยในเฟิร์มแวร์ ส่งไบต์ TIS-620 ไปก็ได้ตัวประหลาดกลับมา
 * อีกทั้งรหัสหน้าไทย (ESC t n) ของแต่ละเฟิร์มแวร์ไม่ตรงกัน เดาแล้วพังทุกเครื่อง
 * → วาดใบเสร็จด้วยฟอนต์ไทยบน canvas แล้วส่งเป็นจุดขาว-ดำ จบทุกปัญหาสระ/วรรณยุกต์
 *
 * ใบเสร็จยาวแค่ไหนก็ได้ — ส่งเป็นแถบ ๆ ละ 128 แถว กันบัฟเฟอร์เครื่องพิมพ์ล้น
 */
import { fmtBaht, fmtQty } from "@/lib/constants";
import type { PosReceipt } from "@/lib/escpos";

/** ความละเอียดเครื่อง 58 มม. = 384 จุดต่อบรรทัด */
export const RECEIPT_DOTS = 384;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const FONT_STACK =
  '"Anuphan", "Noto Sans Thai", "Sarabun", "Tahoma", sans-serif';
const HEAD = 34;
const BODY = 22;
const SMALL = 19;
const PAD = 10;
const TOP_MARGIN = 8;
const BOTTOM_MARGIN = 10;

/** ขาวเกินค่านี้ = ไม่ยิงหัวพิมพ์ (ขอบตัวอักษรที่โดน antialias จะถูกปัดเป็นดำ/ขาวตรงนี้) */
const INK_THRESHOLD = 160;
/** ส่งทีละแถบ — เครื่องรับภาพสูงเกินทีเดียวแล้วพิมพ์ตกหล่น */
const BAND_ROWS = 128;

/** สระบน/ล่างและวรรณยุกต์ — ห้ามขึ้นบรรทัดใหม่โดยพรากจากพยัญชนะตัวหน้า */
const THAI_COMBINING = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

type Align = "left" | "center" | "right";

type Op =
  | { k: "text"; s: string; size: number; bold?: boolean; align?: Align }
  | { k: "pair"; l: string; r: string; size: number; bold?: boolean }
  | { k: "rule" }
  | { k: "gap"; h: number };

type Ctx2D = CanvasRenderingContext2D;

function font(size: number, bold?: boolean): string {
  return `${bold ? 600 : 400} ${size}px ${FONT_STACK}`;
}

function lineHeight(size: number): number {
  return Math.round(size * 1.45);
}

/** ตัดบรรทัดตามความกว้างจริงที่วัดได้ — ไทยไม่มีช่องว่างระหว่างคำ จึงตัดทีละตัวเมื่อจำเป็น */
function wrap(
  ctx: Ctx2D,
  text: string,
  size: number,
  bold: boolean | undefined,
  maxWidth: number,
): string[] {
  ctx.font = font(size, bold);
  if (!text) return [""];
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    // สระ/วรรณยุกต์เกาะตัวหน้าเสมอ ถึงจะล้นก็ต้องอยู่บรรทัดเดียวกัน
    if (THAI_COMBINING.test(ch)) {
      cur += ch;
      continue;
    }
    const next = cur + ch;
    if (cur && ctx.measureText(next).width > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * วาด (หรือวัดความสูงอย่างเดียวเมื่อ dry=true) — ใช้โค้ดเดียวกันทั้งสองรอบ
 * จะได้ไม่มีทางที่ความสูงที่จองไว้กับของที่วาดจริงไม่ตรงกัน
 */
function paint(ctx: Ctx2D, ops: Op[], width: number, dry: boolean): number {
  const inner = width - PAD * 2;
  let y = TOP_MARGIN;

  for (const op of ops) {
    if (op.k === "gap") {
      y += op.h;
      continue;
    }

    if (op.k === "rule") {
      if (!dry) {
        for (let x = PAD; x < width - PAD; x += 6) {
          ctx.fillRect(x, y + 4, 3, 2);
        }
      }
      y += 12;
      continue;
    }

    if (op.k === "text") {
      const lines = wrap(ctx, op.s, op.size, op.bold, inner);
      const align = op.align ?? "left";
      const x =
        align === "center" ? width / 2 : align === "right" ? width - PAD : PAD;
      for (const l of lines) {
        if (!dry) {
          ctx.font = font(op.size, op.bold);
          ctx.textAlign = align;
          ctx.fillText(l, x, y);
        }
        y += lineHeight(op.size);
      }
      continue;
    }

    // คู่ซ้าย-ขวา: ยอดเงินชิดขวาเสมอ ชื่อทางซ้ายตัดบรรทัดได้
    ctx.font = font(op.size, op.bold);
    const rightWidth = ctx.measureText(op.r).width;
    const lines = wrap(ctx, op.l, op.size, op.bold, inner - rightWidth - 8);
    if (!dry) {
      ctx.font = font(op.size, op.bold);
      ctx.textAlign = "left";
      lines.forEach((l, i) =>
        ctx.fillText(l, PAD, y + i * lineHeight(op.size)),
      );
      ctx.textAlign = "right";
      ctx.fillText(
        op.r,
        width - PAD,
        y + (lines.length - 1) * lineHeight(op.size),
      );
    }
    y += lines.length * lineHeight(op.size);
  }

  return y + BOTTOM_MARGIN;
}

/** รอให้ฟอนต์ไทยพร้อมก่อนวาด ไม่งั้น canvas จะวาดด้วยฟอนต์สำรองแล้วความกว้างเพี้ยน */
async function ensureThaiFont(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`400 ${BODY}px Anuphan`, "ก"),
      document.fonts.load(`600 ${HEAD}px Anuphan`, "ก"),
    ]);
  } catch {
    // โหลดฟอนต์ไม่ได้ (ออฟไลน์) → ตกไปใช้ฟอนต์ไทยของเครื่อง ยังพิมพ์ได้อยู่
  }
}

async function renderCanvas(ops: Op[]): Promise<HTMLCanvasElement> {
  await ensureThaiFont();

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure)
    throw new Error("เครื่องนี้วาดใบเสร็จไม่ได้ (ไม่รองรับ canvas)");
  measure.textBaseline = "top";
  const height = Math.ceil(paint(measure, ops, RECEIPT_DOTS, true));

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_DOTS;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เครื่องนี้วาดใบเสร็จไม่ได้ (ไม่รองรับ canvas)");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  paint(ctx, ops, RECEIPT_DOTS, false);

  return canvas;
}

/** canvas → คำสั่งภาพ ESC/POS (GS v 0) แบ่งเป็นแถบ ๆ */
function rasterBytes(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("อ่านภาพใบเสร็จไม่ได้");

  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  const out: number[] = [];

  for (let top = 0; top < height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - top);
    out.push(
      GS,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      rows & 0xff,
      (rows >> 8) & 0xff,
    );

    for (let y = 0; y < rows; y++) {
      for (let xb = 0; xb < widthBytes; xb++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xb * 8 + bit;
          if (x >= width) continue;
          const i = ((top + y) * width + x) * 4;
          const alpha = px[i + 3];
          const lum =
            alpha === 0
              ? 255
              : px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          if (lum < INK_THRESHOLD) byte |= 0x80 >> bit;
        }
        out.push(byte);
      }
    }
  }
  return out;
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

/** ผังใบเสร็จ — เรียงเหมือนเดิมทุกบรรทัด ไม่แตะตัวเลขหรือการคำนวณใด ๆ */
function receiptOps(receipt: PosReceipt): Op[] {
  const ops: Op[] = [
    { k: "text", s: receipt.shopName, size: HEAD, bold: true, align: "center" },
    { k: "text", s: "ใบเสร็จรับเงิน", size: SMALL, align: "center" },
    { k: "rule" },
    {
      k: "pair",
      l: `${thaiDate(receipt.createdAt)} ${timeOf(receipt.createdAt)}`.trim(),
      r: `#${receipt.orderId.slice(-6).toUpperCase()}`,
      size: SMALL,
    },
    { k: "text", s: `ลูกค้า ${receipt.customerName}`, size: SMALL },
    { k: "rule" },
  ];

  for (const item of receipt.lines) {
    ops.push({ k: "text", s: item.name, size: BODY });
    ops.push({
      k: "pair",
      l: `   ${fmtQty(item.qty)} x ${fmtBaht(item.price)}`,
      r: fmtBaht(item.amount),
      size: SMALL,
    });
  }

  ops.push({ k: "rule" });
  ops.push({
    k: "pair",
    l: "รวมทั้งบิล",
    r: `${fmtBaht(receipt.total)} บาท`,
    size: BODY,
    bold: true,
  });
  if (receipt.paidCash > 0)
    ops.push({
      k: "pair",
      l: "เงินสด",
      r: fmtBaht(receipt.paidCash),
      size: SMALL,
    });
  if (receipt.paidTransfer > 0)
    ops.push({
      k: "pair",
      l: "เงินโอน",
      r: fmtBaht(receipt.paidTransfer),
      size: SMALL,
    });
  if (receipt.change > 0)
    ops.push({
      k: "pair",
      l: "เงินทอน",
      r: fmtBaht(receipt.change),
      size: SMALL,
    });
  if (receipt.remain > 0)
    ops.push({
      k: "pair",
      l: "ค้างชำระ",
      r: fmtBaht(receipt.remain),
      size: BODY,
      bold: true,
    });

  ops.push({ k: "gap", h: 10 });
  ops.push({
    k: "text",
    s: "ขอบคุณที่ใช้บริการ",
    size: SMALL,
    align: "center",
  });

  return ops;
}

function finish(image: number[]): Uint8Array {
  const out: number[] = [ESC, 0x40, ESC, 0x61, 0x00];
  for (const b of image) out.push(b);
  out.push(LF, LF, LF, LF);
  // เครื่องที่ไม่มีใบมีดจะข้ามคำสั่งนี้ไปเอง ไม่พัง
  out.push(GS, 0x56, 0x01);
  return new Uint8Array(out);
}

/** ใบเสร็จขายหน้าร้าน — ส่งไบต์ชุดนี้เข้า printBytes() ได้เลย */
export async function buildReceiptRasterBytes(
  receipt: PosReceipt,
): Promise<Uint8Array> {
  const canvas = await renderCanvas(receiptOps(receipt));
  return finish(rasterBytes(canvas));
}

/** หน้าทดสอบภาษาไทย — ไว้ยืนยันสระ/วรรณยุกต์กับเครื่องจริงก่อนใช้งาน */
export async function buildThaiTestBytes(): Promise<Uint8Array> {
  const ops: Op[] = [
    { k: "text", s: "จามรีก๊าซ", size: HEAD, bold: true, align: "center" },
    { k: "text", s: "ทดสอบพิมพ์ภาษาไทย", size: SMALL, align: "center" },
    { k: "rule" },
    { k: "text", s: "วันที่ 12 ต.ค. 2569", size: SMALL },
    { k: "text", s: "ถังแก๊ส 15 กก.", size: BODY },
    { k: "pair", l: "   20 x 425.00", r: "8,500.00", size: SMALL },
    { k: "text", s: "ถังแก๊ส 4 กก.", size: BODY },
    { k: "pair", l: "   3 x 138.00", r: "414.00", size: SMALL },
    { k: "rule" },
    { k: "pair", l: "รวมทั้งสิ้น", r: "8,914.00 บาท", size: BODY, bold: true },
    { k: "gap", h: 8 },
    { k: "text", s: "กำ ก่า ก้า ก๊า ก๋า กิ กี กึ กื", size: BODY },
    { k: "text", s: "กุ กู เก แก โก ไก ใจ ฤๅ ฦๅ", size: BODY },
    { k: "text", s: "ABCDEFG 0123456789 ฿", size: BODY },
    { k: "gap", h: 8 },
    { k: "text", s: "ขอบคุณที่ใช้บริการ", size: SMALL, align: "center" },
  ];
  const canvas = await renderCanvas(ops);
  return finish(rasterBytes(canvas));
}
