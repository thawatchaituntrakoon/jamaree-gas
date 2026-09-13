import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Check, ChevronRight } from "lucide-react";
import { Card, Section } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  GAS_FILL_KINDS,
  ORDER_STAGES,
  fmtBaht,
  fmtDate,
  fmtQty,
} from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";

/** แถบไทม์ไลน์งาน — แสดงผลอย่างเดียว ไม่เกี่ยวกับการตัดสต๊อก */
function Timeline({ current }: { current: string }) {
  const idx = Math.max(0, ORDER_STAGES.indexOf(current as never));
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {ORDER_STAGES.map((stage, i) => {
        const done = i < idx;
        const now = i === idx;
        return (
          <li key={stage} className="flex items-center gap-1.5">
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
                done
                  ? "bg-ok-soft text-ok"
                  : now
                    ? "bg-accent text-on-accent"
                    : "bg-paper text-muted",
              ].join(" ")}
            >
              {done && <Check size={13} />}
              {stage}
            </span>
            {i < ORDER_STAGES.length - 1 && (
              <ChevronRight size={14} className="text-line" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const {
    orders,
    productById,
    customerById,
    priceFor,
    orderTotal,
    orderProfit,
    orderOutstanding,
  } = useDerived();

  const completeOrder = useAppStore((s) => s.completeOrder);
  const voidOrder = useAppStore((s) => s.voidOrder);
  const advanceOrderStage = useAppStore((s) => s.advanceOrderStage);

  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <>
        <PageHeader
          title="ไม่พบบิล"
          backTo="/orders"
          backLabel="กลับหน้าออเดอร์"
        />
        <Card className="p-8 text-center text-sm text-muted">
          บิลนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง
        </Card>
      </>
    );
  }

  const customer = customerById(order.customer_id);
  const total = orderTotal(order);
  const profit = orderProfit(order);
  const outstanding = orderOutstanding(order);
  const paid = Number(order.paid_cash) + Number(order.paid_transfer);
  const canAdvance =
    !order.voided &&
    !order.stock_deducted &&
    ORDER_STAGES.indexOf(order.work_stage) < ORDER_STAGES.length - 2;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`บิลวันที่ ${fmtDate(order.date)}`}
        hint={
          customer ? (
            <>
              ลูกค้า{" "}
              <Link
                to={`/customers/${customer.id}`}
                className="text-accent hover:underline"
              >
                {customer.name}
              </Link>
            </>
          ) : (
            "ลูกค้าทั่วไป"
          )
        }
        backTo="/orders"
        backLabel="กลับหน้าออเดอร์"
        action={
          order.voided ? (
            <Badge tone="danger">ยกเลิกแล้ว</Badge>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canAdvance && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => advanceOrderStage(order.id))}
                >
                  ขั้นถัดไป
                </Button>
              )}
              {!order.stock_deducted && (
                <Button
                  variant="ok"
                  disabled={busy}
                  onClick={() => run(() => completeOrder(order.id))}
                >
                  {busy ? "กำลังปิดบิล…" : "ปิดบิล & ตัดสต๊อก"}
                </Button>
              )}
              <Button
                variant="danger"
                icon={<Ban size={15} />}
                disabled={busy}
                onClick={() => setConfirmVoid(true)}
              >
                ยกเลิกบิล
              </Button>
            </div>
          )
        }
      />

      <Card className="p-4 md:p-5">
        <Timeline current={order.work_stage} />
        {!order.stock_deducted && !order.voided && (
          <p className="mt-3 text-sm text-muted">
            บิลนี้ยัง<b className="text-ink">ไม่ได้ตัดสต๊อก</b> — กด “ปิดบิล
            &amp; ตัดสต๊อก” เมื่อส่งของแล้ว
          </p>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "ยอดรวม", value: `${fmtBaht(total)} บาท`, tone: "text-ink" },
          {
            label: "รับมาแล้ว",
            value: `${fmtBaht(paid)} บาท`,
            tone: "text-ok",
          },
          {
            label: "ค้างชำระ",
            value: outstanding > 0 ? `${fmtBaht(outstanding)} บาท` : "ครบแล้ว",
            tone: outstanding > 0 ? "text-danger" : "text-ok",
          },
          {
            label: "กำไรโดยประมาณ",
            value: `${fmtBaht(profit)} บาท`,
            tone: profit >= 0 ? "text-ok" : "text-danger",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`mt-1 font-head text-xl font-semibold ${s.tone}`}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <Section
        title="รายการในบิล"
        hint={
          order.stock_deducted
            ? "ตัดสต๊อกเรียบร้อยแล้ว"
            : "ยังไม่ได้ตัดสต๊อก แก้ไขได้ที่หน้าออเดอร์"
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">สินค้า</th>
                <th className="px-4 py-2.5 text-right font-medium">จำนวน</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  ราคา/หน่วย
                </th>
                <th className="px-4 py-2.5 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => {
                const product = productById(it.product_id);
                const unitPrice = priceFor(it.product_id, order.customer_id);
                const usesRaw = product
                  ? GAS_FILL_KINDS.includes(product.kind)
                  : false;
                return (
                  <tr
                    key={it.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-3">
                      {product ? (
                        <Link
                          to={`/products/${product.id}`}
                          className="text-ink hover:text-accent hover:underline"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <span className="text-muted">สินค้าถูกลบไปแล้ว</span>
                      )}
                      {usesRaw && product?.fill_kg ? (
                        <p className="text-xs text-muted">
                          ตัดแก๊สดิบ{" "}
                          {fmtQty(Number(it.qty) * Number(product.fill_kg))} กก.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtQty(Number(it.qty))} {product?.unit ?? ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtBaht(unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {fmtBaht(unitPrice * Number(it.qty))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-muted">
                  ยอดรวมทั้งบิล
                </td>
                <td className="px-4 py-3 text-right font-head text-base font-semibold tabular-nums">
                  {fmtBaht(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <Modal
        open={confirmVoid}
        onClose={() => setConfirmVoid(false)}
        title="ยกเลิกบิลนี้?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmVoid(false)}>
              ไม่ยกเลิก
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                await run(() => voidOrder(order.id));
                setConfirmVoid(false);
              }}
            >
              {busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิกบิล"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          {order.stock_deducted
            ? "ระบบจะคืนของเข้าสต๊อกกลับทั้งหมด และลบยอดเงินของบิลนี้ออกจากบัญชี"
            : "บิลนี้ยังไม่ได้ตัดสต๊อก ยกเลิกได้เลยโดยไม่กระทบของในคลัง"}
        </p>
        <p className="mt-2 text-sm text-muted">
          ตัวบิลจะยังอยู่ในประวัติ แค่ถูกทำเครื่องหมายว่ายกเลิกแล้ว
        </p>
      </Modal>
    </div>
  );
}
