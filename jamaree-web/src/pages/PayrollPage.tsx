import { useState } from "react";
import { Calculator, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBaht, fmtDate } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import type { Payroll, PayrollRow } from "@/types";

function thisPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
  });
}

const money2 = (n: number) => Math.round(n * 100) / 100;

/** คิดยอดสุทธิใหม่ทุกครั้งที่แก้ตัวเลขหัก — สูตรเดียวกับฝั่งฐานข้อมูล */
function recalc(r: PayrollRow): PayrollRow {
  return {
    ...r,
    net: money2(
      Number(r.gross) -
        Number(r.sso_amt) -
        Number(r.tax_amt) -
        Number(r.other_deduct),
    ),
  };
}

export function PayrollPage() {
  const payrolls = useAppStore((s) => s.payrolls);
  const buildPayroll = useAppStore((s) => s.buildPayroll);
  const savePayrollRows = useAppStore((s) => s.savePayrollRows);
  const payPayroll = useAppStore((s) => s.payPayroll);
  const deletePayroll = useAppStore((s) => s.deletePayroll);

  const [period, setPeriod] = useState(thisPeriod());
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [payFor, setPayFor] = useState<Payroll | null>(null);
  const [deleteFor, setDeleteFor] = useState<Payroll | null>(null);

  const editing = payrolls.find((p) => p.id === openId) ?? null;
  const rowsTotal = rows.reduce((sum, r) => sum + Number(r.net), 0);

  async function build() {
    setBusy(true);
    try {
      const p = await buildPayroll(period);
      setOpenId(p.id);
      setRows(p.rows);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  function openPayroll(p: Payroll) {
    setOpenId(p.id);
    setRows(p.rows);
  }

  function setRow(staffId: string, patch: Partial<PayrollRow>) {
    setRows((list) =>
      list.map((r) =>
        r.staff_id === staffId ? recalc({ ...r, ...patch }) : r,
      ),
    );
  }

  async function saveRows() {
    if (!editing) return;
    setBusy(true);
    try {
      await savePayrollRows(editing.id, rows);
      setOpenId(null);
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

  const payTotal = (p: Payroll) =>
    p.rows.reduce((sum, r) => sum + Number(r.net), 0);

  return (
    <>
      <PageHeader
        title="เงินเดือน"
        hint="คำนวณจากทะเบียนพนักงาน + วันที่มาทำงานจริง แล้วแช่ตัวเลขไว้เป็นงวด"
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Field label="งวดเดือน">
              {(id) => (
                <TextInput
                  id={id}
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Button
            icon={<Calculator size={16} />}
            onClick={build}
            disabled={busy || !period}
          >
            {busy ? "กำลังคำนวณ…" : "คำนวณงวดนี้"}
          </Button>
          <p className="text-sm text-muted">
            กดซ้ำได้ — ตัวเลขจะคำนวณใหม่ตราบใดที่ยังไม่จ่าย
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        {payrolls.length === 0 && (
          <Card className="p-6 text-sm text-muted">
            ยังไม่มีงวดเงินเดือน — เลือกเดือนแล้วกด “คำนวณงวดนี้”
          </Card>
        )}

        {payrolls.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="font-head font-semibold text-ink">
                  {periodLabel(p.period)}
                </p>
                <p className="text-sm text-muted">
                  {p.rows.length} คน
                  {p.paid_at && ` · จ่ายเมื่อ ${fmtDate(p.paid_at)}`}
                </p>
              </div>
              <Badge tone={p.status === "จ่ายแล้ว" ? "ok" : "warn"}>
                {p.status}
              </Badge>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="font-head text-lg font-semibold text-ink tabular-nums">
                  {fmtBaht(payTotal(p))}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openPayroll(p)}
                >
                  {p.status === "ร่าง" ? "ดู/แก้ไข" : "ดูรายละเอียด"}
                </Button>
                {p.status === "ร่าง" && (
                  <>
                    <Button
                      variant="ok"
                      size="sm"
                      icon={<Wallet size={14} />}
                      onClick={() => setPayFor(p)}
                    >
                      จ่ายเงิน
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
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ---- รายละเอียดงวด ---- */}
      <Modal
        wide
        open={!!editing}
        onClose={() => setOpenId(null)}
        title={editing ? `งวด ${periodLabel(editing.period)}` : ""}
        hint={
          editing?.status === "ร่าง"
            ? "แก้ช่องหักอื่น ๆ / ภาษี ได้ ยอดสุทธิจะคิดใหม่ให้เอง"
            : "งวดนี้จ่ายแล้ว ตัวเลขถูกแช่ไว้ แก้ไม่ได้"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenId(null)}>
              ปิด
            </Button>
            {editing?.status === "ร่าง" && (
              <Button onClick={saveRows} disabled={busy}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            )}
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="pb-2 font-medium">พนักงาน</th>
                <th className="pb-2 text-right font-medium">มาทำงาน</th>
                <th className="pb-2 text-right font-medium">รายได้รวม</th>
                <th className="pb-2 text-right font-medium">ประกันสังคม</th>
                <th className="pb-2 text-right font-medium">ภาษี</th>
                <th className="pb-2 text-right font-medium">หักอื่น ๆ</th>
                <th className="pb-2 text-right font-medium">สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staff_id} className="border-b border-line/60">
                  <td className="py-2 text-ink">
                    {r.name}
                    <span className="block text-xs text-muted">
                      {r.pay_type}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.present_days} วัน
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {fmtBaht(r.gross)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted">
                    {fmtBaht(r.sso_amt)}
                  </td>
                  <td className="py-2 text-right">
                    {editing?.status === "ร่าง" ? (
                      <TextInput
                        aria-label={`ภาษีของ ${r.name}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        className="w-24 rounded-btn border border-line bg-card px-2 py-1 text-right text-sm"
                        value={r.tax_amt}
                        onChange={(e) =>
                          setRow(r.staff_id, {
                            tax_amt: Number(e.target.value) || 0,
                          })
                        }
                      />
                    ) : (
                      <span className="tabular-nums text-muted">
                        {fmtBaht(r.tax_amt)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {editing?.status === "ร่าง" ? (
                      <TextInput
                        aria-label={`หักอื่น ๆ ของ ${r.name}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        className="w-24 rounded-btn border border-line bg-card px-2 py-1 text-right text-sm"
                        value={r.other_deduct}
                        onChange={(e) =>
                          setRow(r.staff_id, {
                            other_deduct: Number(e.target.value) || 0,
                          })
                        }
                      />
                    ) : (
                      <span className="tabular-nums text-muted">
                        {fmtBaht(r.other_deduct)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-medium text-ink tabular-nums">
                    {fmtBaht(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-between rounded-btn bg-paper px-3 py-2.5 text-sm">
          <span className="text-muted">รวมจ่ายทั้งงวด</span>
          <span className="font-medium text-ink tabular-nums">
            {fmtBaht(rowsTotal)}
          </span>
        </div>
      </Modal>

      {/* ---- ยืนยันจ่ายเงิน ---- */}
      <Modal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        title="จ่ายเงินเดือน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayFor(null)}>
              ยังไม่จ่าย
            </Button>
            <Button
              variant="ok"
              disabled={busy}
              onClick={() =>
                payFor &&
                run(
                  () => payPayroll(payFor.id),
                  () => setPayFor(null),
                )
              }
            >
              {busy ? "กำลังบันทึก…" : "ยืนยันจ่ายแล้ว"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          จ่ายงวด {payFor && periodLabel(payFor.period)} ยอดรวม{" "}
          <span className="font-medium">
            {payFor && fmtBaht(payTotal(payFor))}
          </span>{" "}
          ใช่ไหม
        </p>
        <p className="mt-1 text-sm text-muted">
          ระบบจะลงรายจ่ายก้อนนี้ในหน้าการเงินให้อัตโนมัติ และล็อกตัวเลขงวดนี้ไว้
        </p>
      </Modal>

      {/* ---- ลบงวดร่าง ---- */}
      <Modal
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        title="ลบงวดเงินเดือน"
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
                  () => deletePayroll(deleteFor.id),
                  () => setDeleteFor(null),
                )
              }
            >
              ลบ
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          ลบงวด {deleteFor && periodLabel(deleteFor.period)} ใช่ไหม
        </p>
        <p className="mt-1 text-sm text-muted">คำนวณใหม่ได้ตลอด</p>
      </Modal>
    </>
  );
}
