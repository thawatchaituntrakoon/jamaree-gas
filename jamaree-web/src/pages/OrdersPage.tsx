import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import type { Order, OrderItemInput, UUID } from "@/types";

type Filter = "ค้างส่ง" | "ทั้งหมด";

interface DraftItem extends OrderItemInput {
  /** คีย์ชั่วคราวสำหรับ React เท่านั้น ไม่ได้บันทึกลงฐานข้อมูล */
  key: string;
}

function newItem(): DraftItem {
  return { key: uid(), product_id: "", qty: 1 };
}

export function OrdersPage() {
  const { orders, products, customers, orderTotal, priceFor, customerName } =
    useDerived();
  const saveOrder = useAppStore((s) => s.saveOrder);

  const [filter, setFilter] = useState<Filter>("ค้างส่ง");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const [customerId, setCustomerId] = useState<UUID | "">("");
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [cash, setCash] = useState("0");
  const [transfer, setTransfer] = useState("0");

  const sellable = useMemo(() => products.filter((p) => p.active), [products]);

  const rows = useMemo(
    () =>
      filter === "ค้างส่ง"
        ? orders.filter((o) => !o.stock_deducted && !o.voided)
        : orders,
    [orders, filter],
  );

  const draftTotal = items.reduce((sum, it) => {
    if (!it.product_id) return sum;
    return (
      sum + priceFor(it.product_id, customerId || null) * Number(it.qty || 0)
    );
  }, 0);
  const paid = Number(cash || 0) + Number(transfer || 0);
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
        <div className="flex gap-1 border-b border-line p-3">
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

        <DataTable<Order>
          rows={rows}
          rowKey={(o) => o.id}
          empty={
            orders.length
              ? "ไม่มีบิลค้างส่ง สบายใจได้"
              : "ยังไม่มีบิล กดปุ่ม “เปิดบิลใหม่” เพื่อขายชิ้นแรก"
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
              cell: (o) =>
                !o.stock_deducted && !o.voided ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={14} />}
                    onClick={() => openEdit(o)}
                  >
                    แก้ไข
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        wide
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
            <Field label="ลูกค้า">
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
            <p className="mb-1.5 text-sm font-medium text-ink">รายการสินค้า</p>
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
                    className="min-w-0 flex-1 rounded-btn border border-line bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
                    step="0.01"
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
                    className="w-20 rounded-btn border border-line bg-card px-3 py-2 text-right text-sm focus:border-accent focus:outline-none"
                  />
                  <span className="w-24 text-right text-sm tabular-nums text-muted">
                    {it.product_id
                      ? fmtBaht(
                          priceFor(it.product_id, customerId || null) *
                            Number(it.qty || 0),
                        )
                      : "—"}
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
                    className="rounded-btn p-2 text-muted hover:bg-danger-soft hover:text-danger"
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
                  step="0.01"
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
                  step="0.01"
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
    </>
  );
}
