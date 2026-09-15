import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductThumb } from "@/components/ui/ProductThumb";
import {
  GAS_FILL_KINDS,
  PRODUCT_KINDS,
  fmtBaht,
  fmtQty,
} from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { uploadProductImage } from "@/lib/uploadProductImage";
import { useAppStore } from "@/store/useAppStore";
import type { MoveType, Product, ProductInput, ProductKind } from "@/types";

const BLANK: ProductInput = {
  name: "",
  sku: "",
  unit: "ถัง",
  kind: "",
  size: "",
  fill_kg: null,
  low_at: 0,
  price: 0,
  cost: null,
  active: true,
  image_url: "",
};

/** สินค้าที่ไม่มีสต๊อกของตัวเอง — ตัดจากถังเก็บใหญ่ตอนขายแทน */
function usesRawGas(kind: ProductKind) {
  return GAS_FILL_KINDS.includes(kind);
}

export function ProductsPage() {
  const { products, lowStock } = useDerived();
  const saveProduct = useAppStore((s) => s.saveProduct);
  const addMove = useAppStore((s) => s.addMove);

  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(BLANK);
  const [formOpen, setFormOpen] = useState(false);

  const [moveFor, setMoveFor] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState<MoveType>("รับเข้า");
  const [moveQty, setMoveQty] = useState("");
  const [moveNote, setMoveNote] = useState("");

  const [busy, setBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState("");

  const lowIds = useMemo(() => new Set(lowStock.map((p) => p.id)), [lowStock]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyLow && !lowIds.has(p.id)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.size ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, onlyLow, lowIds]);

  function openNew() {
    setEditing(null);
    setForm(BLANK);
    resetImagePicker();
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      unit: p.unit,
      kind: p.kind,
      size: p.size ?? "",
      fill_kg: p.fill_kg,
      low_at: p.low_at,
      price: p.price,
      cost: p.cost,
      active: p.active,
      image_url: p.image_url ?? "",
    });
    resetImagePicker();
    setFormOpen(true);
  }

  function resetImagePicker() {
    setImgError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError("");
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setImgError(
        err instanceof Error
          ? err.message
          : "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง",
      );
    } finally {
      setUploading(false);
      // เคลียร์ช่องไฟล์ เผื่อเลือกรูปเดิมซ้ำอีกครั้ง
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearImage() {
    setForm((f) => ({ ...f, image_url: "" }));
    resetImagePicker();
  }

  async function submitForm() {
    if (!form.name?.trim()) return;
    setBusy(true);
    try {
      await saveProduct(
        {
          ...form,
          name: form.name.trim(),
          sku: form.sku?.trim() || null,
          size: form.size?.trim() || null,
          fill_kg: usesRawGas(form.kind ?? "")
            ? Number(form.fill_kg) || 0
            : null,
          cost:
            form.cost === null || form.cost === undefined
              ? null
              : Number(form.cost),
        },
        editing?.id,
      );
      setFormOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openMove(p: Product, type: MoveType) {
    setMoveFor(p);
    setMoveType(type);
    setMoveQty("");
    setMoveNote("");
  }

  async function submitMove() {
    if (!moveFor) return;
    const qty = Number(moveQty);
    if (!(qty > 0)) return;
    setBusy(true);
    try {
      await addMove({
        product_id: moveFor.id,
        type: moveType,
        qty,
        note: moveNote.trim(),
      });
      setMoveFor(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  const kindIsService = form.kind === "บริการ";

  return (
    <>
      <PageHeader
        title="สินค้า"
        hint="จำนวนคงเหลือแก้ตรง ๆ ไม่ได้ — ต้องบันทึกรับเข้า/เบิกออกเสมอ"
        action={
          <Button icon={<Plus size={16} />} onClick={openNew}>
            เพิ่มสินค้า
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="relative min-w-52 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ รหัส หรือขนาด"
              aria-label="ค้นหาสินค้า"
              className="w-full rounded-btn border border-line bg-card py-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
              className="size-4 accent-[#dc2626]"
            />
            เฉพาะของใกล้หมด ({lowStock.length})
          </label>
        </div>

        <DataTable<Product>
          rows={rows}
          rowKey={(p) => p.id}
          empty={
            products.length
              ? "ไม่พบสินค้าที่ค้นหา"
              : "ยังไม่มีสินค้า กดปุ่ม “เพิ่มสินค้า” เพื่อเริ่ม"
          }
          columns={[
            {
              header: "สินค้า",
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <ProductThumb url={p.image_url} name={p.name} />
                  <div className="min-w-0">
                    <Link
                      to={`/products/${p.id}`}
                      className="font-medium text-ink hover:text-accent hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {[p.kind || "สินค้าทั่วไป", p.size]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              header: "คงเหลือ",
              align: "right",
              cell: (p) =>
                usesRawGas(p.kind) ? (
                  <span className="text-xs text-muted">ตัดจากถังใหญ่</span>
                ) : p.kind === "บริการ" ? (
                  <span className="text-xs text-muted">ไม่นับสต๊อก</span>
                ) : (
                  <span
                    className={
                      lowIds.has(p.id) ? "font-medium text-danger" : "text-ink"
                    }
                  >
                    {fmtQty(Number(p.stock))} {p.unit}
                  </span>
                ),
            },
            {
              header: "จุดเตือน",
              align: "right",
              hideOnMobile: true,
              cell: (p) =>
                Number(p.low_at) > 0 ? fmtQty(Number(p.low_at)) : "—",
            },
            {
              header: "ราคาขาย",
              align: "right",
              cell: (p) => fmtBaht(Number(p.price)),
            },
            {
              header: "",
              align: "right",
              cell: (p) => (
                <div className="flex justify-end gap-1">
                  {!usesRawGas(p.kind) && p.kind !== "บริการ" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowDownToLine size={14} />}
                        onClick={() => openMove(p, "รับเข้า")}
                      >
                        รับเข้า
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUpFromLine size={14} />}
                        onClick={() => openMove(p, "เบิกออก")}
                      >
                        เบิกออก
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={14} />}
                    onClick={() => openEdit(p)}
                  >
                    แก้ไข
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ---- ฟอร์มสินค้า ---- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
        hint="จำนวนคงเหลือไม่อยู่ในฟอร์มนี้ — ต้องบันทึกผ่านรับเข้า/เบิกออก"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitForm}
              disabled={busy || uploading || !form.name?.trim()}
            >
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ชื่อสินค้า">
            {(id) => (
              <TextInput
                id={id}
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น แก๊สหุงต้ม 15 กก."
              />
            )}
          </Field>

          <Field
            label="รูปสินค้า"
            hint="เลือกรูปจากเครื่อง ไฟล์ JPG PNG WEBP หรือ GIF ไม่เกิน 3 MB — ไม่ใส่ก็ได้"
          >
            {(id) => (
              <div className="flex items-start gap-3">
                <ProductThumb
                  url={form.image_url}
                  name={form.name ?? ""}
                  size="md"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    id={id}
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploading}
                    onChange={pickImage}
                    className="w-full text-sm text-muted file:mr-3 file:rounded-btn file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent hover:file:bg-accent-soft/70"
                  />
                  {uploading && (
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <Upload size={12} /> กำลังอัปโหลด…
                    </p>
                  )}
                  {imgError && (
                    <p className="text-xs text-danger">{imgError}</p>
                  )}
                  {!!form.image_url && !uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<X size={14} />}
                      onClick={clearImage}
                    >
                      เอารูปออก
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Field>

          <Field
            label="ชนิด"
            hint={
              usesRawGas(form.kind ?? "")
                ? "ชนิดนี้ไม่มีสต๊อกของตัวเอง ขายแล้วตัดกิโลจากถังเก็บใหญ่"
                : undefined
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.kind ?? ""}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as ProductKind })
                }
              >
                {PRODUCT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="ขนาด">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.size ?? ""}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  placeholder="เช่น 15kg"
                />
              )}
            </Field>
            <Field label="หน่วยนับ">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.unit ?? ""}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="ถัง / กก. / ชิ้น"
                />
              )}
            </Field>
          </div>

          {usesRawGas(form.kind ?? "") && (
            <Field
              label="กิโลแก๊สต่อถัง"
              hint="ใช้คำนวณว่าขาย 1 ถังแล้วต้องตัดแก๊สดิบกี่กิโล"
            >
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fill_kg ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, fill_kg: Number(e.target.value) })
                  }
                />
              )}
            </Field>
          )}

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="ราคาขาย (บาท)">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, price: Number(e.target.value) })
                  }
                />
              )}
            </Field>
            <Field label="ต้นทุน (บาท)" hint="ใส่ไว้เพื่อดูกำไรต่อบิล">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cost:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              )}
            </Field>
          </div>

          {!usesRawGas(form.kind ?? "") && !kindIsService && (
            <Field
              label="จุดเตือนของใกล้หมด"
              hint="เหลือน้อยกว่านี้จะเตือนที่หน้าแรก"
            >
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step="1"
                  value={form.low_at ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, low_at: Number(e.target.value) })
                  }
                />
              )}
            </Field>
          )}

          <Field label="รหัสสินค้า">
            {(id) => (
              <TextInput
                id={id}
                value={form.sku ?? ""}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            )}
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 accent-[#2563eb]"
            />
            ยังขายอยู่
          </label>
        </div>
      </Modal>

      {/* ---- รับเข้า / เบิกออก ---- */}
      <Modal
        open={moveFor !== null}
        onClose={() => setMoveFor(null)}
        title={moveType === "รับเข้า" ? "รับของเข้า" : "เบิกของออก"}
        hint={moveFor?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveFor(null)}>
              ยกเลิก
            </Button>
            <Button
              variant={moveType === "รับเข้า" ? "ok" : "primary"}
              onClick={submitMove}
              disabled={busy || !(Number(moveQty) > 0)}
            >
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        {moveFor && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between rounded-card bg-paper px-3.5 py-2.5 text-sm">
              <span className="text-muted">คงเหลือตอนนี้</span>
              <span className="font-medium text-ink">
                {fmtQty(Number(moveFor.stock))} {moveFor.unit}
              </span>
            </div>

            <Field
              label={`จำนวนที่${moveType === "รับเข้า" ? "รับเข้า" : "เบิกออก"}`}
            >
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step="0.01"
                  autoFocus
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                />
              )}
            </Field>

            <Field label="โน้ต">
              {(id) => (
                <TextArea
                  id={id}
                  rows={2}
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  placeholder={
                    moveType === "รับเข้า" ? "เช่น รับจากบริษัท" : "เช่น ของแตก"
                  }
                />
              )}
            </Field>

            {moveType === "เบิกออก" &&
              Number(moveQty) > Number(moveFor.stock) && (
                <Badge tone="danger">
                  ของไม่พอ — เหลือแค่ {fmtQty(Number(moveFor.stock))}{" "}
                  {moveFor.unit}
                </Badge>
              )}
          </div>
        )}
      </Modal>
    </>
  );
}
