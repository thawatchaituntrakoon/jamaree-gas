import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { GAS_FILL_KINDS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import type {
  Leave,
  Order,
  PoItem,
  Product,
  PurchaseOrder,
  Staff,
  UUID,
} from "@/types";

/**
 * ตัวเลขทั้งหมดที่ "คำนวณสด" จากข้อมูลกลาง — ไม่มีการเก็บซ้ำลงฐานข้อมูล
 * รวมไว้ที่เดียวเพื่อให้ทุกหน้าคิดเลขเหมือนกันเป๊ะ (การ์ดหน้าแรกกับหน้ารายละเอียดต้องตรงกันเสมอ)
 */
export function useDerived() {
  const {
    products,
    customers,
    orders,
    transactions,
    custody,
    vendors,
    pos,
    staff,
    leaves,
    timelogs,
    deposits,
    documents,
    cylinderStock,
  } = useAppStore(
    useShallow((s) => ({
      products: s.products,
      customers: s.customers,
      orders: s.orders,
      transactions: s.transactions,
      custody: s.custody,
      vendors: s.vendors,
      pos: s.purchaseOrders,
      staff: s.staff,
      leaves: s.leaves,
      timelogs: s.timelogs,
      deposits: s.deposits,
      documents: s.documents,
      cylinderStock: s.cylinderStock,
    })),
  );
  return useMemo(() => {
    const productById = (id: UUID | null | undefined) =>
      products.find((p) => p.id === id);
    const customerById = (id: UUID | null | undefined) =>
      customers.find((c) => c.id === id);
    const customerName = (id: UUID | null | undefined) =>
      customerById(id)?.name ?? "ลูกค้าทั่วไป";

    /** ราคาขายตามชุดราคาของลูกค้า — จุดเดียวที่อ่านราคา กันราคาเพี้ยนไม่ตรงกัน */
    const priceFor = (productId: UUID, customerId?: UUID | null): number => {
      const product = productById(productId);
      if (!product) return 0;
      const tierId = customerById(customerId)?.price_tier_id;
      if (tierId) {
        const tierPrice = product.tier_prices?.[tierId];
        if (tierPrice != null && String(tierPrice) !== "") {
          return Number(tierPrice) || 0;
        }
      }
      return Number(product.price) || 0;
    };

    const orderTotal = (order: Order) =>
      order.items.reduce(
        (sum, it) =>
          sum + priceFor(it.product_id, order.customer_id) * Number(it.qty),
        0,
      );

    /** กำไรต่อบิล — ราคาขาย − ต้นทุน คิดสดทุกครั้ง */
    const orderProfit = (order: Order) =>
      order.items.reduce((sum, it) => {
        const product = productById(it.product_id);
        if (!product) return sum;
        const price = priceFor(it.product_id, order.customer_id);
        return sum + (price - (Number(product.cost) || 0)) * Number(it.qty);
      }, 0);

    /**
     * ยอดค้างชำระ "ตอนนี้"
     * ยังไม่ปิดบิล → ใช้ยอดที่กรอกไว้ในฟอร์ม
     * ปิดบิลแล้ว → ต้องอ่านจากแถวลูกหนี้จริง เพราะรับชำระบางส่วนแล้วยอดจะลดลงเรื่อย ๆ
     */
    const orderOutstanding = (order: Order) => {
      if (order.voided) return 0;
      if (!order.stock_deducted) {
        const paid = Number(order.paid_cash) + Number(order.paid_transfer);
        return Math.max(0, orderTotal(order) - paid);
      }
      const row = transactions.find(
        (t) => t.ref_type === "order" && t.ref_id === order.id && t.unpaid,
      );
      return row ? Number(row.amount) || 0 : 0;
    };

    /** บิลที่ยังไม่ปิด (ยังไม่ตัดสต๊อก และไม่ถูกยกเลิก) */
    const openOrders = orders.filter((o) => !o.stock_deducted && !o.voided);

    /** งานที่ยังไม่ถึงขั้น "ปิด" บนบอร์ดงาน — คนละเรื่องกับการตัดสต๊อก */
    const boardOrders = orders.filter(
      (o) => !o.voided && o.work_stage !== "ปิด",
    );

    /** ลูกหนี้ค้างทั้งร้าน */
    const receivableTotal = transactions
      .filter((t) => t.unpaid && t.type === "เข้า")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    /** เจ้าหนี้ที่เรายังไม่ได้จ่าย */
    const payableTotal = transactions
      .filter((t) => t.unpaid && t.type === "ออก")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    /** สรุปเงินเดือนนี้ — นับเฉพาะที่เก็บ/จ่ายจริงแล้ว ไม่รวมยอดค้าง */
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRows = transactions.filter(
      (t) => !t.unpaid && String(t.date).slice(0, 7) === thisMonth,
    );
    const monthIn = monthRows
      .filter((t) => t.type === "เข้า")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const monthOut = monthRows
      .filter((t) => t.type === "ออก")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const monthProfit = monthIn - monthOut;

    const customerDebt = (customerId: UUID) => {
      const ids = new Set(
        orders.filter((o) => o.customer_id === customerId).map((o) => o.id),
      );
      return transactions
        .filter(
          (t) =>
            t.unpaid &&
            t.type === "เข้า" &&
            t.ref_type === "order" &&
            t.ref_id != null &&
            ids.has(t.ref_id),
        )
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    };

    /** ถังที่ยังค้างอยู่กับลูกค้า แยกตามขนาด */
    const custodyBalance = (customerId: UUID) => {
      const bySize = new Map<string, { borrowed: number; deposited: number }>();
      for (const row of custody) {
        if (row.customer_id !== customerId) continue;
        const cur = bySize.get(row.size) ?? { borrowed: 0, deposited: 0 };
        const qty = Number(row.qty) || 0;
        if (row.type === "ยืม") cur.borrowed += qty;
        else if (row.type === "คืน") cur.borrowed -= qty;
        else if (row.type === "ฝาก") cur.deposited += qty;
        else if (row.type === "ถอนฝาก") cur.deposited -= qty;
        // เปลี่ยนถังชำรุด = แลกถังต่อถัง ยอดค้างไม่ขยับ
        bySize.set(row.size, cur);
      }
      return [...bySize.entries()]
        .map(([size, v]) => ({ size, ...v }))
        .filter((r) => r.borrowed !== 0 || r.deposited !== 0)
        .sort((a, b) => a.size.localeCompare(b.size, "th"));
    };

    /** ของใกล้หมด — ไม่นับบริการ และไม่นับของที่ไม่มีสต๊อกของตัวเอง */
    const lowStock: Product[] = products.filter(
      (p) =>
        p.active &&
        p.kind !== "บริการ" &&
        !GAS_FILL_KINDS.includes(p.kind) &&
        Number(p.low_at) > 0 &&
        Number(p.stock) <= Number(p.low_at),
    );

    /** แก๊สดิบในถังเก็บใหญ่ — มีได้แถวเดียว */
    const rawGas = products.find((p) => p.kind === "ดิบ");

    const vendorById = (id: UUID | null | undefined) =>
      vendors.find((v) => v.id === id);
    const vendorName = (id: UUID | null | undefined) =>
      vendorById(id)?.name ?? "—";

    const itemsTotal = (items: PoItem[] | null | undefined) =>
      (items ?? []).reduce(
        (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
        0,
      );

    /** ยอดใบสั่งซื้อ — รับของแล้วใช้ยอด "ที่ได้จริง" เสมอ */
    const poTotal = (po: PurchaseOrder) =>
      itemsTotal(po.received_items ?? po.items);

    /** ใบสั่งซื้อที่ส่งให้ผู้ขายแล้วแต่ของยังไม่มา */
    const pendingPos = pos.filter((p) => p.status === "สั่งแล้ว");

    /** ยอดค้างจ่ายของผู้ขายรายนั้น — นับจากบิลที่ระบบตั้งให้ตอนรับของ */
    const vendorPayable = (vendorId: UUID) => {
      const ids = new Set(
        pos.filter((p) => p.vendor_id === vendorId).map((p) => p.id),
      );
      return transactions
        .filter(
          (t) =>
            t.unpaid &&
            t.type === "ออก" &&
            t.ref_type === "po" &&
            t.ref_id != null &&
            ids.has(t.ref_id),
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
    };

    /* ---------- พนักงาน ---------- */

    const staffById = (id: UUID | null | undefined) =>
      staff.find((s) => s.id === id);
    const staffName = (id: UUID | null | undefined) =>
      staffById(id)?.name ?? "—";

    /** พนักงานที่ยังอยู่ — พ้นสภาพแล้วไม่โผล่ในลิสต์ทำงาน แต่ประวัติยังอยู่ */
    const activeStaff: Staff[] = staff.filter((s) => !s.terminated_at);

    const todayISO = new Date().toISOString().slice(0, 10);

    /** ใครลาวันนี้ (เฉพาะที่อนุมัติแล้ว) */
    const leaveToday: Leave[] = leaves.filter(
      (l) =>
        l.status === "อนุมัติ" &&
        l.date_from <= todayISO &&
        l.date_to >= todayISO,
    );

    /** ใครเช็คอินแล้ววันนี้ */
    const checkedInToday = new Set(
      timelogs
        .filter((t) => t.date === todayISO && t.in_at)
        .map((t) => t.staff_id),
    );

    /** วันลาที่ใช้ไปแล้วในปีนี้ แยกตามประเภท (นับเฉพาะที่อนุมัติ) */
    const leaveUsed = (staffId: UUID, type: string) => {
      const year = todayISO.slice(0, 4);
      return leaves
        .filter(
          (l) =>
            l.staff_id === staffId &&
            l.type === type &&
            l.status === "อนุมัติ" &&
            l.date_from.slice(0, 4) === year,
        )
        .reduce((sum, l) => sum + Number(l.days), 0);
    };

    /* ---------- ถังแก๊ส ---------- */

    /** ถังที่ลูกค้าวางมัดจำไว้ + เงินมัดจำที่ต้องคืน แยกตามขนาด */
    const depositBalance = (customerId: UUID) => {
      const bySize = new Map<string, { qty: number; amount: number }>();
      for (const d of deposits) {
        if (d.customer_id !== customerId) continue;
        const cur = bySize.get(d.size) ?? { qty: 0, amount: 0 };
        const sign = d.type === "รับมัดจำ" ? 1 : -1;
        cur.qty += sign * (Number(d.qty) || 0);
        cur.amount += sign * (Number(d.amount) || 0);
        bySize.set(d.size, cur);
      }
      return [...bySize.entries()]
        .map(([size, v]) => ({ size, ...v }))
        .filter((r) => r.qty !== 0 || r.amount !== 0)
        .sort((a, b) => a.size.localeCompare(b.size, "th"));
    };

    /** เงินมัดจำทั้งร้านที่ยังถืออยู่ — เป็นหนี้ที่ต้องคืนลูกค้าวันหนึ่ง */
    const depositHeld = deposits.reduce(
      (sum, d) =>
        sum + (d.type === "รับมัดจำ" ? 1 : -1) * (Number(d.amount) || 0),
      0,
    );

    /** ถังทั้งร้านรวมทุกขนาด */
    const cylinderTotals = cylinderStock.reduce(
      (acc, r) => ({
        filled: acc.filled + Number(r.filled),
        empty: acc.empty + Number(r.empty),
        atCustomer: acc.atCustomer + Number(r.at_customer),
      }),
      { filled: 0, empty: 0, atCustomer: 0 },
    );

    /* ---------- มูลค่าของในคลัง ---------- */

    /** Σ สต๊อก × ทุน — ของที่ยังไม่ได้ใส่ราคาทุนจะข้าม แล้วนับไว้เตือน */
    const stockValue = products.reduce(
      (acc, p) => {
        if (!p.active || p.kind === "บริการ") return acc;
        const cost = Number(p.cost);
        if (p.cost == null || String(p.cost) === "" || !Number.isFinite(cost)) {
          return { ...acc, noCostCount: acc.noCostCount + 1 };
        }
        return { ...acc, total: acc.total + Number(p.stock) * cost };
      },
      { total: 0, noCostCount: 0 },
    );

    /** เอกสารที่ยังเป็นร่าง — ค้างไว้ไม่ได้ส่งให้ลูกค้าสักที */
    const draftDocs = documents.filter((d) => d.status === "ร่าง");

    return {
      products,
      customers,
      orders,
      transactions,
      custody,
      productById,
      customerById,
      customerName,
      priceFor,
      orderTotal,
      orderProfit,
      orderOutstanding,
      openOrders,
      boardOrders,
      receivableTotal,
      payableTotal,
      monthIn,
      monthOut,
      monthProfit,
      customerDebt,
      custodyBalance,
      lowStock,
      rawGas,
      vendors,
      pos,
      vendorById,
      vendorName,
      itemsTotal,
      poTotal,
      pendingPos,
      vendorPayable,
      staff,
      leaves,
      timelogs,
      staffById,
      staffName,
      activeStaff,
      leaveToday,
      checkedInToday,
      leaveUsed,
      deposits,
      depositBalance,
      depositHeld,
      cylinderStock,
      cylinderTotals,
      stockValue,
      documents,
      draftDocs,
    };
  }, [
    products,
    customers,
    orders,
    transactions,
    custody,
    vendors,
    pos,
    staff,
    leaves,
    timelogs,
    deposits,
    documents,
    cylinderStock,
  ]);
}
