import { Link, useParams } from "react-router-dom";
import { Cylinder } from "lucide-react";
import { Card, Section } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBaht, fmtDate, fmtQty, workStageTone } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { Order } from "@/types";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value || "—"}</p>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { customerById, orders, orderTotal, customerDebt, custodyBalance } =
    useDerived();
  const priceTiers = useAppStore((s) => s.priceTiers);

  const customer = customerById(id);

  if (!customer) {
    return (
      <>
        <PageHeader
          title="ไม่พบลูกค้า"
          backTo="/customers"
          backLabel="กลับหน้าลูกค้า"
        />
        <Card className="p-8 text-center text-sm text-muted">
          ลูกค้ารายนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง
        </Card>
      </>
    );
  }

  const myOrders = orders.filter((o) => o.customer_id === customer.id);
  const debt = customerDebt(customer.id);
  const cylinders = custodyBalance(customer.id);
  const tierName =
    priceTiers.find((t) => t.id === customer.price_tier_id)?.name ?? "ราคาปกติ";

  return (
    <div className="space-y-4">
      <PageHeader
        title={customer.name}
        hint={customer.phone ? `โทร ${customer.phone}` : "ยังไม่ได้ใส่เบอร์โทร"}
        backTo="/customers"
        backLabel="กลับหน้าลูกค้า"
        action={
          debt > 0 ? (
            <div className="rounded-card bg-danger-soft px-4 py-2 text-right">
              <p className="text-xs text-danger">ค้างจ่าย</p>
              <p className="font-head text-lg font-semibold text-danger">
                {fmtBaht(debt)}
              </p>
            </div>
          ) : (
            <Badge tone="ok">ไม่มียอดค้าง</Badge>
          )
        }
      />

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="ประเภท" value={customer.person_type} />
          <Info label="ชุดราคา" value={tierName} />
          <Info label="เลขผู้เสียภาษี" value={customer.tax_id ?? ""} />
          <Info label="ลูกค้าตั้งแต่" value={fmtDate(customer.created_at)} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Info label="ที่อยู่" value={customer.address ?? ""} />
          </div>
          {customer.note && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Info label="โน้ต" value={customer.note} />
            </div>
          )}
        </div>
      </Card>

      <Section
        title="ถังที่อยู่กับลูกค้า"
        hint="นับจากประวัติยืม/คืน และฝาก/ถอนฝาก"
      >
        {cylinders.length ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {cylinders.map((c) => (
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
            ไม่มีถังค้างอยู่กับลูกค้ารายนี้
          </p>
        )}
      </Section>

      <Section title="ประวัติการซื้อ" hint={`ทั้งหมด ${myOrders.length} บิล`}>
        <DataTable<Order>
          rows={myOrders}
          rowKey={(o) => o.id}
          empty="ลูกค้ารายนี้ยังไม่เคยซื้อ"
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
              header: "รายการ",
              hideOnMobile: true,
              cell: (o) => `${o.items.length} รายการ`,
            },
            {
              header: "สถานะ",
              cell: (o) =>
                o.voided ? (
                  <Badge tone="danger">ยกเลิกแล้ว</Badge>
                ) : (
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
    </div>
  );
}
