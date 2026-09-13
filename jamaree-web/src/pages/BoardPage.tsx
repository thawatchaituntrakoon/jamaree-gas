import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ORDER_STAGES, fmtBaht, fmtDate, workStageTone } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { Order, UUID, WorkStage } from "@/types";

/** คำบนปุ่มเดินหน้า — บอกว่ากดแล้วจะไปขั้นไหน */
const NEXT_LABEL: Record<WorkStage, string> = {
  ใหม่: "เริ่มทำ",
  กำลังทำ: "ส่งของแล้ว",
  ส่งแล้ว: "ปิดงาน",
  ปิด: "",
};

const COLUMN_HINT: Record<WorkStage, string> = {
  ใหม่: "รับงานเข้ามา ยังไม่เริ่ม",
  กำลังทำ: "กำลังจัดของ/บรรจุ",
  ส่งแล้ว: "ส่งถึงลูกค้าแล้ว รอปิดบิล",
  ปิด: "ตัดสต๊อกและลงเงินเรียบร้อย",
};

export function BoardPage() {
  const { orders, customerName, staffName, activeStaff, orderTotal } =
    useDerived();
  const advanceOrderStage = useAppStore((s) => s.advanceOrderStage);
  const setOrderAssignee = useAppStore((s) => s.setOrderAssignee);

  const [busyId, setBusyId] = useState<UUID | null>(null);
  const [closing, setClosing] = useState<Order | null>(null);
  const [assigning, setAssigning] = useState<Order | null>(null);
  const [assignee, setAssignee] = useState<UUID | "">("");
  const [mine, setMine] = useState<UUID | "">("");

  /** เอาบิลที่ยกเลิกออก แล้วแยกลงคอลัมน์ตามขั้นงาน */
  const columns = useMemo(() => {
    const live = orders.filter(
      (o) => !o.voided && (!mine || o.assignee_id === mine),
    );
    return ORDER_STAGES.map((stage) => ({
      stage,
      rows: live
        .filter((o) => o.work_stage === stage)
        // ขั้น "ปิด" มีเยอะเรื่อย ๆ — โชว์แค่ล่าสุดพอ ไม่งั้นบอร์ดยาวเกินใช้งาน
        .slice(0, stage === "ปิด" ? 12 : undefined),
    }));
  }, [orders, mine]);

  async function advance(order: Order) {
    setBusyId(order.id);
    try {
      await advanceOrderStage(order.id);
      setClosing(null);
    } catch {
      // ข้อความผิดพลาดขึ้นแถบเตือนด้านบนแล้ว (เช่น สต๊อกไม่พอ)
    } finally {
      setBusyId(null);
    }
  }

  /** ปิดงาน = ตัดสต๊อกจริง ต้องถามก่อนเสมอ ย้อนกลับเองไม่ได้ */
  function onAdvanceClick(order: Order) {
    if (order.work_stage === "ส่งแล้ว" && !order.stock_deducted) {
      setClosing(order);
      return;
    }
    void advance(order);
  }

  function openAssign(order: Order) {
    setAssignee(order.assignee_id ?? "");
    setAssigning(order);
  }

  async function submitAssign() {
    if (!assigning) return;
    setBusyId(assigning.id);
    try {
      await setOrderAssignee(assigning.id, assignee || null);
      setAssigning(null);
    } catch {
      // ข้อความผิดพลาดขึ้นแถบเตือนด้านบนแล้ว
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="บอร์ดงาน"
        hint="ลากสายตาจากซ้ายไปขวา — งานเดินหน้าอย่างเดียว ถอยกลับไม่ได้"
        action={
          <Link to="/orders" className="text-sm text-accent hover:underline">
            ดูแบบตาราง
          </Link>
        }
      />

      {activeStaff.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMine("")}
            className={`rounded-btn px-3 py-1.5 text-sm ${
              mine === ""
                ? "bg-accent-soft font-medium text-accent"
                : "text-muted hover:text-ink"
            }`}
          >
            ทุกคน
          </button>
          {activeStaff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setMine(s.id)}
              className={`rounded-btn px-3 py-1.5 text-sm ${
                mine === s.id
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {s.nickname || s.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-4">
        {columns.map(({ stage, rows }) => (
          <div key={stage} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <div>
                <h2 className="text-base">{stage}</h2>
                <p className="text-xs text-muted">{COLUMN_HINT[stage]}</p>
              </div>
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-muted">
                {rows.length}
              </span>
            </div>

            {rows.length === 0 && (
              <p className="rounded-card border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                ไม่มีงาน
              </p>
            )}

            {rows.map((o) => (
              <Card key={o.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/orders/${o.id}`}
                    className="font-medium text-ink hover:text-accent hover:underline"
                  >
                    {o.customer_id
                      ? customerName(o.customer_id)
                      : "ลูกค้าทั่วไป"}
                  </Link>
                  <Badge tone={workStageTone(o.work_stage)}>
                    {o.work_stage}
                  </Badge>
                </div>

                <p className="mt-0.5 text-xs text-muted">
                  {fmtDate(o.date)} · {o.items.length} รายการ
                </p>

                <p className="mt-2 font-head text-lg font-semibold text-ink tabular-nums">
                  {fmtBaht(orderTotal(o))} บาท
                </p>

                <button
                  type="button"
                  onClick={() => openAssign(o)}
                  className="mt-2 flex w-full items-center gap-1.5 rounded-btn bg-paper px-2 py-1.5 text-xs text-muted hover:text-ink"
                >
                  <UserRound size={13} className="shrink-0" />
                  {o.assignee_id
                    ? staffName(o.assignee_id)
                    : "ยังไม่ได้มอบหมาย"}
                </button>

                {stage !== "ปิด" ? (
                  <Button
                    size="sm"
                    variant={stage === "ส่งแล้ว" ? "ok" : "secondary"}
                    className="mt-2 w-full"
                    icon={
                      stage === "ส่งแล้ว" ? (
                        <CircleCheck size={14} />
                      ) : (
                        <ArrowRight size={14} />
                      )
                    }
                    disabled={busyId === o.id}
                    onClick={() => onAdvanceClick(o)}
                  >
                    {busyId === o.id ? "กำลังบันทึก…" : NEXT_LABEL[stage]}
                  </Button>
                ) : (
                  <p className="mt-2 text-center text-xs text-ok">
                    {o.stock_deducted ? "ตัดสต๊อกแล้ว" : "ปิดงานแล้ว"}
                  </p>
                )}
              </Card>
            ))}
          </div>
        ))}
      </div>

      {/* ---- ยืนยันปิดงาน ---- */}
      <Modal
        open={closing !== null}
        onClose={() => setClosing(null)}
        title="ปิดงานนี้เลยไหม"
        hint="ปิดแล้วย้อนกลับเองไม่ได้ ต้องยกเลิกบิลอย่างเดียว"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClosing(null)}>
              ยังก่อน
            </Button>
            <Button
              variant="ok"
              disabled={busyId !== null}
              onClick={() => closing && void advance(closing)}
            >
              {busyId ? "กำลังปิดงาน…" : "ปิดงาน"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          ปิดงานของ{" "}
          <span className="font-medium">
            {closing?.customer_id
              ? customerName(closing.customer_id)
              : "ลูกค้าทั่วไป"}
          </span>{" "}
          ยอด {closing ? fmtBaht(orderTotal(closing)) : "0"} บาท
        </p>
        <ul className="mt-3 space-y-1 rounded-btn bg-paper px-3.5 py-3 text-sm text-muted">
          <li>• ตัดสต๊อกสินค้าตามรายการในบิล</li>
          <li>• ลงเงินเข้าให้อัตโนมัติ (ถ้าค้างจ่ายจะตั้งเป็นลูกหนี้)</li>
          <li>• ถ้าของไม่พอ ระบบจะไม่ปิดให้และจะบอกว่าขาดอะไร</li>
        </ul>
      </Modal>

      {/* ---- มอบหมายงาน ---- */}
      <Modal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title="มอบหมายงาน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigning(null)}>
              ยกเลิก
            </Button>
            <Button disabled={busyId !== null} onClick={submitAssign}>
              บันทึก
            </Button>
          </>
        }
      >
        <Field label="ผู้รับผิดชอบ">
          {(id) => (
            <Select
              id={id}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">ยังไม่ระบุ</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.nickname ? ` (${s.nickname})` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Modal>
    </>
  );
}
