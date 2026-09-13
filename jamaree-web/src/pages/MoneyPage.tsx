import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CircleCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PERSON_TYPES,
  VAT_RATE,
  WHT_TYPES,
  fmtBaht,
  fmtDate,
  todayStr,
} from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type {
  MoneyCategory,
  MoneyType,
  PersonType,
  Transaction,
} from "@/types";

type Tab = "all" | "ar" | "ap" | "cat";

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: "all", label: "รายการทั้งหมด" },
  { key: "ar", label: "ลูกหนี้ (ค้างรับ)" },
  { key: "ap", label: "เจ้าหนี้ (ค้างจ่าย)" },
  { key: "cat", label: "หมวดเงิน" },
];

interface MoneyForm {
  type: MoneyType;
  date: string;
  amount: string;
  category: string;
  note: string;
  unpaid: boolean;
  hasVat: boolean;
  payee_name: string;
  payee_tax_id: string;
  payee_person_type: PersonType;
  wht_type: string;
}

function blankForm(type: MoneyType): MoneyForm {
  return {
    type,
    date: todayStr(),
    amount: "",
    category: "",
    note: "",
    unpaid: false,
    hasVat: false,
    payee_name: "",
    payee_tax_id: "",
    payee_person_type: "บุคคล",
    wht_type: "",
  };
}

/** ปัดเงินให้เหลือ 2 ตำแหน่งเสมอ */
const money2 = (n: number) => Math.round(n * 100) / 100;

/** รายการที่ระบบสร้างให้เอง (มีต้นทาง) — ลบทิ้งไม่ได้ ไม่งั้นยอดจะไม่ตรงกับบิล/เอกสาร */
const isAuto = (t: Transaction) => t.ref_type != null;

const REF_LABEL: Record<string, string> = {
  order: "จากบิลขาย",
  doc: "จากเอกสาร",
  po: "จากใบสั่งซื้อ",
  payroll: "จากเงินเดือน",
  custody: "จากถังฝาก",
};

function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "ok" | "danger" | "warn" | "info";
  icon: ReactNode;
}) {
  const TONES = {
    ok: "bg-ok-soft text-ok",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-warn",
    info: "bg-accent-soft text-accent",
  } as const;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 font-head text-xl font-semibold text-ink tabular-nums">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>
        </div>
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-btn ${TONES[tone]}`}
        >
          {icon}
        </span>
      </div>
    </Card>
  );
}

export function MoneyPage() {
  const {
    transactions,
    receivableTotal,
    payableTotal,
    monthIn,
    monthOut,
    monthProfit,
  } = useDerived();
  const categories = useAppStore((s) => s.categories);
  const saveTransaction = useAppStore((s) => s.saveTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const settleTransaction = useAppStore((s) => s.settleTransaction);
  const saveCategory = useAppStore((s) => s.saveCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<MoneyForm>(blankForm("เข้า"));

  const [settleFor, setSettleFor] = useState<Transaction | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(todayStr());

  const [deleteFor, setDeleteFor] = useState<Transaction | null>(null);

  const [catOpen, setCatOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<MoneyCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<MoneyType>("เข้า");

  const arCount = useMemo(
    () => transactions.filter((t) => t.unpaid && t.type === "เข้า").length,
    [transactions],
  );
  const apCount = useMemo(
    () => transactions.filter((t) => t.unpaid && t.type === "ออก").length,
    [transactions],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (tab === "ar" && !(t.unpaid && t.type === "เข้า")) return false;
      if (tab === "ap" && !(t.unpaid && t.type === "ออก")) return false;
      if (!q) return true;
      return (
        t.note.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.payee_name ?? "").toLowerCase().includes(q) ||
        t.date.includes(q)
      );
    });
  }, [transactions, tab, query]);

  /* ---------- ตัวเลขในฟอร์ม ---------- */
  const amountNum = Number(form.amount) || 0;
  const baseAmt = form.hasVat
    ? money2(amountNum / (1 + VAT_RATE / 100))
    : amountNum;
  const vatAmt = form.hasVat ? money2(amountNum - baseAmt) : 0;
  const whtDef = WHT_TYPES.find((w) => w.code === form.wht_type);
  const whtOn =
    form.type === "ออก" && form.payee_person_type === "นิติบุคคล" && !!whtDef;
  const whtAmt = whtOn && whtDef ? money2((baseAmt * whtDef.rate) / 100) : 0;

  const catOptions = categories.filter((c) => c.type === form.type);

  function openNew(type: MoneyType) {
    setEditing(null);
    setForm(blankForm(type));
    setFormOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setForm({
      type: t.type,
      date: t.date,
      amount: String(t.amount),
      category: t.category ?? "",
      note: t.note,
      unpaid: t.unpaid,
      hasVat: Number(t.vat_amt) > 0,
      payee_name: t.payee_name ?? "",
      payee_tax_id: t.payee_tax_id ?? "",
      payee_person_type: t.payee_person_type ?? "บุคคล",
      wht_type: t.wht_type ?? "",
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!(amountNum > 0)) return;
    setBusy(true);
    try {
      const isOut = form.type === "ออก";
      await saveTransaction(
        {
          date: form.date,
          type: form.type,
          amount: amountNum,
          note: form.note.trim(),
          category: form.category || null,
          unpaid: form.unpaid,
          settled_at: form.unpaid ? null : form.date,
          vat_amt: form.hasVat ? vatAmt : null,
          wht_type: whtOn ? form.wht_type : null,
          wht_rate: whtOn && whtDef ? whtDef.rate : null,
          wht_amt: whtOn ? whtAmt : null,
          payee_name: isOut ? form.payee_name.trim() || null : null,
          payee_tax_id: isOut ? form.payee_tax_id.trim() || null : null,
          payee_person_type: isOut ? form.payee_person_type : null,
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

  function openSettle(t: Transaction) {
    setSettleFor(t);
    setSettleAmount(String(t.amount));
    setSettleDate(todayStr());
  }

  async function submitSettle() {
    if (!settleFor) return;
    const amt = Number(settleAmount) || 0;
    if (!(amt > 0)) return;
    setBusy(true);
    try {
      await settleTransaction(settleFor.id, amt, settleDate);
      setSettleFor(null);
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
      await deleteTransaction(deleteFor.id);
      setDeleteFor(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openCatNew() {
    setCatEditing(null);
    setCatName("");
    setCatType("เข้า");
    setCatOpen(true);
  }

  function openCatEdit(c: MoneyCategory) {
    setCatEditing(c);
    setCatName(c.name);
    setCatType(c.type);
    setCatOpen(true);
  }

  async function submitCat() {
    if (!catName.trim()) return;
    setBusy(true);
    try {
      await saveCategory({ name: catName, type: catType }, catEditing?.id);
      setCatOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function removeCat(c: MoneyCategory) {
    setBusy(true);
    try {
      await deleteCategory(c.id);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="การเงิน"
        hint={`กำไรเดือนนี้ ${fmtBaht(monthProfit)} บาท (นับเฉพาะเงินที่เข้า-ออกจริงแล้ว)`}
        action={
          <div className="flex gap-2">
            <Button
              variant="ok"
              icon={<ArrowDownToLine size={16} />}
              onClick={() => openNew("เข้า")}
            >
              เงินเข้า
            </Button>
            <Button
              variant="danger"
              icon={<ArrowUpFromLine size={16} />}
              onClick={() => openNew("ออก")}
            >
              เงินออก
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="รับเข้าเดือนนี้"
          value={fmtBaht(monthIn)}
          hint="เงินที่เข้ามือแล้ว"
          tone="ok"
          icon={<ArrowDownToLine size={18} />}
        />
        <StatCard
          label="จ่ายออกเดือนนี้"
          value={fmtBaht(monthOut)}
          hint="เงินที่จ่ายจริงแล้ว"
          tone="danger"
          icon={<ArrowUpFromLine size={18} />}
        />
        <StatCard
          label="ลูกหนี้ค้างรับ"
          value={fmtBaht(receivableTotal)}
          hint={`${arCount} รายการรอเก็บเงิน`}
          tone="warn"
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="เจ้าหนี้ค้างจ่าย"
          value={fmtBaht(payableTotal)}
          hint={`${apCount} รายการรอจ่าย`}
          tone="info"
          icon={<Banknote size={18} />}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-btn px-3 py-1.5 text-sm ${
                  tab === t.key
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.key === "ar" && arCount > 0 ? ` (${arCount})` : ""}
                {t.key === "ap" && apCount > 0 ? ` (${apCount})` : ""}
              </button>
            ))}
          </div>

          {tab === "cat" ? (
            <div className="ml-auto">
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={openCatNew}
              >
                เพิ่มหมวด
              </Button>
            </div>
          ) : (
            <div className="relative ml-auto min-w-52 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหารายละเอียด หมวด หรือวันที่"
                aria-label="ค้นหารายการเงิน"
                className="w-full rounded-btn border border-line bg-card py-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          )}
        </div>

        {tab === "cat" ? (
          <DataTable<MoneyCategory>
            rows={categories}
            rowKey={(c) => c.id}
            empty="ยังไม่มีหมวดเงิน กดปุ่ม “เพิ่มหมวด” เพื่อเริ่ม"
            columns={[
              {
                header: "ชื่อหมวด",
                cell: (c) => <span className="text-ink">{c.name}</span>,
              },
              {
                header: "ใช้กับ",
                cell: (c) => (
                  <Badge tone={c.type === "เข้า" ? "ok" : "danger"}>
                    เงิน{c.type}
                  </Badge>
                ),
              },
              {
                header: "",
                align: "right",
                cell: (c) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil size={14} />}
                      onClick={() => openCatEdit(c)}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      disabled={busy}
                      onClick={() => void removeCat(c)}
                    >
                      ลบ
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <DataTable<Transaction>
            rows={rows}
            rowKey={(t) => t.id}
            empty={
              transactions.length
                ? "ไม่พบรายการที่ค้นหา"
                : "ยังไม่มีรายการเงิน กดปุ่ม “เงินเข้า” หรือ “เงินออก” เพื่อเริ่ม"
            }
            columns={[
              {
                header: "วันที่",
                cell: (t) => (
                  <span className="whitespace-nowrap text-ink">
                    {fmtDate(t.date)}
                  </span>
                ),
              },
              {
                header: "รายการ",
                cell: (t) => (
                  <div>
                    <p className="text-ink">{t.note || "—"}</p>
                    <p className="text-xs text-muted">
                      {[
                        t.category ?? "ไม่ระบุหมวด",
                        t.payee_name,
                        t.ref_type ? REF_LABEL[t.ref_type] : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ),
              },
              {
                header: "ภาษี",
                align: "right",
                hideOnMobile: true,
                cell: (t) => (
                  <div className="text-xs text-muted">
                    {Number(t.vat_amt) > 0 && (
                      <p>VAT {fmtBaht(Number(t.vat_amt))}</p>
                    )}
                    {Number(t.wht_amt) > 0 && (
                      <p>หัก ณ ที่จ่าย {fmtBaht(Number(t.wht_amt))}</p>
                    )}
                    {!Number(t.vat_amt) && !Number(t.wht_amt) && "—"}
                  </div>
                ),
              },
              {
                header: "จำนวนเงิน",
                align: "right",
                cell: (t) => (
                  <span
                    className={`font-medium ${
                      t.type === "เข้า" ? "text-ok" : "text-danger"
                    }`}
                  >
                    {t.type === "เข้า" ? "+" : "−"}
                    {fmtBaht(Number(t.amount))}
                  </span>
                ),
              },
              {
                header: "สถานะ",
                cell: (t) =>
                  t.unpaid ? (
                    <Badge tone="warn">
                      {t.type === "เข้า" ? "รอเก็บเงิน" : "รอจ่าย"}
                    </Badge>
                  ) : (
                    <Badge tone="ok">เรียบร้อย</Badge>
                  ),
              },
              {
                header: "",
                align: "right",
                cell: (t) => (
                  <div className="flex justify-end gap-1">
                    {t.unpaid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<CircleCheck size={14} />}
                        onClick={() => openSettle(t)}
                      >
                        ตัดยอด
                      </Button>
                    )}
                    {(!isAuto(t) || t.ref_type === "po") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Pencil size={14} />}
                        onClick={() => openEdit(t)}
                      >
                        แก้ไข
                      </Button>
                    )}
                    {!isAuto(t) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => setDeleteFor(t)}
                      >
                        ลบ
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* ---- ฟอร์มบันทึกเงิน ---- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editing
            ? "แก้ไขรายการเงิน"
            : form.type === "เข้า"
              ? "บันทึกเงินเข้า"
              : "บันทึกเงินออก"
        }
        hint="กรอกยอดเงินรวมที่รับ/จ่ายจริง ระบบจะแยก VAT และหัก ณ ที่จ่ายให้เอง"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submitForm} disabled={busy || !(amountNum > 0)}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {(["เข้า", "ออก"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setForm({ ...form, type, category: "", wht_type: "" })
                }
                className={`rounded-btn border px-3 py-2 text-sm ${
                  form.type === type
                    ? type === "เข้า"
                      ? "border-ok bg-ok-soft font-medium text-ok"
                      : "border-danger bg-danger-soft font-medium text-danger"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                เงิน{type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="วันที่">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              )}
            </Field>
            <Field label="จำนวนเงิน (บาท)">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              )}
            </Field>
          </div>

          <Field label="หมวด" hint="เพิ่ม/แก้หมวดได้ที่แท็บ “หมวดเงิน”">
            {(id) => (
              <Select
                id={id}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">ไม่ระบุหมวด</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="รายละเอียด">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="เช่น ค่าน้ำมันรถส่งของ"
              />
            )}
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.unpaid}
              onChange={(e) => setForm({ ...form, unpaid: e.target.checked })}
              className="size-4 accent-[#d97706]"
            />
            {form.type === "เข้า"
              ? "ยังไม่ได้รับเงิน (ตั้งเป็นลูกหนี้)"
              : "ยังไม่ได้จ่าย (ตั้งเป็นเจ้าหนี้)"}
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.hasVat}
              onChange={(e) => setForm({ ...form, hasVat: e.target.checked })}
              className="size-4 accent-[#2563eb]"
            />
            ยอดนี้รวม VAT {VAT_RATE}% แล้ว
          </label>

          {form.hasVat && (
            <div className="rounded-btn bg-paper px-3 py-2 text-sm text-muted">
              ก่อน VAT {fmtBaht(baseAmt)} บาท · VAT {fmtBaht(vatAmt)} บาท
            </div>
          )}

          {form.type === "ออก" && (
            <>
              <div className="border-t border-line pt-3">
                <p className="mb-2 text-sm font-medium text-ink">ผู้รับเงิน</p>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="ชื่อผู้รับเงิน">
                      {(id) => (
                        <TextInput
                          id={id}
                          value={form.payee_name}
                          onChange={(e) =>
                            setForm({ ...form, payee_name: e.target.value })
                          }
                          placeholder="ชื่อร้าน/บริษัท"
                        />
                      )}
                    </Field>
                    <Field label="ประเภท">
                      {(id) => (
                        <Select
                          id={id}
                          value={form.payee_person_type}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              payee_person_type: e.target.value as PersonType,
                              wht_type:
                                e.target.value === "นิติบุคคล"
                                  ? form.wht_type
                                  : "",
                            })
                          }
                        >
                          {PERSON_TYPES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>

                  <Field label="เลขประจำตัวผู้เสียภาษี">
                    {(id) => (
                      <TextInput
                        id={id}
                        value={form.payee_tax_id}
                        onChange={(e) =>
                          setForm({ ...form, payee_tax_id: e.target.value })
                        }
                        placeholder="13 หลัก (ถ้ามี)"
                      />
                    )}
                  </Field>

                  {form.payee_person_type === "นิติบุคคล" && (
                    <Field
                      label="หัก ณ ที่จ่าย"
                      hint="หักได้เฉพาะเมื่อจ่ายให้นิติบุคคล"
                    >
                      {(id) => (
                        <Select
                          id={id}
                          value={form.wht_type}
                          onChange={(e) =>
                            setForm({ ...form, wht_type: e.target.value })
                          }
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

                  {whtOn && (
                    <div className="rounded-btn bg-warn-soft px-3 py-2 text-sm text-warn">
                      หักไว้ {fmtBaht(whtAmt)} บาท · จ่ายจริง{" "}
                      {fmtBaht(amountNum - whtAmt)} บาท
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ---- ตัดยอดค้าง ---- */}
      <Modal
        open={!!settleFor}
        onClose={() => setSettleFor(null)}
        title={
          settleFor?.type === "เข้า" ? "รับเงินจากลูกหนี้" : "จ่ายเงินเจ้าหนี้"
        }
        hint="ใส่น้อยกว่ายอดค้างได้ ระบบจะเก็บส่วนที่เหลือค้างไว้ให้"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSettleFor(null)}>
              ยกเลิก
            </Button>
            <Button
              variant="ok"
              onClick={submitSettle}
              disabled={busy || !(Number(settleAmount) > 0)}
            >
              {busy ? "กำลังบันทึก…" : "ยืนยัน"}
            </Button>
          </>
        }
      >
        {settleFor && (
          <div className="space-y-3.5">
            <div className="rounded-btn bg-paper px-3 py-2 text-sm">
              <p className="text-ink">{settleFor.note || "—"}</p>
              <p className="text-muted">
                ค้างอยู่ {fmtBaht(Number(settleFor.amount))} บาท
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วันที่">
                {(id) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                  />
                )}
              </Field>
              <Field label="จำนวนเงิน (บาท)">
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                  />
                )}
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- ยืนยันลบ ---- */}
      <Modal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="ลบรายการเงิน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteFor(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={submitDelete} disabled={busy}>
              {busy ? "กำลังลบ…" : "ลบรายการ"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          ลบ “{deleteFor?.note || "รายการนี้"}” จำนวน{" "}
          {fmtBaht(Number(deleteFor?.amount ?? 0))} บาท ใช่ไหม
        </p>
        <p className="mt-1 text-sm text-muted">ลบแล้วเอากลับคืนไม่ได้</p>
      </Modal>

      {/* ---- ฟอร์มหมวดเงิน ---- */}
      <Modal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title={catEditing ? "แก้ไขหมวด" : "เพิ่มหมวด"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submitCat} disabled={busy || !catName.trim()}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ชื่อหมวด">
            {(id) => (
              <TextInput
                id={id}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="เช่น ค่าน้ำมัน"
              />
            )}
          </Field>
          <Field label="ใช้กับ">
            {(id) => (
              <Select
                id={id}
                value={catType}
                onChange={(e) => setCatType(e.target.value as MoneyType)}
              >
                <option value="เข้า">เงินเข้า</option>
                <option value="ออก">เงินออก</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
