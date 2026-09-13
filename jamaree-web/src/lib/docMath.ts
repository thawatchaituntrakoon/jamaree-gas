import type { StatusTone } from "@/lib/constants";
import type { Customer, DocType, ShopSettings, TradeDocument } from "@/types";

/** สีป้ายตามประเภทเอกสาร — ใบเสนอราคา=กลาง ใบแจ้งหนี้=รอเงิน ใบเสร็จ=จบแล้ว */
export function docTypeTone(type: DocType): StatusTone {
  if (type === "ใบเสร็จ") return "ok";
  if (type === "ใบแจ้งหนี้") return "info";
  return "muted";
}

/** หัวเอกสารตอนพิมพ์ — ร้านที่จด VAT ใบเสร็จจะเป็นใบกำกับภาษีด้วย */
export function docPrintTitle(
  doc: TradeDocument,
  settings: ShopSettings | null,
): string {
  if (doc.type === "ใบเสร็จ") {
    return settings?.vat_registered
      ? "ใบเสร็จรับเงิน/ใบกำกับภาษี"
      : "ใบเสร็จรับเงิน";
  }
  return doc.type;
}

/**
 * ด่านก่อนออกใบกำกับภาษีเต็มรูป (ม.86/4)
 * เช็คเฉพาะตอนร้านจด VAT + เอกสารมี VAT + ไม่ใช่ใบเสนอราคา
 */
export function taxInvoiceProblems(
  doc: TradeDocument,
  customer: Customer | undefined,
  settings: ShopSettings | null,
): string[] {
  if (!settings?.vat_registered) return [];
  if (!doc.vat_rate) return [];
  if (doc.type === "ใบเสนอราคา") return [];

  const problems: string[] = [];
  if (!settings.tax_id?.trim()) problems.push("ยังไม่ได้กรอกเลขภาษีของร้าน");
  if (!settings.address?.trim()) problems.push("ยังไม่ได้กรอกที่อยู่ร้าน");
  if (!customer) {
    problems.push("ไม่พบข้อมูลลูกค้า");
  } else {
    if (!customer.tax_id?.trim())
      problems.push("ลูกค้ายังไม่มีเลขประจำตัวผู้เสียภาษี");
    if (!customer.address?.trim()) problems.push("ลูกค้ายังไม่มีที่อยู่");
  }
  return problems;
}

/**
 * โซ่เอกสาร ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ
 * เดินย้อนไปหาต้นทางก่อน แล้วค่อยเดินหน้าไปจนสุด
 */
export function docChain(
  id: string,
  documents: TradeDocument[],
): TradeDocument[] {
  const start = documents.find((d) => d.id === id);
  if (!start) return [];

  let root = start;
  const seen = new Set<string>([root.id]);
  while (root.source_doc_id) {
    const parent = documents.find((d) => d.id === root.source_doc_id);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    root = parent;
  }

  const chain = [root];
  let cur = root;
  for (;;) {
    const next = documents.find((d) => d.source_doc_id === cur.id);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    chain.push(next);
    cur = next;
  }
  return chain;
}
