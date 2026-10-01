import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import {
  Ban,
  Eye,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { OrderPairPrintTemplate } from "@/components/print/OrderPairPrintTemplate";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBaht, fmtDate, todayStr, workStageTone } from "@/lib/constants";
import { uid } from "@/lib/uid";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import { roleAllowed, useAuthStore } from "@/store/useAuthStore";
import type { AccessRole, Order, OrderItemInput, UUID } from "@/types";

type Filter = "ค้างส่ง" | "ทั้งหมด";

/** ยกเลิกบิลที่ตัดสต๊อกไปแล้ว = คืนของเข้าคลัง + ลบเงินออกจากบัญชี — จำกัดไว้ที่หัวหน้า */
const VOID_ROLES: readonly AccessRole[] = ["SUPER_ADMIN", "MANAGER"];

interface DraftItem extends OrderItemInput {
  /** คีย์ชั่วคราวสำหรับ React เท่านั้น ไม่ได้บันทึกลงฐานข้อมูล */
  key: string;
}

function newItem(): DraftItem {
  return { key: uid(), product_id: "", qty: 1 };
}

export function OrdersPage() {
  const {
    orders,
    products,
    customers,
    orderTotal,
    priceFor,
    hasCustomPrice,
    customerName,
    productById,
  } = useDerived();
  const saveOrder = useAppStore((s) => s.saveOrder);
  const voidOrder = useAppStore((s) => s.voidOrder);
  const priceTiers = useAppStore((s) => s.priceTiers);
  const role = useAuthStore((s) => s.simulatedRole ?? s.role);
  const canVoid = roleAllowed(role, VOID_ROLES);
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("ค้างส่ง");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [voidFor, setVoidFor] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  // พิมพ์ใบส่งของ+บิลคู่กันบนกระดาษ A4 แผ่นเดียว — n ไว้บังคับให้พิมพ์ซ้ำบิลเดิมได้
  const [printJob, setPrintJob] = useState<{ order: Order; n: number } | null>(
    null,
  );
  const printRef = useRef<HTMLDivElement>(null);
  const clearPrintJob = useCallback(() => setPrintJob(null), []);
  const printTitle = useCallback(
    () => `ใบส่งของ-บิล-${printJob?.order.id.slice(0, 8).toUpperCase() ?? ""}`,
    [printJob],
  );
  const printPair = useReactToPrint({
    contentRef: printRef,
    documentTitle: printTitle(),
    onAfterPrint: clearPrintJob,
  });
  useEffect(() => {
    if (printJob) printPair();
  }, [printJob, printPair]);

  const [customerId, setCustomerId] = useState<UUID | "">("");
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [cash, setCash] = useState("0");
  const [transfer, setTransfer] = useState("0");

  const sellable = useMemo(() => products.filter((p) => p.active), [products]);

  const filtered = !!query.trim() || !!from || !!to;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "ค้างส่ง" && (o.stock_deducted || o.voided)) return false;
      // o.date เป็น 'YYYY-MM-DD' เทียบเป็นสตริงตรง ๆ ได้เลย
      if (from && o.date < from) return false;
      if (to && o.date > to) return false;
      if (!q) return true;
      const hay = [
        o.id.slice(0, 8),
        customerName(o.customer_id),
        ...o.items.map((it) => productById(it.product_id)?.name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, filter, query, from, to, customerName, productById]);

  function clearFilters() {
    setQuery("");
    setFrom("");
    setTo("");
  }

  const draftTotal = items.reduce((sum, it) => {
    if (!it.product_id) return sum;
    return (
      sum + priceFor(it.product_id, customerId || null) * Number(it.qty || 0)
    );
  }, 0);
  const paid = Number(cash || 0) + Number(transfer || 0);

  const priceSetId = customers.find((c) => c.id === customerId)?.price_tier_id;
  const priceSet = priceTiers.find((t) => t.id === priceSetId);
  const priceSetHint = priceSet
    ? `ใช้ราคาชุด “${priceSet.name}” — ★ คือรายการที่ได้ราคาพิเศษ`
    : customerId
      ? "ลูกค้ารายนี้ใช้ราคาปกติของสินค้า"
      : undefined;
  const remain = Math.max(0, draftTotal - paid);

  function openNew() {
    setEditing(null);
    setCustomerId("");
    setDate(todayStr());
    setItems([newItem()]);
    setCash("0");
    setTransfer("0");
    setOpen(true);
  }

  function openEdit(o: Order) {
    setEditing(o);
    setCustomerId(o.customer_id ?? "");
    setDate(o.date);
    setItems(
      o.items.length
        ? o.items.map((it) => ({
            key: it.id,
            product_id: it.product_id,
            qty: Number(it.qty),
          }))
        : [newItem()],
    );
    setCash(String(o.paid_cash));
    setTransfer(String(o.paid_transfer));
    setOpen(true);
  }

  async function submit() {
    const clean = items
      .filter((it) => it.product_id && Number(it.qty) > 0)
      .map(({ product_id, qty }) => ({ product_id, qty: Number(qty) }));
    if (!clean.length) return;
    setBusy(true);
    try {
      await saveOrder(
        {
          customer_id: customerId || null,
          date,
          items: clean,
          paid_cash: Number(cash || 0),
          paid_transfer: Number(transfer || 0),
        },
        editing?.id,
      );
      setOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function submitVoid() {
    if (!voidFor) return;
    setBusy(true);
    try {
      await voidOrder(voidFor.id);
      setVoidFor(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="ออเดอร์"
        hint="เปิดบิลไว้ก่อน แล้วค่อยกด “ปิดบิล” ตอนส่งของ — ระบบจะตัดสต๊อกให้เอง"
        action={
          <Button icon={<Plus size={16} />} onClick={openNew}>
            เปิดบิลใหม่
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex gap-1">
            {(["ค้างส่ง", "ทั้งหมด"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={[
                  "rounded-btn px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-paper",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative min-w-52 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า เลขที่บิล หรือชื่อสินค้า"
              aria-label="ค้นหาบิล"
              className="w-full rounded-btn border border-line bg-card py-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <TextInput
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="ตั้งแต่วันที่"
              className="w-[9.5rem]!"
            />
            <span className="text-sm text-muted">ถึง</span>
            <TextInput
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              aria-label="ถึงวันที่"
              className="w-[9.5rem]!"
            />
          </div>

          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X size={14} />}
              onClick={clearFilters}
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        <DataTable<Order>
          rows={rows}
          rowKey={(o) => o.id}
          empty={
            !orders.length
              ? "ยังไม่มีบิล กดปุ่ม “เปิดบิลใหม่” เพื่อขายชิ้นแรก"
              : filtered
                ? "ไม่พบบิลตามเงื่อนไขที่ค้นหา"
                : "ไม่มีบิลค้างส่ง สบายใจได้"
          }
          columns={[
            {
              header: "วันที่",
              cell: (o) => (
                <Link
                  to={`/orders/${o.id}`}
                  className="text-ink hover:text-accent hover:underline"
                >
                  {fmtDate(o.date)}
                </Link>
              ),
            },
            {
              header: "ลูกค้า",
              cell: (o) =>
                o.customer_id ? (
                  <Link
                    to={`/customers/${o.customer_id}`}
                    className="text-ink hover:text-accent hover:underline"
                  >
                    {customerName(o.customer_id)}
                  </Link>
                ) : (
                  <span className="text-muted">ลูกค้าทั่วไป</span>
                ),
            },
            {
              header: "รายการ",
              hideOnMobile: true,
              cell: (o) => `${o.items.length} รายการ`,
            },
            {
              header: "สถานะ",
              cell: (o) =>
                o.voided ? (
                  <Badge tone="danger">ยกเลิกแล้ว</Badge>
                ) : (
                  <Badge tone={workStageTone(o.work_stage)}>
                    {o.work_stage}
                  </Badge>
                ),
            },
            {
              header: "ยอดรวม",
              align: "right",
              cell: (o) => fmtBaht(orderTotal(o)),
            },
            {
              header: "",
              align: "right",
              cell: (o) => (
                <div className="flex flex-wrap justify-end gap-1">
                  {!o.stock_deducted && !o.voided && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil size={14} />}
                      onClick={() => openEdit(o)}
                    >
                      แก้ไข
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Eye size={14} />}
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    ดูรายละเอียด
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Printer size={14} />}
                    onClick={() => setPrintJob({ order: o, n: Date.now() })}
                  >
                    พิมพ์ใบส่งของ+บิล
                  </Button>
                  {canVoid && o.stock_deducted && !o.voided && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Ban size={14} />}
                      onClick={() => setVoidFor(o)}
                    >
                      ยกเลิกบิล
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        full
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "แก้ไขบิล" : "เปิดบิลใหม่"}
        hint="ราคาคิดตามชุดราคาของลูกค้าโดยอัตโนมัติ"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submit}
              disabled={
                busy || !items.some((it) => it.product_id && Number(it.qty) > 0)
              }
            >
              {busy ? "กำลังบันทึก…" : "บันทึกบิล"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="ลูกค้า" hint={priceSetHint}>
              {(id) => (
                <Select
                  id={id}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">ลูกค้าทั่วไป (ไม่ระบุ)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="วันที่">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              )}
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted">
              <span className="min-w-0 flex-1">สินค้า</span>
              <span className="w-28 text-right">จำนวน</span>
              <span className="w-32 text-right">จำนวนเงิน</span>
              <span className="w-9" />
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.key} className="flex items-center gap-2">
                  <select
                    aria-label={`สินค้าบรรทัดที่ ${idx + 1}`}
                    value={it.product_id}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.key === it.key
                            ? { ...x, product_id: e.target.value }
                            : x,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 rounded-btn border border-line bg-card px-3 py-2 text-base focus:border-accent focus:outline-none"
                  >
                    <option value="">— เลือกสินค้า —</option>
                    {sellable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.size ? ` (${p.size})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`จำนวนบรรทัดที่ ${idx + 1}`}
                    type="number"
                    min={0}
                    step="1"
                    value={it.qty}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.key === it.key
                            ? { ...x, qty: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                    className="w-28 rounded-btn border border-line bg-card px-3 py-2 text-right text-base tabular-nums focus:border-accent focus:outline-none"
                  />
                  <span className="w-32 text-right text-base tabular-nums text-ink">
                    {it.product_id ? (
                      <>
                        {fmtBaht(
                          priceFor(it.product_id, customerId || null) *
                            Number(it.qty || 0),
                        )}
                        <span className="block text-xs text-muted">
                          @
                          {fmtBaht(priceFor(it.product_id, customerId || null))}
                          {hasCustomPrice(
                            it.product_id,
                            customerId || null,
                          ) && <span className="text-accent"> ★</span>}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`ลบบรรทัดที่ ${idx + 1}`}
                    onClick={() =>
                      setItems(
                        items.length > 1
                          ? items.filter((x) => x.key !== it.key)
                          : [newItem()],
                      )
                    }
                    className="w-9 shrink-0 rounded-btn p-2 text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} />}
              className="mt-2"
              onClick={() => setItems([...items, newItem()])}
            >
              เพิ่มรายการ
            </Button>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="รับเงินสด (บาท)">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                />
              )}
            </Field>
            <Field label="รับโอน (บาท)">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  value={transfer}
                  onChange={(e) => setTransfer(e.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="rounded-card bg-paper px-4 py-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted">ยอดรวม</span>
              <span className="font-medium text-ink">
                {fmtBaht(draftTotal)} บาท
              </span>
            </p>
            <p className="mt-1 flex justify-between">
              <span className="text-muted">จ่ายแล้ว</span>
              <span className="text-ink">{fmtBaht(paid)} บาท</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-line pt-1.5">
              <span className="text-muted">ค้างชำระ</span>
              <span
                className={remain > 0 ? "font-medium text-warn" : "text-ok"}
              >
                {remain > 0 ? `${fmtBaht(remain)} บาท` : "จ่ายครบแล้ว"}
              </span>
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={voidFor !== null}
        onClose={() => setVoidFor(null)}
        title="ยกเลิกบิลนี้?"
        hint={voidFor ? `บิลวันที่ ${fmtDate(voidFor.date)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidFor(null)}>
              ไม่ยกเลิก
            </Button>
            <Button variant="danger" disabled={busy} onClick={submitVoid}>
              {busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิกบิล"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          ระบบจะ<b>คืนของเข้าสต๊อกกลับทั้งหมด</b>{" "}
          และลบยอดเงินของบิลนี้ออกจากบัญชี
        </p>
        <p className="mt-2 text-sm text-muted">
          ตัวบิลจะยังอยู่ในประวัติ แค่ถูกทำเครื่องหมายว่ายกเลิกแล้ว
        </p>
      </Modal>

      {/* กระดาษที่จะพิมพ์ — ซ่อนออกไปนอกจอ ไม่ใช่ display:none เพราะตัวพิมพ์ต้องวัดขนาดได้ */}
      {printJob && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 -left-[9999px] print:hidden"
        >
          <OrderPairPrintTemplate order={printJob.order} ref={printRef} />
        </div>
      )}
    </>
  );
}
