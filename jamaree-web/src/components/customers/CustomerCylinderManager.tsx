import { useMemo, useState } from "react";
import { Cylinder, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { CUSTODY_TYPES, fmtDate, fmtQty, todayStr } from "@/lib/constants";
import type { StatusTone } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { CustodyEntry, CustodyType, UUID } from "@/types";

const TYPE_TONE: Record<CustodyType, StatusTone> = {
  ยืม: "warn",
  คืน: "ok",
  ฝาก: "info",
  ถอนฝาก: "muted",
  เปลี่ยนถังชำรุด: "danger",
};

const TYPE_HINT: Record<CustodyType, string> = {
  ยืม: "ลูกค้าเอาถังของร้านไปใช้",
  คืน: "ลูกค้าเอาถังที่ยืมไปมาคืน",
  ฝาก: "ลูกค้าเอาถังของตัวเองมาฝากไว้ที่ร้าน",
  ถอนฝาก: "ลูกค้ามารับถังที่ฝากไว้กลับไป",
  เปลี่ยนถังชำรุด: "แลกถังต่อถัง ยอดค้างไม่ขยับ",
};

export function CustomerCylinderManager({ customerId }: { customerId: UUID }) {
  const { custody, custodyBalance } = useDerived();
  const cylinderSizes = useAppStore((s) => s.cylinderSizes);
  const saveCustody = useAppStore((s) => s.saveCustody);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [size, setSize] = useState("");
  const [type, setType] = useState<CustodyType>("ยืม");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  const balances = custodyBalance(customerId);

  const history = useMemo(
    () =>
      custody
        .filter((c) => c.customer_id === customerId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [custody, customerId],
  );

  /** ขนาดที่เลือกได้ — ทะเบียนขนาดถัง บวกขนาดเก่าที่เคยบันทึกไว้แต่ถูกลบออกจากทะเบียนแล้ว */
  const sizeOptions = useMemo(() => {
    const names = cylinderSizes.map((s) => s.name);
    const extra = [...new Set(history.map((h) => h.size))].filter(
      (s) => !names.includes(s),
    );
    return [...names, ...extra];
  }, [cylinderSizes, history]);

  const qtyNum = Number(qty) || 0;
  const current = balances.find((b) => b.size === size);
  const borrowed = current?.borrowed ?? 0;
  const deposited = current?.deposited ?? 0;

  const problem = !size
    ? "เลือกขนาดถังก่อน"
    : qtyNum <= 0
      ? "จำนวนต้องมากกว่า 0"
      : type === "คืน" && qtyNum > borrowed
        ? `ลูกค้ายืมถัง ${size} ไปแค่ ${fmtQty(borrowed)} ถัง คืนเกินกว่านี้ไม่ได้`
        : type === "ถอนฝาก" && qtyNum > deposited
          ? `ลูกค้าฝากถัง ${size} ไว้แค่ ${fmtQty(deposited)} ถัง ถอนเกินกว่านี้ไม่ได้`
          : null;

  function openForm() {
    setDate(todayStr());
    setSize(sizeOptions[0] ?? "");
    setType("ยืม");
    setQty("1");
    setNote("");
    setOpen(true);
  }

  async function submit() {
    if (problem) return;
    setBusy(true);
    try {
      await saveCustody({
        customer_id: customerId,
        date,
        size,
        type,
        qty: qtyNum,
        note: note.trim(),
      });
      setOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section
        title="บัญชีถังของลูกค้า"
        hint="ถังที่ยืมไป และถังที่เอามาฝากไว้ที่ร้าน"
        action={
          <Button
            size="sm"
            icon={<Plus size={14} />}
            onClick={openForm}
            disabled={!sizeOptions.length}
          >
            บันทึกรายการถัง
          </Button>
        }
      >
        {balances.length ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {balances.map((c) => (
              <div
                key={c.size}
                className="rounded-card border border-line p-3.5"
              >
                <div className="flex items-center gap-2">
                  <Cylinder size={16} className="text-accent2" />
                  <p className="font-medium text-ink">{c.size}</p>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-muted">ยืมไป</span>
                    <span
                      className={
                        c.borrowed > 0 ? "font-medium text-warn" : "text-muted"
                      }
                    >
                      {fmtQty(c.borrowed)} ถัง
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted">ฝากไว้</span>
                    <span className="text-ink">{fmtQty(c.deposited)} ถัง</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {sizeOptions.length
              ? "ไม่มีถังค้างอยู่กับลูกค้ารายนี้"
              : "ยังไม่ได้ตั้งขนาดถังในระบบ — ไปตั้งที่หน้าถังแก๊สก่อน"}
          </p>
        )}

        <DataTable<CustodyEntry>
          rows={history}
          rowKey={(c) => c.id}
          empty="ยังไม่มีประวัติยืม/คืน/ฝากถัง"
          columns={[
            { header: "วันที่", cell: (c) => fmtDate(c.date) },
            {
              header: "ขนาด",
              cell: (c) => <span className="text-ink">{c.size}</span>,
            },
            {
              header: "รายการ",
              cell: (c) => <Badge tone={TYPE_TONE[c.type]}>{c.type}</Badge>,
            },
            {
              header: "จำนวน",
              align: "right",
              cell: (c) => (
                <span className="tabular-nums">{fmtQty(c.qty)} ถัง</span>
              ),
            },
            {
              header: "โน้ต",
              hideOnMobile: true,
              cell: (c) => <span className="text-muted">{c.note || "—"}</span>,
            },
          ]}
        />
      </Section>

      <Modal
        open={open}
        title="บันทึกรายการถัง"
        hint="ยอดค้างจะคิดจากรายการพวกนี้ทั้งหมด"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !!problem}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
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
            <Field label="ขนาดถัง">
              {(id) => (
                <Select
                  id={id}
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                >
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="รายการ" hint={TYPE_HINT[type]}>
            {(id) => (
              <Select
                id={id}
                value={type}
                onChange={(e) => setType(e.target.value as CustodyType)}
              >
                {CUSTODY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="จำนวน (ถัง)"
            hint={
              size
                ? `ตอนนี้ยืมไป ${fmtQty(borrowed)} ถัง · ฝากไว้ ${fmtQty(deposited)} ถัง`
                : undefined
            }
          >
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={1}
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            )}
          </Field>

          <Field label="โน้ต">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ยืมไปใช้งานที่ไซต์งาน"
              />
            )}
          </Field>

          {problem && (
            <p className="rounded-btn bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {problem}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
