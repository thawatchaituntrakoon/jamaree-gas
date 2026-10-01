import type { Ref } from "react";
import { bahtText } from "@/lib/bahtText";
import { fmtBaht, fmtQty } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import type { Order } from "@/types";
import { DocumentPrintLayout } from "./DocumentPrintLayout";

interface Props {
  order: Order;
  /** หัวเอกสาร — บิลที่เก็บเงินครบแล้วมักออกเป็น "ใบเสร็จรับเงิน" */
  title?: string;
  ref?: Ref<HTMLDivElement>;
}

/** ใบขายของลูกค้าแบบ A4 — ราคาคิดสดจากชุดราคาเหมือนหน้าจอ ไม่ได้แช่ไว้ */
export function OrderPrintTemplate({ order, title, ref }: Props) {
  const { productById, customerById, priceFor, orderTotal, orderOutstanding } =
    useDerived();

  const customer = customerById(order.customer_id);
  const total = orderTotal(order);
  const paid = Number(order.paid_cash) + Number(order.paid_transfer);
  const outstanding = orderOutstanding(order);
  // บิลยกเลิกแล้วห้ามออกมาหน้าตาเหมือนใบเสร็จ เดี๋ยวเอาไปใช้อ้างเก็บเงินได้
  const docTitle = order.voided
    ? "สำเนาบิลที่ยกเลิกแล้ว"
    : (title ?? (outstanding > 0 ? "ใบส่งของ" : "ใบเสร็จรับเงิน"));

  return (
    <DocumentPrintLayout
      ref={ref}
      title={docTitle}
      subtitle={order.voided ? "บิลนี้ถูกยกเลิกแล้ว" : undefined}
      number={order.id.slice(0, 8).toUpperCase()}
      date={order.date}
      party={{
        heading: "ลูกค้า",
        name: customer?.name ?? "ลูกค้าทั่วไป",
        address: customer?.address,
        taxId: customer?.tax_id,
        phone: customer?.phone,
      }}
      signatures={["ผู้รับเงิน", "ผู้ส่งของ", "ผู้รับสินค้า"]}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-8 py-1">#</th>
            <th className="py-1">รายการ</th>
            <th className="py-1 text-right">จำนวน</th>
            <th className="py-1 text-right">ราคา/หน่วย</th>
            <th className="py-1 text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => {
            const product = productById(it.product_id);
            const price = priceFor(it.product_id, order.customer_id);
            return (
              <tr key={it.id} className="border-b border-gray-400 align-top">
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{product?.name ?? "สินค้าถูกลบไปแล้ว"}</td>
                <td className="py-1 text-right">
                  {fmtQty(Number(it.qty))} {product?.unit ?? ""}
                </td>
                <td className="py-1 text-right">{fmtBaht(price)}</td>
                <td className="py-1 text-right">
                  {fmtBaht(price * Number(it.qty))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64">
        <div className="flex justify-between border-t border-black pt-1 font-bold">
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

      <p className="mt-2 text-center font-bold">({bahtText(total)})</p>
    </DocumentPrintLayout>
  );
}
