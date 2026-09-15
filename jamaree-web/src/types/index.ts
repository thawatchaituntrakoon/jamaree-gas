/**
 * ประเภทข้อมูลกลางของระบบ (SSOT)
 *
 * ⭐ ชื่อฟิลด์ใช้ snake_case ให้ตรงกับชื่อคอลัมน์ใน Postgres เป๊ะ ๆ
 *    เพื่อให้แอป Flutter (POS) ที่จะทำทีหลัง ใช้ชื่อเดียวกันได้เลย ไม่ต้องแปลงกลับไปกลับมา
 *    ดูตารางจริงได้ที่ supabase/schema.sql
 *
 * ⭐ ที่มา: ยกมาจากโครง `bizsuite_erp` ใน erp.html ของจริง (ไม่ใช่จากเอกสารเก่า)
 */

export type UUID = string;
/** วันที่แบบ 'YYYY-MM-DD' */
export type ISODate = string;
/** เวลาแบบเต็ม (timestamptz) */
export type ISODateTime = string;

/* ============ ค่าคงที่ของสถานะต่าง ๆ ============ */

export type PersonType = "บุคคล" | "นิติบุคคล";

/** ชนิดสินค้า — ตัวคุมว่าตอนขายจะตัดสต๊อกยังไง */
export type ProductKind =
  | "" // สินค้าทั่วไป
  | "ดิบ" // แก๊สดิบในถังเก็บใหญ่ (ชั่งกิโล) — มีสต๊อกจริงก้อนเดียว
  | "น้ำแก๊ส" // ขายแล้วแปลงเป็นกิโล ไปตัดจากถังเก็บใหญ่
  | "เปล่า" // ถังเปล่า
  | "เต็ม" // ถังที่บรรจุแก๊สแล้ว พร้อมขาย
  | "ใหม่" // ถังใหม่ (สต๊อกแยกจากถังแลก)
  | "ชำรุด" // ถังชำรุด (กองรอส่งคืนบริษัท)
  | "ต่างยี่ห้อ" // ถังต่างยี่ห้อ (กองรอส่งคืนบริษัท)
  | "หมุนเวียน" // ถังหมุนเวียน — ตัดสต๊อกเหมือนน้ำแก๊ส
  | "เตาแก๊ส"
  | "อุปกรณ์แก๊ส"
  | "บริการ"; // ไม่ตัดสต๊อกเลย

export type MoveType = "รับเข้า" | "เบิกออก" | "ปรับเพิ่ม" | "ปรับลด";

/** สถานะจริงของออเดอร์ — ตัวคุมการตัดสต๊อก */
export type OrderStatus = "ใหม่" | "เสร็จ" | "ยกเลิก";

/** ไทม์ไลน์แสดงผลของออเดอร์ — คนละตัวกับ status ห้ามผูกรวมกัน */
export type WorkStage = "ใหม่" | "กำลังทำ" | "ส่งแล้ว" | "ปิด";

export type MoneyType = "เข้า" | "ออก";

/** ที่มาของรายการเงิน/การเคลื่อนไหว — ถ้ามีค่า แปลว่าระบบสร้างให้อัตโนมัติ ห้ามลบมือ */
export type RefType = "order" | "doc" | "po" | "payroll" | "custody";

export type DocType = "ใบเสนอราคา" | "ใบแจ้งหนี้" | "ใบเสร็จ";
export type DocStatus = "ร่าง" | "ส่งแล้ว" | "ชำระแล้ว";

/** รายการถังที่อยู่กับลูกค้า */
export type CustodyType = "ยืม" | "คืน" | "ฝาก" | "ถอนฝาก" | "เปลี่ยนถังชำรุด";

/* ============ ทะเบียน (Master) ============ */

/** ชุดราคา — ลูกค้าคนละกลุ่มได้ราคาต่างกัน (ตาราง price_tiers) */
export interface PriceTier {
  id: UUID;
  name: string;
  sort_order: number;
  description: string | null;
}

/** ชื่อเรียกใหม่ของ PriceTier — ใช้ชื่อนี้ในโค้ดใหม่ได้เลย เป็นตัวเดียวกัน */
export type PriceSet = PriceTier;

/** ราคาเฉพาะของสินค้า 1 ตัว ในชุดราคา 1 ชุด — ไม่มีแถว = ใช้ราคาปกติของสินค้า */
export interface PriceSetItem {
  id: UUID;
  /** ชี้ไปที่ price_tiers.id */
  price_set_id: UUID;
  product_id: UUID;
  custom_price: number;
  created_at: ISODateTime;
}

export interface Customer {
  id: UUID;
  name: string;
  phone: string | null;
  note: string | null;
  person_type: PersonType;
  /** เลขประจำตัวผู้เสียภาษี — จำเป็นถ้าต้องออกใบกำกับภาษีเต็มรูป */
  tax_id: string | null;
  /** ที่อยู่ — จำเป็นถ้าต้องออกใบกำกับภาษีเต็มรูป */
  address: string | null;
  price_tier_id: UUID | null;
  created_at: ISODateTime;
}

export interface Product {
  id: UUID;
  sku: string | null;
  name: string;
  unit: string;
  kind: ProductKind;
  /** ไซส์ถัง เช่น '4kg' '11.5kg' '15kg' '48kg' */
  size: string | null;
  /** กิโลแก๊สต่อถัง — ใช้เฉพาะ kind 'น้ำแก๊ส'/'หมุนเวียน' ตอนแปลงไปตัดจากถังเก็บใหญ่ */
  fill_kg: number | null;
  stock: number;
  /** เตือนเมื่อ stock <= low_at */
  low_at: number;
  price: number;
  cost: number | null;
  /** ปิดการขายแทนการลบ (ห้ามลบสินค้าที่มีประวัติ) */
  active: boolean;
  /** ลิงก์รูปสินค้า — ไม่มีก็ได้ */
  image_url: string | null;
  /** @deprecated ย้ายไปตาราง price_set_items แล้ว — เหลือไว้เผื่อย้อนข้อมูลเท่านั้น */
  tier_prices: Record<UUID, number>;
  created_at: ISODateTime;
}

/* ============ รายการเคลื่อนไหว (Transaction) ============ */

/** การเคลื่อนไหวสต๊อก — สร้างผ่าน add_move() จุดเดียวเท่านั้น ห้าม insert ตรง */
export interface InventoryMove {
  id: UUID;
  date: ISODate;
  product_id: UUID;
  type: MoveType;
  qty: number;
  note: string;
  ref_type: RefType | null;
  ref_id: UUID | null;
  created_at: ISODateTime;
}

/** รายการสินค้าในออเดอร์ — ไม่แช่ราคาไว้ ราคาคิดสดจากชุดราคาของลูกค้าเสมอ */
export interface OrderItem {
  id: UUID;
  order_id: UUID;
  product_id: UUID;
  qty: number;
}

export interface Order {
  id: UUID;
  customer_id: UUID | null;
  date: ISODate;
  status: OrderStatus;
  work_stage: WorkStage;
  /** ตัดสต๊อกไปแล้วหรือยัง — กันตัดซ้ำ */
  stock_deducted: boolean;
  /** พนักงานผู้รับผิดชอบ (ผูก FK ตอนทำโมดูลพนักงาน) */
  assignee_id: UUID | null;
  paid_cash: number;
  paid_transfer: number;
  voided: boolean;
  created_at: ISODateTime;
  items: OrderItem[];
}

/** เงินเข้า-ออก (ของเดิมชื่อ money) */
export interface Transaction {
  id: UUID;
  date: ISODate;
  type: MoneyType;
  amount: number;
  note: string;
  category: string | null;
  /** ยังไม่ได้จ่าย/ยังไม่ได้รับ — 'ออก'+unpaid = เจ้าหนี้ · 'เข้า'+unpaid = ลูกหนี้ */
  unpaid: boolean;
  /** วันที่เก็บ/จ่ายเงินจริง */
  settled_at: ISODate | null;
  ref_type: RefType | null;
  ref_id: UUID | null;
  vat_amt: number | null;
  /** รหัสประเภทหัก ณ ที่จ่าย — ดูอัตราจริงที่ WHT_TYPES */
  wht_type: string | null;
  wht_amt: number | null;
  wht_rate: number | null;
  payee_name: string | null;
  payee_tax_id: string | null;
  payee_person_type: PersonType | null;
  created_at: ISODateTime;
}

/** หมวดเงินเข้า/ออก — ดรอปดาวน์ทุกจุดอ่านจากนี่ที่เดียว */
export interface MoneyCategory {
  id: UUID;
  name: string;
  type: MoneyType;
  sort_order: number;
  created_at: ISODateTime;
}

/** รายการในเอกสาร — แช่แข็งไว้ตอนออกเอกสาร ไม่ผูกกับ products แล้ว */
export interface DocumentItem {
  name: string;
  qty: number;
  price: number;
}

export interface TradeDocument {
  id: UUID;
  type: DocType;
  /** เลขรัน เช่น IV-2569-001 */
  number: string;
  customer_id: UUID;
  order_id: UUID | null;
  items: DocumentItem[];
  amount: number;
  date: ISODate;
  status: DocStatus;
  note: string | null;
  /** เอกสารต้นทาง ตอนแปลง ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ */
  source_doc_id: UUID | null;
  vat_rate: number | null;
  vat_amt: number | null;
  base_amt: number | null;
  wht_type: string | null;
  wht_rate: number | null;
  wht_amt: number | null;
  /** ยอดโอนจริง = amount - wht_amt */
  transfer_amt: number | null;
  created_at: ISODateTime;
}

/** ถังที่ลูกค้ายืม/ฝากไว้ */
export interface CustodyEntry {
  id: UUID;
  date: ISODate;
  customer_id: UUID;
  size: string;
  type: CustodyType;
  qty: number;
  note: string;
  created_at: ISODateTime;
}

/** ข้อมูลร้าน — มีแถวเดียว ใช้พิมพ์หัวเอกสาร */
export interface ShopSettings {
  id: boolean;
  shop_name: string;
  address: string;
  tax_id: string;
  /** "สำนักงานใหญ่" หรือ "สาขาที่ 00001" — โชว์คู่เลขภาษีบนใบกำกับภาษี */
  branch: string;
  phone: string;
  vat_registered: boolean;
  promptpay_id: string;
  /** เวลาเข้างานมาตรฐาน 'HH:MM' — ใช้ดูว่าใครมาสาย */
  work_start: string;
  /** ความจุถังเก็บแก๊สใหญ่ (กิโล) — 0 = ยังไม่ได้ตั้ง */
  bulk_tank_kg: number;
  updated_at: ISODateTime;
}

/** ผู้ขาย/ซัพพลายเออร์ */
export interface Vendor {
  id: UUID;
  name: string;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  note: string | null;
  created_at: ISODateTime;
}

export type PoStatus = "ร่าง" | "สั่งแล้ว" | "รับแล้ว" | "ยกเลิก";

/** แถวในใบสั่งซื้อ — product_id เป็น null ได้ (พิมพ์ชื่อของเอง แต่ไม่เข้าสต๊อก) */
export interface PoItem {
  product_id: UUID | null;
  name: string;
  qty: number;
  price: number;
}

export interface PurchaseOrder {
  id: UUID;
  number: string;
  vendor_id: UUID;
  date: ISODate;
  /** ของที่สั่ง */
  items: PoItem[];
  /** ของที่ได้จริง — เติมตอนกดรับของ */
  received_items: PoItem[] | null;
  status: PoStatus;
  received_at: ISODate | null;
  note: string | null;
  created_at: ISODateTime;
}

/* ============ พนักงาน & เงินเดือน ============ */

export type PayType = "รายเดือน" | "รายวัน";
export type LeaveStatus = "ขอ" | "อนุมัติ" | "ไม่อนุมัติ";
export type PayrollStatus = "ร่าง" | "จ่ายแล้ว";

export interface Staff {
  id: UUID;
  name: string;
  nickname: string | null;
  role: string | null;
  phone: string | null;
  pay_type: PayType;
  salary: number;
  daily_rate: number;
  start_date: ISODate | null;
  note: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account: string | null;
  /** โควตาลาเฉพาะคนนี้ — ไม่ใส่ก็ใช้โควตากลาง */
  leave_quota_override: Record<string, number>;
  /** มีค่า = พ้นสภาพแล้ว (ประวัติยังอยู่) */
  terminated_at: ISODate | null;
  termination_reason: string | null;
  created_at: ISODateTime;
}

export interface LeaveType {
  id: UUID;
  name: string;
  quota_days: number;
  created_at: ISODateTime;
}

export interface TimeLog {
  id: UUID;
  staff_id: UUID;
  date: ISODate;
  in_at: string | null;
  out_at: string | null;
  note: string | null;
  created_at: ISODateTime;
}

export interface Leave {
  id: UUID;
  staff_id: UUID;
  type: string;
  status: LeaveStatus;
  date_from: ISODate;
  date_to: ISODate;
  days: number;
  note: string | null;
  created_at: ISODateTime;
}

/** แถวเงินเดือนรายคน — แช่แข็งไว้ตอนคำนวณงวด */
export interface PayrollRow {
  staff_id: UUID;
  name: string;
  pay_type: PayType;
  daily_rate: number;
  present_days: number;
  salary: number;
  gross: number;
  sso_amt: number;
  tax_amt: number;
  other_deduct: number;
  net: number;
}

export interface Payroll {
  id: UUID;
  /** 'YYYY-MM' */
  period: string;
  sso_rate: number;
  sso_floor: number;
  sso_salary_cap: number;
  rows: PayrollRow[];
  status: PayrollStatus;
  paid_at: ISODate | null;
  created_at: ISODateTime;
}

/* ============ ถังแก๊ส ============ */

export type DepositType = "รับมัดจำ" | "คืนมัดจำ";

export interface CylinderSize {
  id: UUID;
  name: string;
  sort_order: number;
  deposit_price: number;
  created_at: ISODateTime;
}

/** สต๊อกถังรายขนาด — มุมมองที่รวมยอดจากสินค้า (ไม่ได้เก็บซ้ำ) */
export interface CylinderStockRow {
  size: string;
  sort_order: number;
  filled: number;
  empty: number;
  damaged: number;
  other_brand: number;
  new_cyl: number;
  at_customer: number;
}

export interface CylinderDeposit {
  id: UUID;
  date: ISODate;
  customer_id: UUID;
  size: string;
  type: DepositType;
  qty: number;
  amount: number;
  note: string;
  created_at: ISODateTime;
}

/* ============ ชนิดข้อมูลตอนบันทึกใหม่ (ไม่ต้องส่ง id / created_at) ============ */

type NewOf<T, Required extends keyof T> = Partial<
  Omit<T, "id" | "created_at">
> &
  Pick<T, Required>;

export type CustomerInput = NewOf<Customer, "name">;
export type ProductInput = NewOf<Product, "name">;
export type PriceSetInput = NewOf<PriceTier, "name">;
export type PriceSetItemInput = NewOf<
  PriceSetItem,
  "price_set_id" | "product_id" | "custom_price"
>;
export type TransactionInput = NewOf<Transaction, "type" | "amount">;
export type MoneyCategoryInput = NewOf<MoneyCategory, "name" | "type">;
export type CustodyInput = NewOf<
  CustodyEntry,
  "customer_id" | "size" | "type" | "qty"
>;
export type DocumentInput = NewOf<
  TradeDocument,
  "type" | "number" | "customer_id" | "items" | "amount"
>;
export type ShopSettingsInput = Partial<
  Omit<ShopSettings, "id" | "updated_at">
>;
export type VendorInput = NewOf<Vendor, "name">;
export type PurchaseOrderInput = NewOf<
  PurchaseOrder,
  "number" | "vendor_id" | "items"
>;
export type StaffInput = NewOf<Staff, "name">;
export type LeaveTypeInput = NewOf<LeaveType, "name">;
export type TimeLogInput = NewOf<TimeLog, "staff_id" | "date">;
export type LeaveInput = NewOf<
  Leave,
  "staff_id" | "type" | "date_from" | "date_to"
>;
export type CylinderSizeInput = NewOf<CylinderSize, "name">;
export type DepositInput = {
  customer_id: UUID;
  size: string;
  type: DepositType;
  qty: number;
  amount: number;
  date?: ISODate;
  note?: string;
};

export type OrderItemInput = { product_id: UUID; qty: number };
export type OrderInput = Partial<Omit<Order, "id" | "created_at" | "items">> & {
  items: OrderItemInput[];
};

export type MoveInput = {
  product_id: UUID;
  type: MoveType;
  qty: number;
  note?: string;
  ref_type?: RefType | null;
  ref_id?: UUID | null;
};
