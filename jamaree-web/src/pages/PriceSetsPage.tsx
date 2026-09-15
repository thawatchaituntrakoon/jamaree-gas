import { useMemo, useState } from "react";
import { Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductThumb } from "@/components/ui/ProductThumb";
import { fmtBaht } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import type { PriceSetInput, PriceTier, Product, UUID } from "@/types";

const BLANK: PriceSetInput = { name: "", description: "", sort_order: 0 };

/** หนึ่งบรรทัดราคาในชุด — เก็บราคาเป็นข้อความระหว่างพิมพ์ ค่อยแปลงเป็นเลขตอนบันทึก */
interface DraftRow {
  product_id: UUID;
  price: string;
}

export function PriceSetsPage() {
  const priceTiers = useAppStore((s) => s.priceTiers);
  const priceSetItems = useAppStore((s) => s.priceSetItems);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const savePriceSet = useAppStore((s) => s.savePriceSet);
  const deletePriceSet = useAppStore((s) => s.deletePriceSet);
  const savePriceSetItem = useAppStore((s) => s.savePriceSetItem);
  const deletePriceSetItem = useAppStore((s) => s.deletePriceSetItem);

  const [editing, setEditing] = useState<PriceTier | null>(null);
  const [form, setForm] = useState<PriceSetInput>(BLANK);
  const [formOpen, setFormOpen] = useState(false);

  const [pricingSet, setPricingSet] = useState<PriceTier | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [addPick, setAddPick] = useState("");

  const [removing, setRemoving] = useState<PriceTier | null>(null);
  const [busy, setBusy] = useState(false);

  const sellable = useMemo(
    () => products.filter((p) => p.active && p.kind !== "ดิบ"),
    [products],
  );
  const productById = (id: UUID) => products.find((p) => p.id === id);

  const itemCount = (setId: UUID) =>
    priceSetItems.filter((i) => i.price_set_id === setId).length;
  const customerCount = (setId: UUID) =>
    customers.filter((c) => c.price_tier_id === setId).length;

  function openNew() {
    setEditing(null);
    setForm({
      ...BLANK,
      sort_order: priceTiers.length
        ? Math.max(...priceTiers.map((t) => t.sort_order)) + 1
        : 1,
    });
    setFormOpen(true);
  }

  function openEdit(t: PriceTier) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      sort_order: t.sort_order,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name?.trim()) return;
    setBusy(true);
    try {
      await savePriceSet(form, editing?.id);
      setFormOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openPricing(t: PriceTier) {
    setPricingSet(t);
    setAddPick("");
    setDraft(
      priceSetItems
        .filter((i) => i.price_set_id === t.id)
        .map((i) => ({
          product_id: i.product_id,
          price: String(i.custom_price),
        }))
        .sort((a, b) =>
          (productById(a.product_id)?.name ?? "").localeCompare(
            productById(b.product_id)?.name ?? "",
            "th",
          ),
        ),
    );
  }

  function addToDraft(productId: UUID) {
    if (!productId || draft.some((d) => d.product_id === productId)) return;
    const p = productById(productId);
    setDraft([
      ...draft,
      { product_id: productId, price: String(p?.price ?? 0) },
    ]);
    setAddPick("");
  }

  /** บันทึกทีเดียวทั้งชุด — เพิ่ม/แก้เฉพาะแถวที่เปลี่ยนจริง แถวที่เอาออกค่อยลบ */
  async function savePricing() {
    if (!pricingSet) return;
    const setId = pricingSet.id;
    const existing = priceSetItems.filter((i) => i.price_set_id === setId);
    setBusy(true);
    try {
      for (const row of draft) {
        const price = Number(row.price);
        if (!Number.isFinite(price) || price < 0) continue;
        const was = existing.find((i) => i.product_id === row.product_id);
        if (!was) {
          await savePriceSetItem({
            price_set_id: setId,
            product_id: row.product_id,
            custom_price: price,
          });
        } else if (Number(was.custom_price) !== price) {
          await savePriceSetItem(
            {
              price_set_id: setId,
              product_id: row.product_id,
              custom_price: price,
            },
            was.id,
          );
        }
      }
      for (const was of existing) {
        if (!draft.some((d) => d.product_id === was.product_id)) {
          await deletePriceSetItem(was.id);
        }
      }
      setPricingSet(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deletePriceSet(removing.id);
      setRemoving(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  const pickable = sellable.filter(
    (p) => !draft.some((d) => d.product_id === p.id),
  );

  return (
    <>
      <PageHeader
        title="ชุดราคา"
        hint="ตั้งราคาพิเศษให้ลูกค้าแต่ละกลุ่ม — สินค้าที่ไม่ได้ตั้งไว้จะใช้ราคาปกติ"
        action={
          <Button icon={<Plus size={16} />} onClick={openNew}>
            เพิ่มชุดราคา
          </Button>
        }
      />

      <Card>
        <DataTable<PriceTier>
          rows={priceTiers}
          rowKey={(t) => t.id}
          empty="ยังไม่มีชุดราคา กดปุ่ม “เพิ่มชุดราคา” เพื่อเริ่ม"
          columns={[
            {
              header: "ชื่อชุดราคา",
              cell: (t) => (
                <div>
                  <p className="font-medium text-ink">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-muted">{t.description}</p>
                  )}
                </div>
              ),
            },
            {
              header: "ตั้งราคาไว้",
              align: "right",
              cell: (t) =>
                itemCount(t.id) > 0 ? (
                  `${itemCount(t.id)} รายการ`
                ) : (
                  <span className="text-muted">ยังไม่ได้ตั้ง</span>
                ),
            },
            {
              header: "ลูกค้าที่ใช้",
              align: "right",
              hideOnMobile: true,
              cell: (t) =>
                customerCount(t.id) > 0 ? (
                  <Badge tone="info">{customerCount(t.id)} ราย</Badge>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              header: "",
              align: "right",
              cell: (t) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Tags size={14} />}
                    onClick={() => openPricing(t)}
                  >
                    ตั้งราคาสินค้า
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={14} />}
                    onClick={() => openEdit(t)}
                  >
                    แก้ไข
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setRemoving(t)}
                  >
                    ลบ
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ---- ฟอร์มชุดราคา ---- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "แก้ไขชุดราคา" : "เพิ่มชุดราคา"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submitForm} disabled={busy || !form.name?.trim()}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ชื่อชุดราคา">
            {(id) => (
              <TextInput
                id={id}
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น ราคาส่ง VIP"
              />
            )}
          </Field>
          <Field label="คำอธิบาย" hint="ไว้เตือนความจำว่าชุดนี้ใช้กับใคร">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="เช่น ร้านอาหารที่สั่งเกิน 20 ถังต่อเดือน"
              />
            )}
          </Field>
          <Field label="ลำดับการแสดง">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                value={form.sort_order ?? 0}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number(e.target.value) })
                }
              />
            )}
          </Field>
        </div>
      </Modal>

      {/* ---- ตั้งราคาสินค้าในชุด ---- */}
      <Modal
        open={!!pricingSet}
        onClose={() => setPricingSet(null)}
        title={`ตั้งราคาสินค้า — ${pricingSet?.name ?? ""}`}
        hint="สินค้าที่ไม่อยู่ในรายการนี้ ลูกค้ากลุ่มนี้จะจ่ายราคาปกติ"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setPricingSet(null)}>
              ยกเลิก
            </Button>
            <Button onClick={savePricing} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกราคา"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Field label="เพิ่มสินค้าเข้าชุดนี้">
                {(id) => (
                  <Select
                    id={id}
                    value={addPick}
                    onChange={(e) => addToDraft(e.target.value)}
                    disabled={!pickable.length}
                  >
                    <option value="">
                      {pickable.length
                        ? "เลือกสินค้า…"
                        : "ตั้งราคาครบทุกสินค้าแล้ว"}
                    </option>
                    {pickable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (ปกติ {fmtBaht(Number(p.price))})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>

          {draft.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              ยังไม่ได้ตั้งราคาสินค้าในชุดนี้ — เลือกสินค้าจากช่องด้านบน
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line">
              {draft.map((row) => {
                const p = productById(row.product_id) as Product | undefined;
                return (
                  <li
                    key={row.product_id}
                    className="flex flex-wrap items-center gap-3 px-3.5 py-2.5"
                  >
                    <ProductThumb url={p?.image_url} name={p?.name ?? ""} />
                    <div className="min-w-32 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {p?.name ?? "สินค้าถูกลบไปแล้ว"}
                      </p>
                      <p className="text-xs text-muted">
                        ราคาปกติ {fmtBaht(Number(p?.price ?? 0))} บาท
                      </p>
                    </div>
                    <div className="w-32">
                      <TextInput
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`ราคาของ ${p?.name ?? ""}`}
                        value={row.price}
                        onChange={(e) =>
                          setDraft(
                            draft.map((d) =>
                              d.product_id === row.product_id
                                ? { ...d, price: e.target.value }
                                : d,
                            ),
                          )
                        }
                        className="text-right"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<X size={14} />}
                      aria-label={`เอา ${p?.name ?? ""} ออกจากชุดราคา`}
                      onClick={() =>
                        setDraft(
                          draft.filter((d) => d.product_id !== row.product_id),
                        )
                      }
                    >
                      เอาออก
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* ---- ยืนยันการลบ ---- */}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="ลบชุดราคา"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={confirmRemove} disabled={busy}>
              {busy ? "กำลังลบ…" : "ลบชุดราคา"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          ลบชุดราคา “{removing?.name}” ใช่ไหม? ราคาที่ตั้งไว้{" "}
          {removing ? itemCount(removing.id) : 0} รายการจะหายไปด้วย
        </p>
        {!!removing && customerCount(removing.id) > 0 && (
          <p className="mt-3 rounded-card bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            มีลูกค้า {customerCount(removing.id)} รายใช้ชุดนี้อยู่ — ลบแล้วจะ
            กลับไปใช้ราคาปกติของสินค้าทันที
          </p>
        )}
      </Modal>
    </>
  );
}
