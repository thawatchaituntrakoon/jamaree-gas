import type { Ref } from "react";
import { bahtText } from "@/lib/bahtText";
import { fmtBaht, fmtDate, fmtQty } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import type { PurchaseOrder } from "@/types";
import { DocumentPrintLayout } from "./DocumentPrintLayout";

interface Props {
  po: PurchaseOrder;
  ref?: Ref<HTMLDivElement>;
}

/** ใบสั่งซื้อแบบ A4 — รับของแล้วพิมพ์ยอดที่ได้จริง ไม่ใช่ยอดที่สั่ง */
export function POPrintTemplate({ po, ref }: Props) {
  const { productById, vendorById } = useDerived();

  const vendor = vendorById(po.vendor_id);
  const received = po.status === "รับแล้ว" && !!po.received_items?.length;
  const items = received ? po.received_items! : po.items;
  const total = items.reduce(
    (s, it) => s + Number(it.qty) * Number(it.price),
    0,
  );

  return (
    <DocumentPrintLayout
      ref={ref}
      title="ใบสั่งซื้อ"
      subtitle={
        po.status === "ยกเลิก"
          ? "ใบสั่งซื้อนี้ถูกยกเลิกแล้ว"
          : received
            ? "แสดงจำนวนที่รับจริง"
            : undefined
      }
      number={po.number}
      date={po.date}
      party={{
        heading: "ผู้ขาย",
        name: vendor?.name ?? "—",
        address: vendor?.address,
        taxId: vendor?.tax_id,
        phone: vendor?.phone,
      }}
      note={po.note}
      signatures={["ผู้สั่งซื้อ", "ผู้อนุมัติ", "ผู้ส่งของ"]}
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
          {items.map((it, i) => {
            const product = it.product_id ? productById(it.product_id) : null;
            return (
              <tr key={i} className="border-b border-gray-400 align-top">
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{product?.name ?? it.name}</td>
                <td className="py-1 text-right">
                  {fmtQty(Number(it.qty))} {product?.unit ?? ""}
                </td>
                <td className="py-1 text-right">{fmtBaht(it.price)}</td>
                <td className="py-1 text-right">
                  {fmtBaht(Number(it.qty) * Number(it.price))}
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
        {po.received_at && (
          <div className="flex justify-between">
            <span>รับของวันที่</span>
            <span>{fmtDate(po.received_at)}</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-center font-bold">({bahtText(total)})</p>
    </DocumentPrintLayout>
  );
}
