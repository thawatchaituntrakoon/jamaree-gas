import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { fmtQty } from "@/lib/constants";

/** เหตุผลที่เจอบ่อย — เลือก "อื่น ๆ" แล้วพิมพ์เองได้ */
const REASONS = [
  "ยอดยกมาเริ่มต้น",
  "ตรวจวัดถังจริงหน้างาน",
  "แก๊สรั่ว / สูญหาย",
  "แก้ตัวเลขที่คีย์ผิด",
] as const;

const OTHER = "อื่น ๆ";

interface Props {
  open: boolean;
  /** กิโลที่ระบบคิดว่าเหลืออยู่ตอนนี้ */
  currentKg: number;
  /** ความจุถัง — 0 = ยังไม่ได้ตั้ง ข้ามการเช็คเกินถัง */
  capacityKg: number;
  onClose: () => void;
  onSubmit: (newKg: number, reason: string) => Promise<void>;
}

/**
 * ตั้งยอดแก๊สในถังเก็บใหญ่ให้ตรงกับของจริง
 * ⭐ ไม่ได้เขียนทับ stock ตรง ๆ — ส่วนต่างจะกลายเป็นรายการ "ปรับเพิ่ม/ปรับลด" ให้ตามรอยย้อนหลังได้
 */
export function BulkTankAdjustmentModal({
  open,
  currentKg,
  capacityKg,
  onClose,
  onSubmit,
}: Props) {
  const [kg, setKg] = useState("");
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKg(String(currentKg));
    setReason(REASONS[0]);
    setCustomReason("");
  }, [open, currentKg]);

  const target = Number(kg);
  const valid = kg.trim() !== "" && Number.isFinite(target);
  const diff = valid ? target - currentKg : 0;
  const finalReason = reason === OTHER ? customReason.trim() : reason;

  const problem = !valid
    ? "ใส่ยอดที่วัดได้จริงก่อน"
    : target < 0
      ? "ยอดในถังติดลบไม่ได้"
      : capacityKg > 0 && target > capacityKg
        ? `ใส่เกินความจุถัง — ถังจุได้ ${fmtQty(capacityKg)} kg`
        : diff === 0
          ? "ยอดเท่าเดิม ไม่ต้องปรับ"
          : !finalReason
            ? "ใส่เหตุผลก่อน จะได้ย้อนดูทีหลังรู้เรื่อง"
            : null;

  async function submit() {
    if (problem) return;
    setBusy(true);
    try {
      await onSubmit(target, finalReason);
      onClose();
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="ตั้งค่ายอดยกมา / ปรับปรุงสต๊อก"
      hint="ใส่ยอดที่วัดได้จริงในถัง ระบบจะบันทึกส่วนต่างเป็นรายการปรับสต๊อกให้เอง"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !!problem}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="ยอดในระบบตอนนี้">
          {(id) => (
            <TextInput
              id={id}
              readOnly
              value={`${fmtQty(currentKg)} kg`}
              className="bg-paper text-muted"
            />
          )}
        </Field>

        <Field
          label="ยอดจริงในถัง (กิโล)"
          hint={
            capacityKg > 0 ? `ถังจุได้ ${fmtQty(capacityKg)} kg` : undefined
          }
        >
          {(id) => (
            <TextInput
              id={id}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="0"
            />
          )}
        </Field>

        <Field label="เหตุผล">
          {(id) => (
            <Select
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {[...REASONS, OTHER].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {reason === OTHER && (
          <Field label="เหตุผล (พิมพ์เอง)">
            {(id) => (
              <TextInput
                id={id}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="เช่น เติมจากรถขนส่งแต่ลืมคีย์"
              />
            )}
          </Field>
        )}

        {valid && diff !== 0 && (
          <p
            className={`flex items-center gap-2 rounded-btn px-3 py-2.5 text-sm ${
              diff > 0 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
            }`}
          >
            {diff > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            {diff > 0 ? "ปรับเพิ่ม" : "ปรับลด"} {fmtQty(Math.abs(diff))} kg
            <span className="text-muted">
              ({fmtQty(currentKg)} → {fmtQty(target)} kg)
            </span>
          </p>
        )}

        {problem && diff === 0 && valid && (
          <p className="rounded-btn bg-paper px-3 py-2.5 text-sm text-muted">
            {problem}
          </p>
        )}
        {problem && (diff !== 0 || !valid) && (
          <p className="rounded-btn bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {problem}
          </p>
        )}
      </div>
    </Modal>
  );
}
