import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cylinder, Flame, Plus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBaht, fmtDate, fmtQty, todayStr } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type {
  CylinderDeposit,
  CylinderStockRow,
  DepositType,
  UUID,
} from "@/types";

type Tab = "stock" | "deposits";

export function CylindersPage() {
  const { customers, customerName, deposits, depositHeld } = useDerived();
  const cylinderStock = useAppStore((s) => s.cylinderStock);
  const cylinderSizes = useAppStore((s) => s.cylinderSizes);
  const fillCylinders = useAppStore((s) => s.fillCylinders);
  const addDeposit = useAppStore((s) => s.addDeposit);

  const [tab, setTab] = useState<Tab>("stock");
  const [busy, setBusy] = useState(false);

  // ฟอร์มบรรจุ
  const [fillOpen, setFillOpen] = useState(false);
  const [fillSize, setFillSize] = useState("");
  const [fillQty, setFillQty] = useState(1);
  const [fillNote, setFillNote] = useState("");

  // ฟอร์มมัดจำ
  const [depOpen, setDepOpen] = useState(false);
  const [depCustomer, setDepCustomer] = useState<UUID | "">("");
  const [depSize, setDepSize] = useState("");
  const [depType, setDepType] = useState<DepositType>("รับมัดจำ");
  const [depQty, setDepQty] = useState(1);
  const [depAmount, setDepAmount] = useState(0);
  const [depDate, setDepDate] = useState(todayStr());
  const [depNote, setDepNote] = useState("");

  const totals = useMemo(
    () =>
      cylinderStock.reduce(
        (acc, r) => ({
          filled: acc.filled + Number(r.filled),
          empty: acc.empty + Number(r.empty),
          at_customer: acc.at_customer + Number(r.at_customer),
        }),
        { filled: 0, empty: 0, at_customer: 0 },
      ),
    [cylinderStock],
  );

  function openFill(size: string) {
    setFillSize(size);
    setFillQty(1);
    setFillNote("");
    setFillOpen(true);
  }

  function openDeposit() {
    setDepCustomer("");
    setDepSize(cylinderSizes[0]?.name ?? "");
    setDepType("รับมัดจำ");
    setDepQty(1);
    setDepAmount(Number(cylinderSizes[0]?.deposit_price) || 0);
    setDepDate(todayStr());
    setDepNote("");
    setDepOpen(true);
  }

  /** ค่ามัดจำต่อใบของขนาดนั้น × จำนวน */
  function suggestAmount(size: string, qty: number) {
    const price = Number(
      cylinderSizes.find((s) => s.name === size)?.deposit_price ?? 0,
    );
    return Math.round(price * qty * 100) / 100;
  }

  async function submitFill() {
    if (!fillSize || fillQty <= 0) return;
    setBusy(true);
    try {
      await fillCylinders(fillSize, fillQty, fillNote.trim());
      setFillOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function submitDeposit() {
    if (!depCustomer || !depSize || depQty <= 0) return;
    setBusy(true);
    try {
      await addDeposit({
        customer_id: depCustomer,
        size: depSize,
        type: depType,
        qty: depQty,
        amount: depAmount,
        date: depDate,
        note: depNote.trim(),
      });
      setDepOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  const TABS: Array<[Tab, string]> = [
    ["stock", "สต๊อกถัง"],
    ["deposits", "มัดจำถัง"],
  ];

  return (
    <>
      <PageHeader
        title="ถังแก๊ส"
        hint="ถังเต็ม/ถังเปล่ารายขนาด และเงินมัดจำถังของลูกค้า"
        action={
          tab === "deposits" ? (
            <Button
              icon={<Plus size={16} />}
              onClick={openDeposit}
              disabled={!customers.length || !cylinderSizes.length}
            >
              บันทึกมัดจำ
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Flame size={14} className="text-ok" /> ถังเต็มพร้อมขาย
          </p>
          <p className="mt-1 font-head text-2xl font-semibold text-ok tabular-nums">
            {fmtQty(totals.filled)} ใบ
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Cylinder size={14} /> ถังเปล่ารอบรรจุ
          </p>
          <p className="mt-1 font-head text-2xl font-semibold text-ink tabular-nums">
            {fmtQty(totals.empty)} ใบ
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Wallet size={14} className="text-warn" /> เงินมัดจำที่ถือไว้
          </p>
          <p className="mt-1 font-head text-2xl font-semibold text-warn tabular-nums">
            {fmtBaht(depositHeld)}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-1 border-b border-line p-3">
          {TABS.map(([key, label]) => (
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
          {tab === "stock" && (
            <Link
              to="/products"
              className="ml-auto self-center text-sm font-medium text-accent hover:underline"
            >
              จัดการสินค้าถัง →
            </Link>
          )}
        </div>

        {tab === "stock" && (
          <DataTable<CylinderStockRow>
            rows={cylinderStock}
            rowKey={(r) => r.size}
            empty="ยังไม่ได้ตั้งขนาดถัง"
            columns={[
              {
                header: "ขนาด",
                cell: (r) => (
                  <span className="font-medium text-ink">{r.size}</span>
                ),
              },
              {
                header: "ถังเต็ม",
                align: "right",
                cell: (r) => (
                  <span className="font-medium text-ok tabular-nums">
                    {fmtQty(r.filled)}
                  </span>
                ),
              },
              {
                header: "ถังเปล่า",
                align: "right",
                cell: (r) => (
                  <span className="tabular-nums">{fmtQty(r.empty)}</span>
                ),
              },
              {
                header: "อยู่กับลูกค้า",
                align: "right",
                hideOnMobile: true,
                cell: (r) => (
                  <span className="tabular-nums text-muted">
                    {fmtQty(r.at_customer)}
                  </span>
                ),
              },
              {
                header: "ชำรุด",
                align: "right",
                hideOnMobile: true,
                cell: (r) =>
                  Number(r.damaged) > 0 ? (
                    <span className="tabular-nums text-danger">
                      {fmtQty(r.damaged)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                header: "ต่างยี่ห้อ",
                align: "right",
                hideOnMobile: true,
                cell: (r) => (
                  <span className="tabular-nums text-muted">
                    {fmtQty(r.other_brand)}
                  </span>
                ),
              },
              {
                header: "",
                align: "right",
                cell: (r) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Flame size={14} />}
                    onClick={() => openFill(r.size)}
                  >
                    บรรจุ
                  </Button>
                ),
              },
            ]}
          />
        )}

        {tab === "deposits" && (
          <DataTable<CylinderDeposit>
            rows={deposits}
            rowKey={(d) => d.id}
            empty="ยังไม่มีรายการมัดจำ"
            columns={[
              { header: "วันที่", cell: (d) => fmtDate(d.date) },
              {
                header: "ลูกค้า",
                cell: (d) => (
                  <Link
                    to={`/customers/${d.customer_id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {customerName(d.customer_id)}
                  </Link>
                ),
              },
              { header: "ขนาด", cell: (d) => d.size },
              {
                header: "จำนวน",
                align: "right",
                cell: (d) => `${fmtQty(d.qty)} ใบ`,
              },
              {
                header: "รายการ",
                cell: (d) => (
                  <Badge tone={d.type === "รับมัดจำ" ? "ok" : "warn"}>
                    {d.type}
                  </Badge>
                ),
              },
              {
                header: "เงิน",
                align: "right",
                cell: (d) => (
                  <span
                    className={`tabular-nums ${
                      d.type === "รับมัดจำ" ? "text-ok" : "text-danger"
                    }`}
                  >
                    {d.type === "รับมัดจำ" ? "+" : "−"}
                    {fmtBaht(d.amount)}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>

      {tab === "deposits" && (
        <Section
          className="mt-4"
          title="ถังที่ลูกค้าวางมัดจำไว้"
          hint="จำนวนถังและเงินที่ต้องคืนเมื่อลูกค้าเลิกใช้"
        >
          <DepositBalances />
        </Section>
      )}

      {/* ---- บันทึกการบรรจุ ---- */}
      <Modal
        open={fillOpen}
        onClose={() => setFillOpen(false)}
        title={`บรรจุแก๊ส ${fillSize}`}
        hint="ถังเปล่าลด · แก๊สดิบลด · ถังเต็มเพิ่ม — เกิดขึ้นพร้อมกันทั้งหมด"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFillOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submitFill} disabled={busy || fillQty <= 0}>
              {busy ? "กำลังบันทึก…" : "บันทึกการบรรจุ"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="จำนวนถังที่บรรจุ">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                inputMode="decimal"
                min="1"
                value={fillQty}
                onChange={(e) => setFillQty(Number(e.target.value) || 0)}
              />
            )}
          </Field>
          <Field label="หมายเหตุ">
            {(id) => (
              <TextInput
                id={id}
                value={fillNote}
                onChange={(e) => setFillNote(e.target.value)}
                placeholder="เช่น บรรจุรอบเช้า"
              />
            )}
          </Field>
        </div>
      </Modal>

      {/* ---- บันทึกมัดจำ ---- */}
      <Modal
        open={depOpen}
        onClose={() => setDepOpen(false)}
        title="บันทึกมัดจำถัง"
        hint="ระบบจะลงเงินเข้า/ออกในหน้าการเงินให้อัตโนมัติ"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDepOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitDeposit}
              disabled={busy || !depCustomer || depQty <= 0}
            >
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ลูกค้า">
            {(id) => (
              <Select
                id={id}
                value={depCustomer}
                onChange={(e) => setDepCustomer(e.target.value)}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="รายการ">
              {(id) => (
                <Select
                  id={id}
                  value={depType}
                  onChange={(e) => setDepType(e.target.value as DepositType)}
                >
                  <option value="รับมัดจำ">รับมัดจำ (ลูกค้าวางเงิน)</option>
                  <option value="คืนมัดจำ">คืนมัดจำ (คืนเงินลูกค้า)</option>
                </Select>
              )}
            </Field>
            <Field label="ขนาดถัง">
              {(id) => (
                <Select
                  id={id}
                  value={depSize}
                  onChange={(e) => {
                    setDepSize(e.target.value);
                    setDepAmount(suggestAmount(e.target.value, depQty));
                  }}
                >
                  {cylinderSizes.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="จำนวนถัง">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={depQty}
                  onChange={(e) => {
                    const q = Number(e.target.value) || 0;
                    setDepQty(q);
                    setDepAmount(suggestAmount(depSize, q));
                  }}
                />
              )}
            </Field>
            <Field label="เงินมัดจำรวม">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={depAmount}
                  onChange={(e) => setDepAmount(Number(e.target.value) || 0)}
                />
              )}
            </Field>
            <Field label="วันที่">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={depDate}
                  onChange={(e) => setDepDate(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="หมายเหตุ">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={depNote}
                onChange={(e) => setDepNote(e.target.value)}
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}

/** สรุปถัง/เงินมัดจำคงค้างรายลูกค้า */
function DepositBalances() {
  const { customers, depositBalance } = useDerived();

  const rows = customers
    .map((c) => ({ customer: c, items: depositBalance(c.id) }))
    .filter((r) => r.items.length > 0);

  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted">ยังไม่มีถังที่ค้างมัดจำ</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map(({ customer, items }) => (
        <li key={customer.id} className="flex flex-wrap gap-2 p-3 text-sm">
          <Link
            to={`/customers/${customer.id}`}
            className="font-medium text-accent hover:underline"
          >
            {customer.name}
          </Link>
          <span className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-muted">
            {items.map((it) => (
              <span key={it.size}>
                {it.size} · {fmtQty(it.qty)} ใบ ({fmtBaht(it.amount)})
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
