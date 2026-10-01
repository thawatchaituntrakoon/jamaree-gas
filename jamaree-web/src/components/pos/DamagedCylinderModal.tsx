import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/Field";
import { fmtQty } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import type { MoveReason, MoveType, Product } from "@/types";

type Action = "รับเข้า" | "ส่งซ่อม" | "ทำลาย";

const ACTIONS: ReadonlyArray<{
  key: Action;
  label: string;
  hint: string;
  move: MoveType;
  reason: MoveReason | null;
}> = [
  {
    key: "รับเข้า",
    label: "รับถังชำรุดเข้ากอง",
    hint: "ลูกค้าเอาถังที่ใช้ไม่ได้มาคืน — กองถังชำรุดเพิ่มขึ้น",
    move: "รับเข้า",
    reason: null,
  },
  {
    key: "ส่งซ่อม",
    label: "ส่งซ่อม",
    hint: "ส่งออกไปซ่อม เดี๋ยวได้กลับมา — กองถังชำรุดลดลง",
    move: "เบิกออก",
    reason: "ส่งซ่อม",
  },
  {
    key: "ทำลาย",
    label: "ทำลาย / ตัดจำหน่าย",
    hint: "ตัดทิ้งถาวร ไม่ได้กลับมาแล้ว — กองถังชำรุดลดลง",
    move: "เบิกออก",
    reason: "ทำลาย/ตัดจำหน่าย",
  },
];

const TAP = "touch-manipulation select-none";

/**
 * บันทึกถังชำรุดหน้าร้าน — ไม่ใช่การขาย ไม่มีเงินเข้ามาเกี่ยว
 * ⭐ สต๊อกขยับผ่าน addMove() จุดเดียวเหมือนทุกที่ · เบิกออกต้องมีเหตุผลเสมอ (ฐานข้อมูลบังคับ)
 */
export function DamagedCylinderModal({ onClose }: { onClose: () => void }) {
  const products = useAppStore((s) => s.products);
  const cylinderSizes = useAppStore((s) => s.cylinderSizes);
  const addMove = useAppStore((s) => s.addMove);
  const saveProduct = useAppStore((s) => s.saveProduct);

  const [size, setSize] = useState(cylinderSizes[0]?.name ?? "");
  const [action, setAction] = useState<Action>("รับเข้า");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /** สินค้าถังชำรุดรายขนาด — ขนาดไหนยังไม่เคยมี ก็ยังไม่มีแถวสินค้า */
  const damagedBySize = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.kind === "ชำรุด") map.set((p.size ?? "").trim(), p);
    }
    return map;
  }, [products]);

  const picked = ACTIONS.find((a) => a.key === action)!;
  const onHand = Number(damagedBySize.get(size)?.stock ?? 0);
  const qtyNum = Number(qty) || 0;

  const blocked = !size
    ? "ยังไม่ได้ตั้งขนาดถังในระบบ"
    : qtyNum <= 0
      ? "จำนวนต้องมากกว่า 0"
      : picked.move === "เบิกออก" && qtyNum > onHand
        ? `กองถังชำรุด ${size} มีอยู่ ${fmtQty(onHand)} ใบ เบิกเกินกว่านี้ไม่ได้`
        : null;

  async function submit() {
    if (blocked || busy) return;
    setProblem(null);
    setBusy(true);
    try {
      let product = damagedBySize.get(size);
      if (!product) {
        // ขนาดนี้ยังไม่เคยมีถังชำรุด — เปิดทะเบียนสินค้าให้เลย จะได้บันทึกต่อได้ทันที
        product = await saveProduct({
          sku: `CYL-DMG-${size.toUpperCase()}`,
          name: `ถังชำรุด ${size}`,
          unit: "ใบ",
          kind: "ชำรุด",
          size,
        });
      }
      await addMove({
        product_id: product.id,
        type: picked.move,
        qty: qtyNum,
        note: note.trim() || `${picked.label} (หน้าร้าน)`,
        reason: picked.reason,
      });
      setDone(`${picked.label} ${size} จำนวน ${fmtQty(qtyNum)} ใบ เรียบร้อย`);
      setQty("1");
      setNote("");
    } catch {
      setProblem("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="ถังชำรุด / ตัดทำลาย"
      hint="บันทึกกองถังชำรุด — ไม่ใช่การขาย ไม่มีเงินเข้าออก"
      footer={
        <div className="flex w-full gap-2">
          <Button variant="secondary" onClick={onClose} className="h-12 flex-1">
            ปิด
          </Button>
          <Button
            variant={action === "ทำลาย" ? "danger" : "ok"}
            disabled={busy || !!blocked}
            onClick={() => void submit()}
            className="h-12 flex-1"
          >
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm text-muted">ขนาดถัง</p>
          <div className="flex flex-wrap gap-2">
            {cylinderSizes.map((s) => {
              const stock = Number(damagedBySize.get(s.name)?.stock ?? 0);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSize(s.name);
                    setDone(null);
                  }}
                  className={[
                    TAP,
                    "rounded-btn border px-4 py-2.5 text-sm font-medium transition-colors",
                    size === s.name
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-ink hover:bg-paper",
                  ].join(" ")}
                >
                  {s.name}
                  <span className="ml-1.5 text-xs text-muted">
                    ({fmtQty(stock)})
                  </span>
                </button>
              );
            })}
            {!cylinderSizes.length && (
              <p className="text-sm text-muted">
                ยังไม่ได้ตั้งขนาดถัง — ไปตั้งที่หน้าถังแก๊สก่อน
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm text-muted">รายการ</p>
          <div className="space-y-1.5">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  setAction(a.key);
                  setDone(null);
                }}
                className={[
                  TAP,
                  "block w-full rounded-btn border px-3.5 py-2.5 text-left transition-colors",
                  action === a.key
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-paper",
                ].join(" ")}
              >
                <span
                  className={`block text-sm font-medium ${
                    action === a.key ? "text-accent" : "text-ink"
                  }`}
                >
                  {a.label}
                </span>
                <span className="block text-xs text-muted">{a.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-muted">จำนวน (ใบ)</span>
          <TextInput
            type="number"
            inputMode="decimal"
            min="1"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setDone(null);
            }}
            className="py-3 text-right font-head text-xl"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-muted">หมายเหตุ</span>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ลูกค้าเอาถังบุบมาเปลี่ยน"
          />
        </label>

        {blocked && (
          <p className="rounded-btn bg-warn-soft px-3 py-2.5 text-sm text-warn">
            {blocked}
          </p>
        )}
        {problem && (
          <p className="rounded-btn bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {problem}
          </p>
        )}
        {done && (
          <p className="flex items-center gap-2 rounded-btn bg-ok-soft px-3 py-2.5 text-sm text-ok">
            <CheckCircle2 size={16} className="shrink-0" />
            {done}
          </p>
        )}
      </div>
    </Modal>
  );
}
