import { useMemo, useState } from "react";
import { Ban, Pencil, Plus, Send, Trash2, Truck, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBaht, fmtDate, poStatusTone, todayStr } from "@/lib/constants";
import { uid } from "@/lib/uid";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { PoItem, PurchaseOrder, UUID, Vendor, VendorInput } from "@/types";

type Tab = "po" | "vendors";

interface DraftItem {
  key: string;
  product_id: string;
  name: string;
  qty: string;
  price: string;
}

const newItem = (): DraftItem => ({
  key: uid(),
  product_id: "",
  name: "",
  qty: "1",
  price: "",
});

export function PurchasesPage() {
  const { products, vendors, pos, vendorName, poTotal, vendorPayable } =
    useDerived();
  const savePurchaseOrder = useAppStore((s) => s.savePurchaseOrder);
  const nextPoNumber = useAppStore((s) => s.nextPoNumber);
  const sendPo = useAppStore((s) => s.sendPo);
  const receivePo = useAppStore((s) => s.receivePo);
  const cancelPo = useAppStore((s) => s.cancelPo);
  const deletePurchaseOrder = useAppStore((s) => s.deletePurchaseOrder);
  const saveVendor = useAppStore((s) => s.saveVendor);

  const [tab, setTab] = useState<Tab>("po");
  const [busy, setBusy] = useState(false);

  const [poOpen, setPoOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [vendorId, setVendorId] = useState<UUID | "">("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);

  const [receiveFor, setReceiveFor] = useState<PurchaseOrder | null>(null);
  const [received, setReceived] = useState<DraftItem[]>([]);
  const [cancelFor, setCancelFor] = useState<PurchaseOrder | null>(null);
  const [deleteFor, setDeleteFor] = useState<PurchaseOrder | null>(null);

  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorEditing, setVendorEditing] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState<VendorInput>({ name: "" });

  const amount = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
        0,
      ),
    [items],
  );

  const receivedAmount = useMemo(
    () =>
      received.reduce(
        (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
        0,
      ),
    [received],
  );

  function toDraft(list: PoItem[]): DraftItem[] {
    return list.map((it) => ({
      key: uid(),
      product_id: it.product_id ?? "",
      name: it.name,
      qty: String(it.qty),
      price: String(it.price),
    }));
  }

  function toPoItems(list: DraftItem[]): PoItem[] {
    return list
      .filter((it) => it.name.trim() && Number(it.qty) > 0)
      .map((it) => ({
        product_id: it.product_id || null,
        name: it.name.trim(),
        qty: Number(it.qty),
        price: Number(it.price) || 0,
      }));
  }

  function setItem(key: string, patch: Partial<DraftItem>) {
    setItems((list) =>
      list.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  /** เลือกสินค้าแล้วเติมชื่อ + ราคาทุนให้เอง แก้ทับได้ */
  function pickProduct(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    setItem(key, {
      product_id: productId,
      ...(p ? { name: p.name, price: String(p.cost ?? "") } : {}),
    });
  }

  function openNewPo() {
    setEditing(null);
    setVendorId("");
    setDate(todayStr());
    setNote("");
    setItems([newItem()]);
    setPoOpen(true);
  }

  function openEditPo(po: PurchaseOrder) {
    setEditing(po);
    setVendorId(po.vendor_id);
    setDate(po.date);
    setNote(po.note ?? "");
    setItems(po.items.length ? toDraft(po.items) : [newItem()]);
    setPoOpen(true);
  }

  async function submitPo() {
    const clean = toPoItems(items);
    if (!vendorId || !clean.length) return;
    setBusy(true);
    try {
      const number = editing ? editing.number : await nextPoNumber();
      await savePurchaseOrder(
        {
          number,
          vendor_id: vendorId,
          date,
          items: clean,
          note: note.trim() || null,
        },
        editing?.id,
      );
      setPoOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openReceive(po: PurchaseOrder) {
    setReceiveFor(po);
    setReceived(toDraft(po.items));
  }

  async function submitReceive() {
    if (!receiveFor) return;
    setBusy(true);
    try {
      await receivePo(receiveFor.id, toPoItems(received));
      setReceiveFor(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, done: () => void) {
    setBusy(true);
    try {
      await fn();
      done();
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openVendor(v: Vendor | null) {
    setVendorEditing(v);
    setVendorForm(
      v
        ? {
            name: v.name,
            phone: v.phone,
            tax_id: v.tax_id,
            address: v.address,
            note: v.note,
          }
        : { name: "" },
    );
    setVendorOpen(true);
  }

  async function submitVendor() {
    if (!vendorForm.name?.trim()) return;
    setBusy(true);
    try {
      await saveVendor(
        { ...vendorForm, name: vendorForm.name.trim() },
        vendorEditing?.id,
      );
      setVendorOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="จัดซื้อ"
        hint="สั่งของ → รับของเข้าคลัง → ตั้งเจ้าหนี้ให้อัตโนมัติ"
        action={
          tab === "po" ? (
            <Button
              icon={<Plus size={16} />}
              onClick={openNewPo}
              disabled={!vendors.length}
            >
              เปิดใบสั่งซื้อ
            </Button>
          ) : (
            <Button icon={<Plus size={16} />} onClick={() => openVendor(null)}>
              เพิ่มผู้ขาย
            </Button>
          )
        }
      />

      <Card>
        <div className="flex gap-1 border-b border-line p-3">
          {(
            [
              ["po", "ใบสั่งซื้อ"],
              ["vendors", "ผู้ขาย"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-btn px-3 py-1.5 text-sm ${
                tab === key
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "po" ? (
          <DataTable<PurchaseOrder>
            rows={pos}
            rowKey={(p) => p.id}
            empty={
              vendors.length
                ? "ยังไม่มีใบสั่งซื้อ กดปุ่ม “เปิดใบสั่งซื้อ” เพื่อเริ่ม"
                : "เพิ่มผู้ขายก่อน ถึงจะเปิดใบสั่งซื้อได้"
            }
            columns={[
              {
                header: "เลขที่",
                cell: (p) => (
                  <div>
                    <span className="font-medium text-ink">{p.number}</span>
                    <p className="text-xs text-muted">{fmtDate(p.date)}</p>
                  </div>
                ),
              },
              {
                header: "ผู้ขาย",
                hideOnMobile: true,
                cell: (p) => vendorName(p.vendor_id),
              },
              {
                header: "รายการ",
                hideOnMobile: true,
                align: "right",
                cell: (p) => `${p.items.length} รายการ`,
              },
              {
                header: "ยอดรวม",
                align: "right",
                cell: (p) => fmtBaht(poTotal(p)),
              },
              {
                header: "สถานะ",
                cell: (p) => (
                  <Badge tone={poStatusTone(p.status)}>{p.status}</Badge>
                ),
              },
              {
                header: "",
                align: "right",
                cell: (p) => (
                  <div className="flex justify-end gap-1">
                    {p.status === "ร่าง" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={14} />}
                          onClick={() => openEditPo(p)}
                        >
                          แก้ไข
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Send size={14} />}
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => sendPo(p.id),
                              () => {},
                            )
                          }
                        >
                          ส่งให้ผู้ขาย
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          onClick={() => setDeleteFor(p)}
                        >
                          ลบ
                        </Button>
                      </>
                    )}
                    {p.status === "สั่งแล้ว" && (
                      <>
                        <Button
                          variant="ok"
                          size="sm"
                          icon={<Truck size={14} />}
                          onClick={() => openReceive(p)}
                        >
                          รับของ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Ban size={14} />}
                          onClick={() => setCancelFor(p)}
                        >
                          ยกเลิก
                        </Button>
                      </>
                    )}
                    {p.status === "รับแล้ว" && p.received_at && (
                      <span className="text-xs text-muted">
                        รับเมื่อ {fmtDate(p.received_at)}
                      </span>
                    )}
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <DataTable<Vendor>
            rows={vendors}
            rowKey={(v) => v.id}
            empty="ยังไม่มีผู้ขาย กดปุ่ม “เพิ่มผู้ขาย” เพื่อเริ่ม"
            columns={[
              {
                header: "ชื่อผู้ขาย",
                cell: (v) => (
                  <div>
                    <span className="font-medium text-ink">{v.name}</span>
                    {v.tax_id && (
                      <p className="text-xs text-muted">เลขภาษี {v.tax_id}</p>
                    )}
                  </div>
                ),
              },
              { header: "เบอร์โทร", hideOnMobile: true, cell: (v) => v.phone },
              {
                header: "ค้างจ่าย",
                align: "right",
                cell: (v) => {
                  const owed = vendorPayable(v.id);
                  return owed > 0 ? (
                    <span className="font-medium text-danger">
                      {fmtBaht(owed)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  );
                },
              },
              {
                header: "",
                align: "right",
                cell: (v) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={14} />}
                    onClick={() => openVendor(v)}
                  >
                    แก้ไข
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* ---- ฟอร์มใบสั่งซื้อ ---- */}
      <Modal
        wide
        open={poOpen}
        onClose={() => setPoOpen(false)}
        title={editing ? `แก้ไข ${editing.number}` : "เปิดใบสั่งซื้อ"}
        hint={
          editing
            ? "แก้ได้เฉพาะตอนยังเป็นร่าง"
            : "เลขที่จะออกให้อัตโนมัติตอนกดบันทึก"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPoOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submitPo} disabled={busy || !vendorId}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ผู้ขาย">
              {(id) => (
                <Select
                  id={id}
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">เลือกผู้ขาย</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="วันที่สั่ง">
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
            <p className="mb-2 text-sm font-medium text-ink">รายการที่สั่ง</p>
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="grid gap-2 rounded-btn border border-line p-2 sm:grid-cols-[1fr_1fr_4.5rem_6rem_auto] sm:items-center sm:border-0 sm:p-0"
                >
                  <Select
                    aria-label="เลือกสินค้า"
                    value={it.product_id}
                    onChange={(e) => pickProduct(it.key, e.target.value)}
                  >
                    <option value="">ไม่ระบุสินค้า</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    aria-label="ชื่อรายการ"
                    value={it.name}
                    onChange={(e) => setItem(it.key, { name: e.target.value })}
                    placeholder="ชื่อของที่สั่ง"
                  />
                  <TextInput
                    aria-label="จำนวน"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={it.qty}
                    onChange={(e) => setItem(it.key, { qty: e.target.value })}
                  />
                  <TextInput
                    aria-label="ราคาต่อหน่วย"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={it.price}
                    onChange={(e) => setItem(it.key, { price: e.target.value })}
                    placeholder="ราคาทุน"
                  />
                  <button
                    type="button"
                    aria-label="ลบรายการนี้"
                    onClick={() =>
                      setItems((list) =>
                        list.length > 1
                          ? list.filter((x) => x.key !== it.key)
                          : list,
                      )
                    }
                    className="justify-self-end rounded-btn p-2 text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setItems((list) => [...list, newItem()])}
            >
              เพิ่มรายการ
            </Button>
            <p className="mt-1 text-xs text-muted">
              “ไม่ระบุสินค้า” = สั่งได้ แต่ตอนรับของจะไม่เข้าสต๊อก
            </p>
          </div>

          <Field label="หมายเหตุ">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ให้ส่งภายในวันศุกร์"
              />
            )}
          </Field>

          <div className="flex justify-between rounded-btn bg-paper px-3 py-2.5 text-sm">
            <span className="text-muted">ยอดสั่งซื้อ</span>
            <span className="font-medium text-ink tabular-nums">
              {fmtBaht(amount)}
            </span>
          </div>
        </div>
      </Modal>

      {/* ---- รับของ ---- */}
      <Modal
        wide
        open={!!receiveFor}
        onClose={() => setReceiveFor(null)}
        title={`รับของ ${receiveFor?.number ?? ""}`}
        hint="ใส่จำนวนเท่าที่ได้รับจริง — ของมาไม่ครบก็ปิดใบได้"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiveFor(null)}>
              ยกเลิก
            </Button>
            <Button variant="ok" onClick={submitReceive} disabled={busy}>
              {busy ? "กำลังรับของ…" : "ยืนยันรับของ"}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {received.map((it) => (
            <div
              key={it.key}
              className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem] sm:items-center"
            >
              <div>
                <p className="text-sm text-ink">{it.name}</p>
                {!it.product_id && (
                  <p className="text-xs text-warn">ไม่เข้าสต๊อก</p>
                )}
              </div>
              <TextInput
                aria-label={`จำนวนที่ได้รับของ ${it.name}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={it.qty}
                onChange={(e) =>
                  setReceived((list) =>
                    list.map((x) =>
                      x.key === it.key ? { ...x, qty: e.target.value } : x,
                    ),
                  )
                }
              />
              <TextInput
                aria-label={`ราคาต่อหน่วยของ ${it.name}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={it.price}
                onChange={(e) =>
                  setReceived((list) =>
                    list.map((x) =>
                      x.key === it.key ? { ...x, price: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-btn bg-paper px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">ยอดที่รับจริง</span>
            <span className="font-medium text-ink tabular-nums">
              {fmtBaht(receivedAmount)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            กดยืนยันแล้ว: สต๊อกเพิ่มทันที
            และตั้งเป็นเจ้าหนี้ค้างจ่ายในหน้าการเงิน
          </p>
        </div>
      </Modal>

      {/* ---- ยกเลิกใบสั่งซื้อ ---- */}
      <Modal
        open={!!cancelFor}
        onClose={() => setCancelFor(null)}
        title="ยกเลิกใบสั่งซื้อ"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelFor(null)}>
              ไม่ยกเลิก
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                cancelFor &&
                run(
                  () => cancelPo(cancelFor.id),
                  () => setCancelFor(null),
                )
              }
            >
              ยกเลิกใบนี้
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">ยกเลิก “{cancelFor?.number}” ใช่ไหม</p>
        <p className="mt-1 text-sm text-muted">
          ใบสั่งซื้อยังอยู่ในประวัติ แต่จะรับของไม่ได้อีก
        </p>
      </Modal>

      {/* ---- ลบใบร่าง ---- */}
      <Modal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="ลบใบสั่งซื้อร่าง"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteFor(null)}>
              ไม่ลบ
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                deleteFor &&
                run(
                  () => deletePurchaseOrder(deleteFor.id),
                  () => setDeleteFor(null),
                )
              }
            >
              ลบ
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">ลบ “{deleteFor?.number}” ใช่ไหม</p>
        <p className="mt-1 text-sm text-muted">
          เลขที่นี้จะไม่ถูกใช้ซ้ำ — เลขถัดไปเดินหน้าต่อเสมอ
        </p>
      </Modal>

      {/* ---- ฟอร์มผู้ขาย ---- */}
      <Modal
        open={vendorOpen}
        onClose={() => setVendorOpen(false)}
        title={vendorEditing ? "แก้ไขผู้ขาย" : "เพิ่มผู้ขาย"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVendorOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitVendor}
              disabled={busy || !vendorForm.name?.trim()}
            >
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ชื่อผู้ขาย">
            {(id) => (
              <TextInput
                id={id}
                value={vendorForm.name ?? ""}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, name: e.target.value })
                }
                placeholder="เช่น ปตท. คลังแก๊ส"
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="เบอร์โทร">
              {(id) => (
                <TextInput
                  id={id}
                  value={vendorForm.phone ?? ""}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, phone: e.target.value })
                  }
                />
              )}
            </Field>
            <Field label="เลขประจำตัวผู้เสียภาษี">
              {(id) => (
                <TextInput
                  id={id}
                  value={vendorForm.tax_id ?? ""}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, tax_id: e.target.value })
                  }
                />
              )}
            </Field>
          </div>
          <Field label="ที่อยู่">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={vendorForm.address ?? ""}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, address: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="หมายเหตุ">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={vendorForm.note ?? ""}
                onChange={(e) =>
                  setVendorForm({ ...vendorForm, note: e.target.value })
                }
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
