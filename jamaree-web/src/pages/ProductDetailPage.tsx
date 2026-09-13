import { Link, useParams } from "react-router-dom";
import { Card, Section } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { GAS_FILL_KINDS, fmtBaht, fmtDate, fmtQty } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { InventoryMove, MoveType } from "@/types";

function moveTone(type: MoveType) {
  return type === "รับเข้า" || type === "ปรับเพิ่ม" ? "ok" : "warn";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value || "—"}</p>
    </div>
  );
}

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { productById } = useDerived();
  const moves = useAppStore((s) => s.moves);
  const priceTiers = useAppStore((s) => s.priceTiers);

  const product = productById(id);

  if (!product) {
    return (
      <>
        <PageHeader
          title="ไม่พบสินค้า"
          backTo="/products"
          backLabel="กลับหน้าสินค้า"
        />
        <Card className="p-8 text-center text-sm text-muted">
          สินค้ารายการนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง
        </Card>
      </>
    );
  }

  const myMoves = moves.filter((m) => m.product_id === product.id);
  const usesRaw = GAS_FILL_KINDS.includes(product.kind);
  const tierRows = priceTiers
    .map((t) => ({ tier: t, price: product.tier_prices?.[t.id] }))
    .filter((r) => r.price != null && String(r.price) !== "");

  return (
    <div className="space-y-4">
      <PageHeader
        title={product.name}
        hint={[product.kind || "สินค้าทั่วไป", product.size, product.sku]
          .filter(Boolean)
          .join(" · ")}
        backTo="/products"
        backLabel="กลับหน้าสินค้า"
        action={
          usesRaw ? (
            <Badge tone="info">ขายแล้วตัดจากถังเก็บใหญ่</Badge>
          ) : product.kind === "บริการ" ? (
            <Badge tone="muted">ไม่นับสต๊อก</Badge>
          ) : (
            <div className="rounded-card bg-paper px-4 py-2 text-right">
              <p className="text-xs text-muted">คงเหลือ</p>
              <p className="font-head text-lg font-semibold text-ink">
                {fmtQty(Number(product.stock))} {product.unit}
              </p>
            </div>
          )
        }
      />

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label="ราคาขาย"
            value={`${fmtBaht(Number(product.price))} บาท`}
          />
          <Info
            label="ต้นทุน"
            value={
              product.cost == null ? "" : `${fmtBaht(Number(product.cost))} บาท`
            }
          />
          <Info
            label="จุดเตือน"
            value={
              Number(product.low_at) > 0
                ? `${fmtQty(Number(product.low_at))} ${product.unit}`
                : ""
            }
          />
          <Info
            label="กิโลแก๊สต่อถัง"
            value={
              product.fill_kg ? `${fmtQty(Number(product.fill_kg))} กก.` : ""
            }
          />
        </div>
      </Card>

      {tierRows.length > 0 && (
        <Section
          title="ราคาตามชุดลูกค้า"
          hint="ชุดที่ไม่ได้ตั้งไว้จะใช้ราคาปกติ"
        >
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {tierRows.map(({ tier, price }) => (
              <div
                key={tier.id}
                className="flex items-center justify-between rounded-card border border-line px-3.5 py-2.5 text-sm"
              >
                <span className="text-muted">{tier.name}</span>
                <span className="font-medium text-ink">
                  {fmtBaht(Number(price))}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="ประวัติการเคลื่อนไหว"
        hint="ทุกครั้งที่สต๊อกขยับจะถูกบันทึกไว้ที่นี่"
      >
        <DataTable<InventoryMove>
          rows={myMoves}
          rowKey={(m) => m.id}
          empty="ยังไม่มีการเคลื่อนไหวของสินค้านี้"
          columns={[
            { header: "วันที่", cell: (m) => fmtDate(m.date) },
            {
              header: "รายการ",
              cell: (m) => <Badge tone={moveTone(m.type)}>{m.type}</Badge>,
            },
            {
              header: "จำนวน",
              align: "right",
              cell: (m) => `${fmtQty(Number(m.qty))} ${product.unit}`,
            },
            {
              header: "โน้ต",
              hideOnMobile: true,
              cell: (m) =>
                m.ref_type === "order" && m.ref_id ? (
                  <Link
                    to={`/orders/${m.ref_id}`}
                    className="text-ink hover:text-accent hover:underline"
                  >
                    {m.note || "เปิดบิลที่เกี่ยวข้อง"}
                  </Link>
                ) : (
                  m.note || "—"
                ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
