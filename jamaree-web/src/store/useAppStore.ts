import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { ORDER_STAGES } from "@/lib/constants";
import type {
  Customer,
  CustomerInput,
  CustodyEntry,
  CustodyInput,
  CylinderDeposit,
  CylinderSize,
  CylinderSizeInput,
  CylinderStockRow,
  DepositInput,
  DocumentInput,
  DocType,
  InventoryMove,
  Leave,
  LeaveInput,
  LeaveType,
  LeaveTypeInput,
  MoneyCategory,
  MoneyCategoryInput,
  MoveInput,
  Order,
  OrderInput,
  PoItem,
  PriceTier,
  Payroll,
  PayrollRow,
  Product,
  ProductInput,
  PurchaseOrder,
  PurchaseOrderInput,
  ShopSettings,
  ShopSettingsInput,
  Staff,
  StaffInput,
  TimeLog,
  TimeLogInput,
  TradeDocument,
  Transaction,
  TransactionInput,
  UUID,
  Vendor,
  VendorInput,
} from "@/types";

/** เลือกออเดอร์พร้อมรายการสินค้าในนั้นมาด้วยเสมอ */
const ORDER_SELECT = "*, items:order_items(*)";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface AppState {
  /* ---- ข้อมูล ---- */
  priceTiers: PriceTier[];
  customers: Customer[];
  products: Product[];
  moves: InventoryMove[];
  orders: Order[];
  transactions: Transaction[];
  categories: MoneyCategory[];
  documents: TradeDocument[];
  custody: CustodyEntry[];
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  staff: Staff[];
  leaveTypes: LeaveType[];
  timelogs: TimeLog[];
  leaves: Leave[];
  payrolls: Payroll[];
  cylinderSizes: CylinderSize[];
  cylinderStock: CylinderStockRow[];
  deposits: CylinderDeposit[];
  settings: ShopSettings | null;

  /* ---- สถานะการโหลด ---- */
  status: LoadStatus;
  error: string | null;
  clearError: () => void;

  /* ---- อ่านข้อมูล ---- */
  loadAll: () => Promise<void>;
  reloadProducts: () => Promise<void>;
  reloadOrders: () => Promise<void>;
  reloadTransactions: () => Promise<void>;
  reloadDocuments: () => Promise<void>;
  reloadPurchaseOrders: () => Promise<void>;

  /* ---- บันทึกข้อมูล ---- */
  saveCustomer: (input: CustomerInput, id?: UUID) => Promise<Customer>;
  saveProduct: (input: ProductInput, id?: UUID) => Promise<Product>;
  saveOrder: (input: OrderInput, id?: UUID) => Promise<Order>;
  saveTransaction: (input: TransactionInput, id?: UUID) => Promise<Transaction>;
  /** ลบรายการเงิน — ได้เฉพาะรายการที่กรอกเอง (ฐานข้อมูลกันไว้อีกชั้น) */
  deleteTransaction: (id: UUID) => Promise<void>;
  /** ตัดยอดค้าง (เก็บเงินลูกหนี้ / จ่ายเจ้าหนี้) — ใส่จำนวนเงินเพื่อจ่ายบางส่วน */
  settleTransaction: (
    id: UUID,
    amount?: number,
    date?: string,
  ) => Promise<void>;
  saveCategory: (
    input: MoneyCategoryInput,
    id?: UUID,
  ) => Promise<MoneyCategory>;
  deleteCategory: (id: UUID) => Promise<void>;
  saveDocument: (input: DocumentInput, id?: UUID) => Promise<TradeDocument>;
  /** ขอเลขที่จากฐานข้อมูล — เดินหน้าอย่างเดียว ไม่ซ้ำแม้กดพร้อมกันหลายเครื่อง */
  nextDocNumber: (type: DocType) => Promise<string>;
  /** ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ (ออกใบเสร็จจะลงเงินเข้าให้เอง) */
  convertDocument: (id: UUID, toType: DocType) => Promise<TradeDocument>;
  /** ทำเครื่องหมายว่าส่งให้ลูกค้าแล้ว */
  markDocSent: (id: UUID) => Promise<void>;
  /** ลบเอกสาร — ได้เฉพาะตอนยังเป็นร่าง */
  deleteDocument: (id: UUID) => Promise<void>;
  saveSettings: (input: ShopSettingsInput) => Promise<ShopSettings>;

  saveVendor: (input: VendorInput, id?: UUID) => Promise<Vendor>;
  savePurchaseOrder: (
    input: PurchaseOrderInput,
    id?: UUID,
  ) => Promise<PurchaseOrder>;
  /** ขอเลขที่ใบสั่งซื้อถัดไป เช่น PO-2569-001 */
  nextPoNumber: () => Promise<string>;
  /** ส่งใบสั่งซื้อให้ผู้ขาย (ร่าง → สั่งแล้ว) */
  sendPo: (id: UUID) => Promise<void>;
  /** รับของเข้าคลัง — สต๊อกเพิ่ม + ตั้งเจ้าหนี้ พร้อมกัน */
  receivePo: (id: UUID, received: PoItem[]) => Promise<PurchaseOrder>;
  cancelPo: (id: UUID) => Promise<void>;
  deletePurchaseOrder: (id: UUID) => Promise<void>;

  saveStaff: (input: StaffInput, id?: UUID) => Promise<Staff>;
  saveLeaveType: (input: LeaveTypeInput, id?: UUID) => Promise<LeaveType>;
  deleteLeaveType: (id: UUID) => Promise<void>;
  /** ลงเวลา — 1 คน 1 วัน มีแถวเดียว กดซ้ำคือทับของเดิม */
  saveTimeLog: (input: TimeLogInput) => Promise<TimeLog>;
  saveLeave: (input: LeaveInput, id?: UUID) => Promise<Leave>;
  deleteLeave: (id: UUID) => Promise<void>;
  /** สร้าง/คำนวณงวดใหม่ — งวดที่จ่ายแล้วคำนวณซ้ำไม่ได้ */
  buildPayroll: (period: string) => Promise<Payroll>;
  /** แก้ตัวเลขในงวดร่าง (เช่น หักอื่น ๆ) */
  savePayrollRows: (id: UUID, rows: PayrollRow[]) => Promise<Payroll>;
  payPayroll: (id: UUID) => Promise<Payroll>;
  deletePayroll: (id: UUID) => Promise<void>;

  saveCylinderSize: (
    input: CylinderSizeInput,
    id?: UUID,
  ) => Promise<CylinderSize>;
  /** บันทึกการบรรจุ — ถังเปล่าลด แก๊สดิบลด ถังเต็มเพิ่ม */
  fillCylinders: (size: string, qty: number, note?: string) => Promise<void>;
  addDeposit: (input: DepositInput) => Promise<CylinderDeposit>;
  reloadCylinders: () => Promise<void>;
  saveCustody: (input: CustodyInput) => Promise<CustodyEntry>;

  /** ⭐ ทางเดียวที่สต๊อกจะขยับได้ — เรียกฟังก์ชัน add_move() ในฐานข้อมูล */
  addMove: (input: MoveInput) => Promise<InventoryMove>;

  /** ⭐ ปิดออเดอร์ = ตัดสต๊อก + ลงบัญชี ในทีเดียว (ฟังก์ชัน complete_order) */
  completeOrder: (id: UUID) => Promise<void>;
  /** ยกเลิกบิล — คืนสต๊อก + ล้างยอดเงินของบิลนั้น (ไม่ลบออเดอร์) */
  voidOrder: (id: UUID) => Promise<void>;
  /** เดินไทม์ไลน์งานไปขั้นถัดไป — ขั้นสุดท้าย "ปิด" จะตัดสต๊อกให้ด้วย */
  advanceOrderStage: (id: UUID) => Promise<void>;
  /** มอบหมายงานให้พนักงาน — ส่ง null เพื่อเอาชื่อออก */
  setOrderAssignee: (id: UUID, staffId: UUID | null) => Promise<void>;
}

/** แปลง error จาก Supabase เป็นข้อความไทยที่เจ้าของร้านอ่านรู้เรื่อง */
function toMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

export const useAppStore = create<AppState>()((set, get) => ({
  priceTiers: [],
  customers: [],
  products: [],
  moves: [],
  orders: [],
  transactions: [],
  categories: [],
  documents: [],
  custody: [],
  vendors: [],
  purchaseOrders: [],
  staff: [],
  leaveTypes: [],
  timelogs: [],
  leaves: [],
  payrolls: [],
  cylinderSizes: [],
  cylinderStock: [],
  deposits: [],
  settings: null,

  status: "idle",
  error: null,
  clearError: () => set({ error: null }),

  /* ============ อ่านข้อมูล ============ */

  loadAll: async () => {
    set({ status: "loading", error: null });
    try {
      const [
        tiers,
        customers,
        products,
        moves,
        orders,
        transactions,
        categories,
        documents,
        custody,
        settings,
        vendors,
        purchaseOrders,
        staff,
        leaveTypes,
        timelogs,
        leaves,
        payrolls,
        cylinderSizes,
        cylinderStock,
        deposits,
      ] = await Promise.all([
        supabase.from("price_tiers").select("*").order("sort_order"),
        supabase.from("customers").select("*").order("name"),
        supabase.from("products").select("*").order("name"),
        supabase
          .from("stock_moves")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .order("date", { ascending: false })
          .limit(500),
        supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false })
          .limit(500),
        supabase
          .from("money_categories")
          .select("*")
          .order("type")
          .order("sort_order")
          .order("name"),
        supabase
          .from("documents")
          .select("*")
          .order("date", { ascending: false })
          .limit(500),
        supabase.from("cylinder_custody").select("*").order("date", {
          ascending: false,
        }),
        supabase.from("shop_settings").select("*").maybeSingle(),
        supabase.from("vendors").select("*").order("name"),
        supabase
          .from("purchase_orders")
          .select("*")
          .order("date", { ascending: false })
          .limit(500),
        supabase.from("staff").select("*").order("name"),
        supabase.from("leave_types").select("*").order("name"),
        supabase
          .from("timelogs")
          .select("*")
          .order("date", { ascending: false })
          .limit(1000),
        supabase
          .from("leaves")
          .select("*")
          .order("date_from", { ascending: false })
          .limit(500),
        supabase
          .from("payrolls")
          .select("*")
          .order("period", { ascending: false }),
        supabase.from("cylinder_sizes").select("*").order("sort_order"),
        supabase.from("cylinder_stock").select("*").order("sort_order"),
        supabase
          .from("cylinder_deposits")
          .select("*")
          .order("date", { ascending: false })
          .limit(500),
      ]);

      const failed = [
        tiers,
        customers,
        products,
        moves,
        orders,
        transactions,
        categories,
        documents,
        custody,
        settings,
        vendors,
        purchaseOrders,
        staff,
        leaveTypes,
        timelogs,
        leaves,
        payrolls,
        cylinderSizes,
        cylinderStock,
        deposits,
      ].find((r) => r.error);
      if (failed?.error) throw failed.error;

      set({
        priceTiers: (tiers.data ?? []) as PriceTier[],
        customers: (customers.data ?? []) as Customer[],
        products: (products.data ?? []) as Product[],
        moves: (moves.data ?? []) as InventoryMove[],
        orders: (orders.data ?? []) as Order[],
        transactions: (transactions.data ?? []) as Transaction[],
        categories: (categories.data ?? []) as MoneyCategory[],
        documents: (documents.data ?? []) as TradeDocument[],
        custody: (custody.data ?? []) as CustodyEntry[],
        settings: (settings.data ?? null) as ShopSettings | null,
        vendors: (vendors.data ?? []) as Vendor[],
        purchaseOrders: (purchaseOrders.data ?? []) as PurchaseOrder[],
        staff: (staff.data ?? []) as Staff[],
        leaveTypes: (leaveTypes.data ?? []) as LeaveType[],
        timelogs: (timelogs.data ?? []) as TimeLog[],
        leaves: (leaves.data ?? []) as Leave[],
        payrolls: (payrolls.data ?? []) as Payroll[],
        cylinderSizes: (cylinderSizes.data ?? []) as CylinderSize[],
        cylinderStock: (cylinderStock.data ?? []) as CylinderStockRow[],
        deposits: (deposits.data ?? []) as CylinderDeposit[],
        status: "ready",
      });
    } catch (err) {
      set({ status: "error", error: toMessage(err) });
    }
  },

  reloadProducts: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (error) {
      set({ error: toMessage(error) });
      return;
    }
    set({ products: (data ?? []) as Product[] });
  },

  reloadOrders: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("date", { ascending: false })
      .limit(500);
    if (error) {
      set({ error: toMessage(error) });
      return;
    }
    set({ orders: (data ?? []) as Order[] });
  },

  reloadDocuments: async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("date", { ascending: false })
      .limit(500);
    if (error) {
      set({ error: toMessage(error) });
      return;
    }
    set({ documents: (data ?? []) as TradeDocument[] });
  },

  reloadPurchaseOrders: async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*")
      .order("date", { ascending: false })
      .limit(500);
    if (error) {
      set({ error: toMessage(error) });
      return;
    }
    set({ purchaseOrders: (data ?? []) as PurchaseOrder[] });
  },

  reloadTransactions: async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .limit(500);
    if (error) {
      set({ error: toMessage(error) });
      return;
    }
    set({ transactions: (data ?? []) as Transaction[] });
  },

  /* ============ บันทึกข้อมูล ============ */

  saveCustomer: async (input, id) => {
    const query = id
      ? supabase.from("customers").update(input).eq("id", id)
      : supabase.from("customers").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Customer;
    set((s) => ({
      customers: (id
        ? s.customers.map((c) => (c.id === id ? row : c))
        : [...s.customers, row]
      ).sort((a, b) => a.name.localeCompare(b.name, "th")),
    }));
    return row;
  },

  saveProduct: async (input, id) => {
    // สต๊อกขยับผ่าน addMove() เท่านั้น — ตัด stock ออกจากฟอร์มเสมอ (ฐานข้อมูลก็กันไว้อีกชั้น)
    const { stock: _ignored, ...payload } = input;
    const query = id
      ? supabase.from("products").update(payload).eq("id", id)
      : supabase.from("products").insert(payload);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Product;
    set((s) => ({
      products: (id
        ? s.products.map((p) => (p.id === id ? row : p))
        : [...s.products, row]
      ).sort((a, b) => a.name.localeCompare(b.name, "th")),
    }));
    return row;
  },

  saveOrder: async (input, id) => {
    const { items, ...rest } = input;
    // ห้ามแตะสถานะการตัดสต๊อกจากฟอร์มแก้ไขออเดอร์
    const { stock_deducted: _sd, status: _st, voided: _v, ...payload } = rest;

    const query = id
      ? supabase.from("orders").update(payload).eq("id", id)
      : supabase.from("orders").insert(payload);
    const { data, error } = await query.select("id").single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const orderId = (data as { id: UUID }).id;

    if (id) {
      const { error: delErr } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      if (delErr) {
        set({ error: toMessage(delErr) });
        throw delErr;
      }
    }

    if (items.length) {
      const { error: itemErr } = await supabase
        .from("order_items")
        .insert(items.map((it) => ({ ...it, order_id: orderId })));
      if (itemErr) {
        set({ error: toMessage(itemErr) });
        throw itemErr;
      }
    }

    const { data: full, error: readErr } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .single();
    if (readErr) {
      set({ error: toMessage(readErr) });
      throw readErr;
    }

    const row = full as Order;
    set((s) => ({
      orders: id
        ? s.orders.map((o) => (o.id === orderId ? row : o))
        : [row, ...s.orders],
    }));
    return row;
  },

  saveTransaction: async (input, id) => {
    const query = id
      ? supabase.from("transactions").update(input).eq("id", id)
      : supabase.from("transactions").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Transaction;
    set((s) => ({
      transactions: id
        ? s.transactions.map((t) => (t.id === id ? row : t))
        : [row, ...s.transactions],
    }));
    return row;
  },

  deleteTransaction: async (id) => {
    const row = get().transactions.find((t) => t.id === id);
    if (row?.ref_type) {
      const msg = "รายการนี้ระบบสร้างให้อัตโนมัติ ลบเองไม่ได้";
      set({ error: msg });
      throw new Error(msg);
    }
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  settleTransaction: async (id, amount, date) => {
    const { error } = await supabase.rpc("settle_transaction", {
      p_txn_id: id,
      p_amount: amount ?? null,
      p_date: date ?? null,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    // จ่ายบางส่วนจะแตกแถวใหม่ออกมา — ดึงทั้งชุดใหม่ให้ตรงฐานข้อมูล
    await get().reloadTransactions();
  },

  saveCategory: async (input, id) => {
    const payload = { ...input, name: (input.name ?? "").trim() };
    const query = id
      ? supabase.from("money_categories").update(payload).eq("id", id)
      : supabase.from("money_categories").insert(payload);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as MoneyCategory;
    set((s) => ({
      categories: id
        ? s.categories.map((c) => (c.id === id ? row : c))
        : [...s.categories, row],
    }));
    return row;
  },

  deleteCategory: async (id) => {
    const { error } = await supabase
      .from("money_categories")
      .delete()
      .eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },

  saveDocument: async (input, id) => {
    const query = id
      ? supabase.from("documents").update(input).eq("id", id)
      : supabase.from("documents").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as TradeDocument;
    set((s) => ({
      documents: id
        ? s.documents.map((d) => (d.id === id ? row : d))
        : [row, ...s.documents],
    }));
    return row;
  },

  nextDocNumber: async (type) => {
    const { data, error } = await supabase.rpc("next_doc_number", {
      p_type: type,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    return String(data);
  },

  convertDocument: async (id, toType) => {
    const { data, error } = await supabase.rpc("convert_document", {
      p_doc_id: id,
      p_to_type: toType,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    // ออกใบเสร็จจะปิดใบแจ้งหนี้ต้นทาง + ลงเงินเข้าให้ด้วย — ดึงใหม่ทั้งสองก้อน
    await Promise.all([get().reloadDocuments(), get().reloadTransactions()]);
    return data as TradeDocument;
  },

  markDocSent: async (id) => {
    const { data, error } = await supabase
      .from("documents")
      .update({ status: "ส่งแล้ว" })
      .eq("id", id)
      .eq("status", "ร่าง")
      .select()
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as TradeDocument;
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? row : d)),
    }));
  },

  deleteDocument: async (id) => {
    const doc = get().documents.find((d) => d.id === id);
    if (doc && doc.status !== "ร่าง") {
      const msg = "ลบได้เฉพาะเอกสารร่าง — ส่งให้ลูกค้าแล้วลบไม่ได้";
      set({ error: msg });
      throw new Error(msg);
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },

  saveSettings: async (input) => {
    const { data, error } = await supabase
      .from("shop_settings")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", true)
      .select()
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as ShopSettings;
    set({ settings: row });
    return row;
  },

  /* ---------- จัดซื้อ ---------- */

  saveVendor: async (input, id) => {
    const query = id
      ? supabase.from("vendors").update(input).eq("id", id)
      : supabase.from("vendors").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Vendor;
    set((s) => ({
      vendors: id
        ? s.vendors.map((v) => (v.id === id ? row : v))
        : [...s.vendors, row].sort((a, b) =>
            a.name.localeCompare(b.name, "th"),
          ),
    }));
    return row;
  },

  savePurchaseOrder: async (input, id) => {
    // สถานะ/ของที่รับ ขยับผ่านฟังก์ชันฐานข้อมูลเท่านั้น
    const { status: _s, received_items: _r, received_at: _a, ...safe } = input;
    const query = id
      ? supabase.from("purchase_orders").update(safe).eq("id", id)
      : supabase.from("purchase_orders").insert(safe);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as PurchaseOrder;
    set((s) => ({
      purchaseOrders: id
        ? s.purchaseOrders.map((p) => (p.id === id ? row : p))
        : [row, ...s.purchaseOrders],
    }));
    return row;
  },

  nextPoNumber: async () => {
    const { data, error } = await supabase.rpc("next_po_number");
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    return String(data);
  },

  sendPo: async (id) => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .update({ status: "สั่งแล้ว" })
      .eq("id", id)
      .eq("status", "ร่าง")
      .select()
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as PurchaseOrder;
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? row : p)),
    }));
  },

  receivePo: async (id, received) => {
    const { data, error } = await supabase.rpc("receive_po", {
      p_po_id: id,
      p_received: received,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    // รับของแล้วสต๊อก + ประวัติ + เจ้าหนี้ ขยับพร้อมกัน ดึงใหม่ทั้งชุด
    await Promise.all([
      get().reloadPurchaseOrders(),
      get().reloadProducts(),
      get().reloadTransactions(),
    ]);
    return data as PurchaseOrder;
  },

  cancelPo: async (id) => {
    const { data, error } = await supabase.rpc("cancel_po", { p_po_id: id });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as PurchaseOrder;
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? row : p)),
    }));
  },

  deletePurchaseOrder: async (id) => {
    const po = get().purchaseOrders.find((p) => p.id === id);
    if (po && po.status !== "ร่าง") {
      const msg = "ลบได้เฉพาะใบสั่งซื้อร่าง — ส่งให้ผู้ขายแล้วให้กดยกเลิกแทน";
      set({ error: msg });
      throw new Error(msg);
    }
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({
      purchaseOrders: s.purchaseOrders.filter((p) => p.id !== id),
    }));
  },

  /* ---------- พนักงาน & เงินเดือน ---------- */

  saveStaff: async (input, id) => {
    const query = id
      ? supabase.from("staff").update(input).eq("id", id)
      : supabase.from("staff").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Staff;
    set((s) => ({
      staff: id
        ? s.staff.map((x) => (x.id === id ? row : x))
        : [...s.staff, row].sort((a, b) => a.name.localeCompare(b.name, "th")),
    }));
    return row;
  },

  saveLeaveType: async (input, id) => {
    const query = id
      ? supabase.from("leave_types").update(input).eq("id", id)
      : supabase.from("leave_types").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as LeaveType;
    set((s) => ({
      leaveTypes: id
        ? s.leaveTypes.map((x) => (x.id === id ? row : x))
        : [...s.leaveTypes, row],
    }));
    return row;
  },

  deleteLeaveType: async (id) => {
    const { error } = await supabase.from("leave_types").delete().eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({ leaveTypes: s.leaveTypes.filter((x) => x.id !== id) }));
  },

  saveTimeLog: async (input) => {
    const { data, error } = await supabase
      .from("timelogs")
      .upsert(input, { onConflict: "staff_id,date" })
      .select()
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as TimeLog;
    set((s) => ({
      timelogs: s.timelogs.some((t) => t.id === row.id)
        ? s.timelogs.map((t) => (t.id === row.id ? row : t))
        : [row, ...s.timelogs],
    }));
    return row;
  },

  saveLeave: async (input, id) => {
    const query = id
      ? supabase.from("leaves").update(input).eq("id", id)
      : supabase.from("leaves").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Leave;
    set((s) => ({
      leaves: id
        ? s.leaves.map((x) => (x.id === id ? row : x))
        : [row, ...s.leaves],
    }));
    return row;
  },

  deleteLeave: async (id) => {
    const { error } = await supabase.from("leaves").delete().eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({ leaves: s.leaves.filter((x) => x.id !== id) }));
  },

  buildPayroll: async (period) => {
    const { data, error } = await supabase.rpc("build_payroll", {
      p_period: period,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Payroll;
    set((s) => ({
      payrolls: s.payrolls.some((p) => p.id === row.id)
        ? s.payrolls.map((p) => (p.id === row.id ? row : p))
        : [row, ...s.payrolls],
    }));
    return row;
  },

  savePayrollRows: async (id, rows) => {
    const { data, error } = await supabase
      .from("payrolls")
      .update({ rows })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Payroll;
    set((s) => ({ payrolls: s.payrolls.map((p) => (p.id === id ? row : p)) }));
    return row;
  },

  payPayroll: async (id) => {
    const { data, error } = await supabase.rpc("pay_payroll", {
      p_payroll_id: id,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Payroll;
    set((s) => ({ payrolls: s.payrolls.map((p) => (p.id === id ? row : p)) }));
    await get().reloadTransactions();
    return row;
  },

  deletePayroll: async (id) => {
    const { error } = await supabase.from("payrolls").delete().eq("id", id);
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    set((s) => ({ payrolls: s.payrolls.filter((p) => p.id !== id) }));
  },

  /* ---------- ถังแก๊ส ---------- */

  reloadCylinders: async () => {
    const [stock, deposits] = await Promise.all([
      supabase.from("cylinder_stock").select("*").order("sort_order"),
      supabase
        .from("cylinder_deposits")
        .select("*")
        .order("date", { ascending: false })
        .limit(500),
    ]);
    const failed = [stock, deposits].find((r) => r.error);
    if (failed?.error) {
      set({ error: toMessage(failed.error) });
      return;
    }
    set({
      cylinderStock: (stock.data ?? []) as CylinderStockRow[],
      deposits: (deposits.data ?? []) as CylinderDeposit[],
    });
  },

  saveCylinderSize: async (input, id) => {
    const query = id
      ? supabase.from("cylinder_sizes").update(input).eq("id", id)
      : supabase.from("cylinder_sizes").insert(input);
    const { data, error } = await query.select().single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as CylinderSize;
    set((s) => ({
      cylinderSizes: (id
        ? s.cylinderSizes.map((x) => (x.id === id ? row : x))
        : [...s.cylinderSizes, row]
      ).sort((a, b) => a.sort_order - b.sort_order),
    }));
    return row;
  },

  fillCylinders: async (size, qty, note) => {
    const { error } = await supabase.rpc("fill_cylinders", {
      p_size: size,
      p_qty: qty,
      p_note: note ?? "",
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    await Promise.all([get().reloadProducts(), get().reloadCylinders()]);
  },

  addDeposit: async (input) => {
    const { data, error } = await supabase.rpc("add_deposit", {
      p_customer_id: input.customer_id,
      p_size: input.size,
      p_type: input.type,
      p_qty: input.qty,
      p_amount: input.amount,
      p_date: input.date ?? null,
      p_note: input.note ?? "",
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as CylinderDeposit;
    set((s) => ({ deposits: [row, ...s.deposits] }));
    await get().reloadTransactions();
    return row;
  },

  saveCustody: async (input) => {
    const { data, error } = await supabase
      .from("cylinder_custody")
      .insert(input)
      .select()
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as CustodyEntry;
    set((s) => ({ custody: [row, ...s.custody] }));
    return row;
  },

  addMove: async ({ product_id, type, qty, note, ref_type, ref_id }) => {
    const { data, error } = await supabase.rpc("add_move", {
      p_product_id: product_id,
      p_type: type,
      p_qty: qty,
      p_note: note ?? "",
      p_ref_type: ref_type ?? null,
      p_ref_id: ref_id ?? null,
    });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as InventoryMove;
    set((s) => ({ moves: [row, ...s.moves] }));
    // สต๊อกเปลี่ยนแล้ว — ดึงสินค้ามาใหม่ให้ตัวเลขบนหน้าจอตรงกับฐานข้อมูล
    await get().reloadProducts();
    return row;
  },

  completeOrder: async (id) => {
    const { error } = await supabase.rpc("complete_order", { p_order_id: id });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    // ปิดออเดอร์ทีเดียวกระทบทั้งสต๊อกและบัญชี — ดึงใหม่ให้ครบ
    await Promise.all([get().reloadOrders(), get().reloadProducts()]);
    await get().reloadTransactions();
  },

  voidOrder: async (id) => {
    const { error } = await supabase.rpc("void_order", { p_order_id: id });
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    await Promise.all([get().reloadOrders(), get().reloadProducts()]);
    await get().reloadTransactions();
  },

  advanceOrderStage: async (id) => {
    const order = get().orders.find((o) => o.id === id);
    if (!order) return;
    const i = ORDER_STAGES.indexOf(order.work_stage);
    if (i < 0 || i >= ORDER_STAGES.length - 1) return;
    const next = ORDER_STAGES[i + 1];

    // ขั้นสุดท้าย "ปิด" = ปิดงานจริง ต้องตัดสต๊อกและลงเงินด้วย
    // (ฐานข้อมูลจะตั้ง work_stage='ปิด' ให้เองในขั้นตอนเดียวกัน)
    if (next === "ปิด" && !order.stock_deducted) {
      await get().completeOrder(id);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ work_stage: next })
      .eq("id", id)
      .select(ORDER_SELECT)
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Order;
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? row : o)) }));
  },

  setOrderAssignee: async (id, staffId) => {
    const { data, error } = await supabase
      .from("orders")
      .update({ assignee_id: staffId })
      .eq("id", id)
      .select(ORDER_SELECT)
      .single();
    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    const row = data as Order;
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? row : o)) }));
  },
}));
