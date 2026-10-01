import type { Ref } from "react";
import { bahtText } from "@/lib/bahtText";
import { fmtBaht, fmtDate, fmtQty } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { Order } from "@/types";

interface Props {
  order: Order;
  ref?: Ref<HTMLDivElement>;
}

/** บรรทัดสินค้าที่คิดราคาสดแล้ว — ครึ่งบน/ครึ่งล่างใช้ชุดเดียวกัน จะได้ไม่มีทางเพี้ยนกัน */
interface Line {
  id: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
}

/**
 * ใบส่งของ + บิล บนกระดาษ A4 แผ่นเดียว — ครึ่งบนครึ่งล่างอย่างละใบ (ขนาด A5) ตัดแบ่งทีหลังได้
 *
 * ⭐ ความสูงตั้งไว้ 268mm เพราะ `@page { margin: 14mm }` เหลือพื้นที่พิมพ์จริงราว 269mm
 *    ถ้าตั้งเต็ม 297mm จะล้นไปขึ้นหน้าสอง
 */
export function OrderPairPrintTemplate({ order, ref }: Props) {
  const { productById, customerById, priceFor, orderTotal, orderOutstanding } =
    useDerived();
  const settings = useAppStore((s) => s.settings);

  const customer = customerById(order.customer_id);
  const total = orderTotal(order);
  const paid = Number(order.paid_cash) + Number(order.paid_transfer);
  const outstanding = orderOutstanding(order);

  const lines: Line[] = order.items.map((it) => {
    const product = productById(it.product_id);
    const price = priceFor(it.product_id, order.customer_id);
    const qty = Number(it.qty);
    return {
      id: it.id,
      name: product?.name ?? "สินค้าถูกลบไปแล้ว",
      unit: product?.unit ?? "",
      qty,
      price,
      amount: price * qty,
    };
  });

  const common = {
    order,
    lines,
    total,
    paid,
    outstanding,
    shopName: settings?.shop_name ?? "JAMAREE GAS",
    shopAddress: settings?.address ?? null,
    shopPhone: settings?.phone ?? null,
    shopTaxId: settings?.tax_id ?? null,
    branch: settings?.branch ?? null,
    customerName: customer?.name ?? "ลูกค้าทั่วไป",
    customerAddress: customer?.address ?? null,
    customerPhone: customer?.phone ?? null,
  };

  return (
    <div
      ref={ref}
      className={[
        "print-area mx-auto flex w-[182mm] h-[268mm] flex-col",
        "bg-white text-[11px] leading-snug text-black",
        "print:w-full",
      ].join(" ")}
    >
      <Half
        {...common}
        title="ใบส่งของ"
        signatures={["ผู้ส่งของ", "ผู้รับสินค้า"]}
      />

      {/* เส้นสำหรับตัดแบ่งครึ่งกระดาษ */}
      <div className="relative shrink-0 py-2">
        <div className="border-t border-dashed border-black" />
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 bg-white px-2 text-[9px]">
          ✂ ตัดตามเส้น
        </span>
      </div>

      <Half
        {...common}
        title={outstanding > 0 ? "บิลเงินเชื่อ" : "ใบเสร็จรับเงิน"}
        signatures={["ผู้รับเงิน", "ผู้จ่ายเงิน"]}
        showMoneyWords
      />
    </div>
  );
}

interface HalfProps {
  order: Order;
  lines: Line[];
  total: number;
  paid: number;
  outstanding: number;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  shopTaxId: string | null;
  branch: string | null;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  title: string;
  signatures: ReadonlyArray<string>;
  /** ใบที่เป็นบิลเงิน ให้มีตัวหนังสือกำกับจำนวนเงินด้วย */
  showMoneyWords?: boolean;
}

/** ครึ่งหนึ่งของกระดาษ = เอกสาร A5 หนึ่งใบ */
function Half({
  order,
  lines,
  total,
  paid,
  outstanding,
  shopName,
  shopAddress,
  shopPhone,
  shopTaxId,
  branch,
  customerName,
  customerAddress,
  customerPhone,
  title,
  signatures,
  showMoneyWords,
}: HalfProps) {
  const heading = order.voided ? `${title} (ยกเลิกแล้ว)` : title;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-black pb-1.5">
        <div className="min-w-0">
          <p className="text-[14px] font-bold">{shopName}</p>
          {shopAddress && (
            <p className="whitespace-pre-line text-[10px]">{shopAddress}</p>
          )}
          <p className="text-[10px]">
            {shopTaxId && `เลขประจำตัวผู้เสียภาษี ${shopTaxId}`}
            {shopTaxId && branch && ` (${branch})`}
            {shopPhone && `${shopTaxId ? " · " : ""}โทร. ${shopPhone}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[14px] font-bold">{heading}</p>
          <p>เลขที่ {order.id.slice(0, 8).toUpperCase()}</p>
          <p>วันที่ {fmtDate(order.date)}</p>
        </div>
      </header>

      <p className="border-b border-black py-1">
        <span className="font-bold">ลูกค้า</span> {customerName}
        {customerPhone && ` · โทร. ${customerPhone}`}
        {customerAddress && ` · ${customerAddress}`}
      </p>

      <div className="min-h-0 flex-1 overflow-hidden pt-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="w-6 py-0.5">#</th>
              <th className="py-0.5">รายการ</th>
              <th className="w-16 py-0.5 text-right">จำนวน</th>
              <th className="w-20 py-0.5 text-right">ราคา/หน่วย</th>
              <th className="w-20 py-0.5 text-right">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="border-b border-gray-400 align-top">
                <td className="py-0.5">{i + 1}</td>
                <td className="py-0.5">{l.name}</td>
                <td className="py-0.5 text-right">
                  {fmtQty(l.qty)} {l.unit}
                </td>
                <td className="py-0.5 text-right">{fmtBaht(l.price)}</td>
                <td className="py-0.5 text-right">{fmtBaht(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-1 flex items-end justify-between gap-4">
        <div className="text-[10px]">
          {showMoneyWords && <p className="font-bold">({bahtText(total)})</p>}
          {order.voided && (
            <p className="font-bold">บิลนี้ถูกยกเลิกแล้ว ใช้อ้างอิงไม่ได้</p>
          )}
        </div>
        <div className="w-44 shrink-0">
          <div className="flex justify-between border-t border-black pt-0.5 font-bold">
            <span>รวมทั้งสิ้น</span>
            <span>{fmtBaht(total)}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between">
              <span>รับชำระแล้ว</span>
              <span>{fmtBaht(paid)}</span>
            </div>
          )}
          {outstanding > 0 && (
            <div className="flex justify-between font-bold">
              <span>ค้างชำระ</span>
              <span>{fmtBaht(outstanding)}</span>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-5 flex shrink-0 justify-between gap-6">
        {signatures.map((label) => (
          <div key={label} className="flex-1 text-center">
            <p className="border-t border-black pt-0.5 text-[10px]">{label}</p>
          </div>
        ))}
      </footer>
    </section>
  );
}
