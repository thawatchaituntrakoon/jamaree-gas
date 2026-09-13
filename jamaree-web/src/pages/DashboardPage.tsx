import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  Cylinder,
  FileText,
  Package,
  Scale,
  Truck,
  UserRoundX,
  Wallet,
} from "lucide-react";
import { Card, Section } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { BulkTankStatus } from "@/components/dashboard/BulkTankStatus";
import { fmtBaht, fmtDate, fmtQty, workStageTone } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import type { Order, Product } from "@/types";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone: "accent" | "warn" | "danger" | "ok";
  to: string;
}

const TONES = {
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
} as const;

function StatCard({ label, value, hint, icon, tone, to }: StatCardProps) {
  return (
    <Link
      to={to}
      className="rounded-card border border-line bg-card p-4 shadow-card transition-shadow hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <span className={`rounded-btn p-1.5 ${TONES[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 font-head text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint ?? "\u00a0"}</p>
    </Link>
  );
}

/** ตัวเลขแถวรอง — เล็กกว่าการ์ดหลัก ใช้กับเรื่องที่ดูไว้เฉย ๆ ไม่ต้องรีบทำ */
function MiniStat({
  label,
  value,
  hint,
  to,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  hint?: string;
  to: string;
  tone?: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-card border border-line bg-card px-4 py-3 transition-colors hover:bg-paper"
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 font-head text-lg font-semibold ${tone}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Link>
  );
}

export function DashboardPage() {
  const {
    orders,
    customers,
    openOrders,
    boardOrders,
    receivableTotal,
    payableTotal,
    lowStock,
    pendingPos,
    draftDocs,
    leaveToday,
    activeStaff,
    cylinderTotals,
    stockValue,
    monthIn,
    monthOut,
    monthProfit,
    depositHeld,
    orderTotal,
    customerName,
    staffName,
  } = useDerived();

  const hasAnything = customers.length > 0 || orders.length > 0;

  return (
    <div className="space-y-5">
      {/* ---- เรื่องที่ต้องลงมือทำ ---- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="งานค้างบนบอร์ด"
          value={`${boardOrders.length} งาน`}
          hint={boardOrders.length ? "ยังไม่ถึงขั้นปิดงาน" : "เคลียร์หมดแล้ว"}
          icon={<ClipboardList size={17} />}
          tone={boardOrders.length ? "warn" : "ok"}
          to="/board"
        />
        <StatCard
          label="ลูกหนี้ค้างรับ"
          value={`${fmtBaht(receivableTotal)} บาท`}
          hint={receivableTotal > 0 ? "ยังเก็บเงินไม่ครบ" : "เก็บครบหมดแล้ว"}
          icon={<Wallet size={17} />}
          tone={receivableTotal > 0 ? "danger" : "ok"}
          to="/money"
        />
        <StatCard
          label="เจ้าหนี้ค้างจ่าย"
          value={`${fmtBaht(payableTotal)} บาท`}
          hint={payableTotal > 0 ? "ถึงกำหนดต้องจ่าย" : "ไม่มีบิลค้าง"}
          icon={<Scale size={17} />}
          tone={payableTotal > 0 ? "warn" : "ok"}
          to="/money"
        />
        <StatCard
          label="ของใกล้หมด"
          value={`${lowStock.length} รายการ`}
          hint={lowStock.length ? "ควรสั่งเพิ่ม" : "ของพอใช้"}
          icon={<AlertTriangle size={17} />}
          tone={lowStock.length ? "danger" : "ok"}
          to="/products"
        />
        <StatCard
          label="ถังเต็มพร้อมขาย"
          value={`${fmtQty(cylinderTotals.filled)} ใบ`}
          hint={`ถังเปล่ารอบรรจุ ${fmtQty(cylinderTotals.empty)} ใบ`}
          icon={<Cylinder size={17} />}
          tone={cylinderTotals.filled > 0 ? "ok" : "warn"}
          to="/tanks"
        />
        <StatCard
          label="ใบสั่งซื้อค้างรับ"
          value={`${pendingPos.length} ใบ`}
          hint={pendingPos.length ? "สั่งแล้วของยังไม่มา" : "รับของครบแล้ว"}
          icon={<Truck size={17} />}
          tone={pendingPos.length ? "warn" : "ok"}
          to="/purchases"
        />
        <StatCard
          label="เอกสารค้างส่ง"
          value={`${draftDocs.length} ใบ`}
          hint={draftDocs.length ? "ยังเป็นร่าง ยังไม่ได้ส่ง" : "ส่งครบแล้ว"}
          icon={<FileText size={17} />}
          tone={draftDocs.length ? "warn" : "ok"}
          to="/docs"
        />
        <StatCard
          label="พนักงานลาวันนี้"
          value={`${leaveToday.length} คน`}
          hint={
            leaveToday.length
              ? leaveToday.map((l) => staffName(l.staff_id)).join(", ")
              : `มาครบทั้ง ${activeStaff.length} คน`
          }
          icon={<UserRoundX size={17} />}
          tone={leaveToday.length ? "warn" : "ok"}
          to="/attendance"
        />
      </div>

      {/* ---- ตัวเลขไว้ดูเฉย ๆ ---- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="มูลค่าของในคลัง"
          value={`${fmtBaht(stockValue.total)} บาท`}
          hint={
            stockValue.noCostCount
              ? `ยังไม่ใส่ทุน ${stockValue.noCostCount} รายการ`
              : "คิดจากราคาทุน"
          }
          to="/products"
        />
        <MiniStat
          label="เงินเข้าเดือนนี้"
          value={`${fmtBaht(monthIn)} บาท`}
          tone="text-ok"
          to="/money"
        />
        <MiniStat
          label="เงินออกเดือนนี้"
          value={`${fmtBaht(monthOut)} บาท`}
          tone="text-danger"
          to="/money"
        />
        <MiniStat
          label="กำไรเดือนนี้"
          value={`${fmtBaht(monthProfit)} บาท`}
          hint={`ถังอยู่กับลูกค้า ${fmtQty(cylinderTotals.atCustomer)} ใบ · มัดจำ ${fmtBaht(depositHeld)} บาท`}
          tone={monthProfit >= 0 ? "text-ok" : "text-danger"}
          to="/reports"
        />
      </div>

      <BulkTankStatus />

      {!hasAnything && (
        <Card className="p-8 text-center">
          <Package size={30} className="mx-auto text-muted" />
          <h2 className="mt-3 text-lg">เริ่มต้นใช้งาน</h2>
          <p className="mt-1 text-sm text-muted">
            ยังไม่มีข้อมูลในระบบ — เริ่มจากเพิ่มสินค้าและลูกค้าก่อน
            แล้วค่อยเปิดบิลแรก
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              to="/products"
              className="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-on-accent"
            >
              เพิ่มสินค้า
            </Link>
            <Link
              to="/customers"
              className="rounded-btn border border-line px-4 py-2 text-sm font-medium text-ink"
            >
              เพิ่มลูกค้า
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          title="งานที่ต้องตามวันนี้"
          hint="ออเดอร์ที่ยังไม่ได้ปิดบิล"
          action={
            <Link to="/orders" className="text-sm text-accent hover:underline">
              ดูทั้งหมด
            </Link>
          }
        >
          <DataTable<Order>
            rows={openOrders.slice(0, 6)}
            rowKey={(o) => o.id}
            empty="ไม่มีงานค้าง สบายใจได้"
            columns={[
              {
                header: "วันที่",
                cell: (o) => (
                  <Link
                    to={`/orders/${o.id}`}
                    className="text-ink hover:text-accent hover:underline"
                  >
                    {fmtDate(o.date)}
                  </Link>
                ),
              },
              {
                header: "ลูกค้า",
                cell: (o) =>
                  o.customer_id ? (
                    <Link
                      to={`/customers/${o.customer_id}`}
                      className="text-ink hover:text-accent hover:underline"
                    >
                      {customerName(o.customer_id)}
                    </Link>
                  ) : (
                    <span className="text-muted">ลูกค้าทั่วไป</span>
                  ),
              },
              {
                header: "ขั้นตอน",
                cell: (o) => (
                  <Badge tone={workStageTone(o.work_stage)}>
                    {o.work_stage}
                  </Badge>
                ),
              },
              {
                header: "ยอด",
                align: "right",
                cell: (o) => fmtBaht(orderTotal(o)),
              },
            ]}
          />
        </Section>

        <Section
          title="ของใกล้หมด"
          hint="เหลือน้อยกว่าจุดเตือนที่ตั้งไว้"
          action={
            <Link
              to="/products"
              className="text-sm text-accent hover:underline"
            >
              ดูทั้งหมด
            </Link>
          }
        >
          <DataTable<Product>
            rows={lowStock.slice(0, 6)}
            rowKey={(p) => p.id}
            empty="ของพอใช้ทุกรายการ"
            columns={[
              {
                header: "สินค้า",
                cell: (p) => (
                  <Link
                    to={`/products/${p.id}`}
                    className="text-ink hover:text-accent hover:underline"
                  >
                    {p.name}
                  </Link>
                ),
              },
              {
                header: "เหลือ",
                align: "right",
                cell: (p) => (
                  <span className="text-danger">
                    {fmtQty(Number(p.stock))} {p.unit}
                  </span>
                ),
              },
              {
                header: "จุดเตือน",
                align: "right",
                hideOnMobile: true,
                cell: (p) => fmtQty(Number(p.low_at)),
              },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
