import { fmtDate } from "@/lib/constants";
import type { Customer, Order, Product, UUID } from "@/types";

export interface SearchHit {
  id: string;
  /** หมวดที่โชว์เป็นหัวข้อย่อยในผลค้นหา */
  group: string;
  label: string;
  hint: string;
  path: string;
}

/** ต้องพิมพ์อย่างน้อยกี่ตัวอักษรถึงจะเริ่มค้นหา */
export const SEARCH_MIN_CHARS = 2;
/** โชว์ผลลัพธ์มากสุดกี่รายการ (เหมือนของเดิมใน erp.html) */
export const SEARCH_LIMIT = 8;

/** ตัดวงเล็บ ขีด จุด และช่องว่างเกิน ออกให้เหลือแต่ตัวอักษรกับตัวเลข */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * เทียบคำค้นแบบแยกเป็นคำ ๆ — ต้องเจอครบทุกคำ แต่ไม่สนลำดับ
 * พิมพ์ “ชลัท แสนอร่าม (ไปส่ง)” “ชลัท ไปส่ง” หรือเว้นวรรคเกิน ก็เจอชื่อเดียวกัน
 */
export function matchQuery(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = normalize(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

interface SearchSource {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  customerName: (id: UUID | null | undefined) => string;
}

/**
 * ค้นหากลาง — พิมพ์ทีเดียวเจอได้ทั้งลูกค้า สินค้า และบิล
 * ยกแนวทางมาจาก searchResults() ใน erp.html (ขั้นต่ำ 2 ตัวอักษร, ตัดที่ 8 รายการ)
 */
export function searchResults(q: string, src: SearchSource): SearchHit[] {
  const term = q.trim();
  if (term.length < SEARCH_MIN_CHARS) return [];

  const has = (...parts: (string | null | undefined)[]) =>
    matchQuery(term, ...parts);

  const hits: SearchHit[] = [];

  for (const c of src.customers) {
    if (has(c.name, c.phone, c.tax_id)) {
      hits.push({
        id: c.id,
        group: "ลูกค้า",
        label: c.name,
        hint: c.phone ?? "ไม่มีเบอร์โทร",
        path: `/customers/${c.id}`,
      });
    }
  }

  for (const p of src.products) {
    if (has(p.name, p.sku, p.size)) {
      hits.push({
        id: p.id,
        group: "สินค้า",
        label: p.name,
        hint: [p.size, p.sku].filter(Boolean).join(" · ") || p.unit,
        path: `/products/${p.id}`,
      });
    }
  }

  for (const o of src.orders) {
    const name = src.customerName(o.customer_id);
    if (has(name, o.date, o.work_stage)) {
      hits.push({
        id: o.id,
        group: "บิล",
        label: `${fmtDate(o.date)} — ${name}`,
        hint: `${o.items.length} รายการ · ${o.voided ? "ยกเลิกแล้ว" : o.work_stage}`,
        path: `/orders/${o.id}`,
      });
    }
  }

  return hits.slice(0, SEARCH_LIMIT);
}
