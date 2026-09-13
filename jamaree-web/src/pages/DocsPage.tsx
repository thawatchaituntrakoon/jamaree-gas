import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DOC_TYPES,
  VAT_RATE,
  WHT_TYPES,
  docStatusTone,
  fmtBaht,
  fmtDate,
  todayStr,
} from "@/lib/constants";
import { docTypeTone } from "@/lib/docMath";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { DocType, ShopSettingsInput, TradeDocument, UUID } from "@/types";

interface DraftItem {
  key: string;
  name: string;
  qty: string;
  price: string;
}

const newItem = (): DraftItem => ({
  key: crypto.randomUUID(),
  name: "",
  qty: "1",
  price: "",
});

const money2 = (n: number) => Math.round(n * 100) / 100;

export function DocsPage() {
  const { customers, products, customerById, customerName } = useDerived();
  const documents = useAppStore((s) => s.documents);
  const settings = useAppStore((s) => s.settings);
  const saveDocument = useAppStore((s) => s.saveDocument);
  const nextDocNumber = useAppStore((s) => s.nextDocNumber);
  const deleteDocument = useAppStore((s) => s.deleteDocument);
  const saveSettings = useAppStore((s) => s.saveSettings);

  const [typeTab, setTypeTab] = useState<DocType | "">("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TradeDocument | null>(null);
  const [docType, setDocType] = useState<DocType>("ใบเสนอราคา");
  const [customerId, setCustomerId] = useState<UUID | "">("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [hasVat, setHasVat] = useState(false);
  const [whtType, setWhtType] = useState("");

  const [deleteFor, setDeleteFor] = useState<TradeDocument | null>(null);

  const [shopOpen, setShopOpen] = useState(false);
  const [shop, setShop] = useState<ShopSettingsInput>({});

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeTab && d.type !== typeTab) return false;
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        customerName(d.customer_id).toLowerCase().includes(q) ||
        (d.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [documents, typeTab, query, customerName]);

  /* ---------- ตัวเลขในฟอร์ม ---------- */
  const amount = money2(
    items.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
      0,
    ),
  );
  const baseAmt = hasVat ? money2(amount / (1 + VAT_RATE / 100)) : amount;
  const vatAmt = hasVat ? money2(amount - baseAmt) : 0;

  const customer = customerById(customerId || null);
  const whtDef = WHT_TYPES.find((w) => w.code === whtType);
  const whtAllowed =
    docType === "ใบแจ้งหนี้" && customer?.person_type === "นิติบุคคล";
  const whtOn = whtAllowed && !!whtDef;
  const whtAmt = whtOn && whtDef ? money2((baseAmt * whtDef.rate) / 100) : 0;
  const transferAmt = money2(amount - whtAmt);

  function openNew() {
    setEditing(null);
    setDocType("ใบเสนอราคา");
    setCustomerId("");
    setDate(todayStr());
    setNote("");
    setItems([newItem()]);
    setHasVat(false);
    setWhtType("");
    setFormOpen(true);
  }

  function openEdit(d: TradeDocument) {
    setEditing(d);
    setDocType(d.type);
    setCustomerId(d.customer_id);
    setDate(d.date);
    setNote(d.note ?? "");
    setItems(
      d.items.length
        ? d.items.map((it) => ({
            key: crypto.randomUUID(),
            name: it.name,
            qty: String(it.qty),
            price: String(it.price),
          }))
        : [newItem()],
    );
    setHasVat(Number(d.vat_rate) > 0);
    setWhtType(d.wht_type ?? "");
    setFormOpen(true);
  }

  function setItem(key: string, patch: Partial<DraftItem>) {
    setItems((list) =>
      list.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  /** เลือกสินค้าแล้วเติมชื่อ + ราคาให้เอง แต่แก้ทับได้ตลอด (เอกสารเป็นภาพนิ่ง) */
  function pickProduct(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItem(key, { name: p.name, price: String(p.price) });
  }

  async function submitForm() {
    const clean = items
      .filter((it) => it.name.trim() && Number(it.qty) > 0)
      .map((it) => ({
        name: it.name.trim(),
        qty: Number(it.qty),
        price: Number(it.price) || 0,
      }));
    if (!customerId || !clean.length) return;

    setBusy(true);
    try {
      const number = editing ? editing.number : await nextDocNumber(docType);
      await saveDocument(
        {
          type: docType,
          number,
          customer_id: customerId,
          items: clean,
          amount,
          date,
          note: note.trim() || null,
          status: editing?.status ?? "ร่าง",
          vat_rate: hasVat ? VAT_RATE : null,
          vat_amt: hasVat ? vatAmt : null,
          base_amt: hasVat ? baseAmt : null,
          wht_type: whtOn ? whtType : null,
          wht_rate: whtOn && whtDef ? whtDef.rate : null,
          wht_amt: whtOn ? whtAmt : null,
          transfer_amt: whtOn ? transferAmt : null,
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

  async function submitDelete() {
    if (!deleteFor) return;
    setBusy(true);
    try {
      await deleteDocument(deleteFor.id);
      setDeleteFor(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openShop() {
    setShop({
      shop_name: settings?.shop_name ?? "",
      address: settings?.address ?? "",
      tax_id: settings?.tax_id ?? "",
      branch: settings?.branch ?? "สำนักงานใหญ่",
      phone: settings?.phone ?? "",
      vat_registered: settings?.vat_registered ?? false,
      promptpay_id: settings?.promptpay_id ?? "",
    });
    setShopOpen(true);
  }

  async function submitShop() {
    setBusy(true);
    try {
      await saveSettings(shop);
      setShopOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="เอกสารการค้า"
        hint="ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ · เลขที่ออกให้อัตโนมัติ"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Building2 size={16} />}
              onClick={openShop}
            >
              ข้อมูลร้าน
            </Button>
            <Button icon={<Plus size={16} />} onClick={openNew}>
              ออกเอกสาร
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1">
            {([""] as Array<DocType | "">).concat(DOC_TYPES).map((t) => (
              <button
                key={t || "all"}
                type="button"
                onClick={() => setTypeTab(t)}
                className={`rounded-btn px-3 py-1.5 text-sm ${
                  typeTab === t
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t || "ทั้งหมด"}
              </button>
            ))}
          </div>

          <div className="relative ml-auto min-w-52 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขที่เอกสาร หรือชื่อลูกค้า"
              aria-label="ค้นหาเอกสาร"
              className="w-full rounded-btn border border-line bg-card py-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <DataTable<TradeDocument>
          rows={rows}
          rowKey={(d) => d.id}
          empty={
            documents.length
              ? "ไม่พบเอกสารที่ค้นหา"
              : "ยังไม่มีเอกสาร กดปุ่ม “ออกเอกสาร” เพื่อเริ่ม"
          }
          columns={[
            {
              header: "เลขที่",
              cell: (d) => (
                <div>
                  <Link
                    to={`/docs/${d.id}`}
                    className="font-medium text-ink hover:text-accent hover:underline"
                  >
                    {d.number}
                  </Link>
                  <p className="text-xs text-muted">{fmtDate(d.date)}</p>
                </div>
              ),
            },
            {
              header: "ประเภท",
              cell: (d) => <Badge tone={docTypeTone(d.type)}>{d.type}</Badge>,
            },
            {
              header: "ลูกค้า",
              hideOnMobile: true,
              cell: (d) => (
                <Link
                  to={`/customers/${d.customer_id}`}
                  className="text-ink hover:text-accent hover:underline"
                >
                  {customerName(d.customer_id)}
                </Link>
              ),
            },
            {
              header: "ยอดรวม",
              align: "right",
              cell: (d) => fmtBaht(Number(d.amount)),
            },
            {
              header: "สถานะ",
              cell: (d) => (
                <Badge tone={docStatusTone(d.status)}>{d.status}</Badge>
              ),
            },
            {
              header: "",
              align: "right",
              cell: (d) =>
                d.status === "ร่าง" ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil size={14} />}
                      onClick={() => openEdit(d)}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={() => setDeleteFor(d)}
                    >
                      ลบ
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      {/* ---- ฟอร์มเอกสาร ---- */}
      <Modal
        wide
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `แก้ไข ${editing.number}` : "ออกเอกสารใหม่"}
        hint={
          editing
            ? "เลขที่เอกสารเดิมไม่เปลี่ยน"
            : "เลขที่เอกสารจะออกให้อัตโนมัติตอนกดบันทึก"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitForm}
              disabled={busy || !customerId || amount <= 0}
            >
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="ประเภทเอกสาร">
              {(id) => (
                <Select
                  id={id}
                  value={docType}
                  disabled={!!editing}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="ลูกค้า">
              {(id) => (
                <Select
                  id={id}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">เลือกลูกค้า</option>
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
            <p className="mb-2 text-sm font-medium text-ink">รายการ</p>
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="grid gap-2 rounded-btn border border-line p-2 sm:grid-cols-[1fr_1fr_4.5rem_6rem_auto] sm:items-center sm:border-0 sm:p-0"
                >
                  <Select
                    aria-label="เลือกจากสินค้า"
                    value=""
                    onChange={(e) => pickProduct(it.key, e.target.value)}
                  >
                    <option value="">เลือกจากสินค้า…</option>
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
                    placeholder="ชื่อรายการ"
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
                    placeholder="ราคา"
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
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={hasVat}
              onChange={(e) => setHasVat(e.target.checked)}
              className="size-4 accent-[#2563eb]"
            />
            ราคานี้รวม VAT {VAT_RATE}% แล้ว
          </label>

          {whtAllowed && (
            <Field
              label="หัก ณ ที่จ่าย"
              hint="ใส่ได้เฉพาะใบแจ้งหนี้ของลูกค้านิติบุคคล"
            >
              {(id) => (
                <Select
                  id={id}
                  value={whtType}
                  onChange={(e) => setWhtType(e.target.value)}
                >
                  <option value="">ไม่หัก</option>
                  {WHT_TYPES.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.label} {w.rate}%
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <Field label="หมายเหตุ">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ยืนราคา 7 วัน"
              />
            )}
          </Field>

          <div className="rounded-btn bg-paper px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">ยอดรวม</span>
              <span className="font-medium text-ink tabular-nums">
                {fmtBaht(amount)}
              </span>
            </div>
            {hasVat && (
              <>
                <div className="flex justify-between text-muted">
                  <span>ก่อน VAT</span>
                  <span className="tabular-nums">{fmtBaht(baseAmt)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>VAT {VAT_RATE}%</span>
                  <span className="tabular-nums">{fmtBaht(vatAmt)}</span>
                </div>
              </>
            )}
            {whtOn && (
              <div className="mt-1 flex justify-between border-t border-line pt-1 text-warn">
                <span>หัก {whtDef?.rate}% · ยอดโอนจริง</span>
                <span className="font-medium tabular-nums">
                  {fmtBaht(transferAmt)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ---- ยืนยันลบ ---- */}
      <Modal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="ลบเอกสารร่าง"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteFor(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={submitDelete} disabled={busy}>
              {busy ? "กำลังลบ…" : "ลบเอกสาร"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">ลบ “{deleteFor?.number}” ใช่ไหม</p>
        <p className="mt-1 text-sm text-muted">
          เลขที่นี้จะไม่ถูกใช้ซ้ำ — เลขถัดไปเดินหน้าต่อเสมอ
        </p>
      </Modal>

      {/* ---- ข้อมูลร้าน (ใช้พิมพ์หัวเอกสาร) ---- */}
      <Modal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        title="ข้อมูลร้าน"
        hint="ข้อมูลนี้จะขึ้นหัวเอกสารทุกใบตอนพิมพ์"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShopOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submitShop} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ชื่อร้าน">
            {(id) => (
              <TextInput
                id={id}
                value={shop.shop_name ?? ""}
                onChange={(e) =>
                  setShop({ ...shop, shop_name: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="ที่อยู่">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={shop.address ?? ""}
                onChange={(e) => setShop({ ...shop, address: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="เลขประจำตัวผู้เสียภาษี">
              {(id) => (
                <TextInput
                  id={id}
                  value={shop.tax_id ?? ""}
                  onChange={(e) => setShop({ ...shop, tax_id: e.target.value })}
                  placeholder="13 หลัก"
                />
              )}
            </Field>
            <Field label="สำนักงาน/สาขา">
              {(id) => (
                <TextInput
                  id={id}
                  value={shop.branch ?? ""}
                  onChange={(e) => setShop({ ...shop, branch: e.target.value })}
                  placeholder="สำนักงานใหญ่"
                />
              )}
            </Field>
            <Field label="เบอร์โทร">
              {(id) => (
                <TextInput
                  id={id}
                  value={shop.phone ?? ""}
                  onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                />
              )}
            </Field>
            <Field label="พร้อมเพย์">
              {(id) => (
                <TextInput
                  id={id}
                  value={shop.promptpay_id ?? ""}
                  onChange={(e) =>
                    setShop({ ...shop, promptpay_id: e.target.value })
                  }
                  placeholder="เบอร์มือถือ หรือเลขภาษี"
                />
              )}
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={shop.vat_registered ?? false}
              onChange={(e) =>
                setShop({ ...shop, vat_registered: e.target.checked })
              }
              className="size-4 accent-[#2563eb]"
            />
            ร้านจดทะเบียน VAT
          </label>
        </div>
      </Modal>
    </>
  );
}
