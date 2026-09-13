import type {
  CustodyType,
  DocStatus,
  DocType,
  MoveType,
  OrderStatus,
  PersonType,
  PoStatus,
  ProductKind,
  WorkStage,
} from "@/types";

/** ชนิดสินค้า + คำอธิบายที่โชว์ในดรอปดาวน์ */
export const PRODUCT_KINDS: ReadonlyArray<{
  value: ProductKind;
  label: string;
}> = [
  { value: "", label: "สินค้าทั่วไป" },
  { value: "ดิบ", label: "แก๊สดิบ (ชั่งกิโล)" },
  { value: "น้ำแก๊ส", label: "น้ำแก๊ส (ขายแล้วตัดจากถังเก็บใหญ่)" },
  { value: "เปล่า", label: "ถังเปล่า" },
  { value: "เต็ม", label: "ถังเต็ม (บรรจุแล้ว)" },
  { value: "ใหม่", label: "ถังใหม่ (สต๊อกแยกจากถังแลก)" },
  { value: "ชำรุด", label: "ถังชำรุด (กองรอส่งคืนบริษัท)" },
  { value: "ต่างยี่ห้อ", label: "ถังต่างยี่ห้อ (กองรอส่งคืนบริษัท)" },
  { value: "หมุนเวียน", label: "ถังหมุนเวียน (ขายพร้อมแก๊ส)" },
  { value: "เตาแก๊ส", label: "เตาแก๊ส" },
  { value: "อุปกรณ์แก๊ส", label: "อุปกรณ์แก๊ส" },
  { value: "บริการ", label: "บริการ (ไม่ตัดสต๊อก)" },
];

/** ชนิดสินค้าที่ขายแล้วต้องแปลงเป็นกิโล ไปตัดจากถังเก็บใหญ่ */
export const GAS_FILL_KINDS: ReadonlyArray<ProductKind> = [
  "น้ำแก๊ส",
  "หมุนเวียน",
];

export const MOVE_TYPES: ReadonlyArray<MoveType> = [
  "รับเข้า",
  "เบิกออก",
  "ปรับเพิ่ม",
  "ปรับลด",
];

/** ไทม์ไลน์ออเดอร์ — เดินหน้าทางเดียว */
export const ORDER_STAGES: ReadonlyArray<WorkStage> = [
  "ใหม่",
  "กำลังทำ",
  "ส่งแล้ว",
  "ปิด",
];

export const ORDER_STATUSES: ReadonlyArray<OrderStatus> = [
  "ใหม่",
  "เสร็จ",
  "ยกเลิก",
];

export const DOC_TYPES: ReadonlyArray<DocType> = [
  "ใบเสนอราคา",
  "ใบแจ้งหนี้",
  "ใบเสร็จ",
];

export const DOC_STATUSES: ReadonlyArray<DocStatus> = [
  "ร่าง",
  "ส่งแล้ว",
  "ชำระแล้ว",
];

export const PERSON_TYPES: ReadonlyArray<PersonType> = ["บุคคล", "นิติบุคคล"];

export const PO_STATUSES: ReadonlyArray<PoStatus> = [
  "ร่าง",
  "สั่งแล้ว",
  "รับแล้ว",
  "ยกเลิก",
];

export const CUSTODY_TYPES: ReadonlyArray<CustodyType> = [
  "ยืม",
  "คืน",
  "ฝาก",
  "ถอนฝาก",
  "เปลี่ยนถังชำรุด",
];

/** อัตราหัก ณ ที่จ่าย — แหล่งความจริงเดียวของอัตรา */
export const WHT_TYPES: ReadonlyArray<{
  code: string;
  label: string;
  rate: number;
}> = [
  { code: "service", label: "ค่าบริการ/รับเหมา", rate: 3 },
  { code: "transport", label: "ค่าขนส่ง", rate: 1 },
  { code: "advertising", label: "ค่าโฆษณา", rate: 2 },
  { code: "rent", label: "ค่าเช่า", rate: 5 },
  { code: "professional", label: "วิชาชีพอิสระ", rate: 3 },
];

export const VAT_RATE = 7;

/** สีป้ายสถานะ — สีต้องมีความหมายเสมอ */
export const STATUS_TONE = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-accent-soft text-accent",
  muted: "bg-paper text-muted",
} as const;

export type StatusTone = keyof typeof STATUS_TONE;

export function docStatusTone(status: DocStatus): StatusTone {
  if (status === "ชำระแล้ว") return "ok";
  if (status === "ส่งแล้ว") return "warn";
  return "muted";
}

export function workStageTone(stage: WorkStage): StatusTone {
  if (stage === "ปิด") return "ok";
  if (stage === "ส่งแล้ว") return "info";
  if (stage === "กำลังทำ") return "warn";
  return "muted";
}

export function poStatusTone(status: PoStatus): StatusTone {
  if (status === "รับแล้ว") return "ok";
  if (status === "สั่งแล้ว") return "warn";
  if (status === "ยกเลิก") return "danger";
  return "muted";
}

/** วันที่วันนี้แบบ 'YYYY-MM-DD' ตามเวลาเครื่อง */
export function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** แสดงเงินแบบไทย เช่น 1,250.50 */
export function fmtBaht(n: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

/** แสดงจำนวน — ตัด .00 ทิ้งถ้าเป็นจำนวนเต็ม */
export function fmtQty(n: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(
    n || 0,
  );
}

/** แสดงวันที่แบบไทย เช่น 10 ก.ย. 2569 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
