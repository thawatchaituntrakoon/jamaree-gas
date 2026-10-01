import type { Ref } from "react";
import { bahtText } from "@/lib/bahtText";
import { VAT_RATE, fmtBaht, fmtQty } from "@/lib/constants";
import { docPrintTitle } from "@/lib/docMath";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { TradeDocument } from "@/types";
import { DocumentPrintLayout } from "./DocumentPrintLayout";

interface Props {
  doc: TradeDocument;
  ref?: Ref<HTMLDivElement>;
}

/** ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จแบบ A4 — ตัวเลขทุกตัวเป็นภาพนิ่งที่แช่ไว้ตอนออกเอกสาร */
export function DocPrintTemplate({ doc, ref }: Props) {
  const { customerById } = useDerived();
  const settings = useAppStore((s) => s.settings);

  const customer = customerById(doc.customer_id);
  const amount = Number(doc.amount);
  const vatAmt = Number(doc.vat_amt ?? 0);
  const baseAmt = Number(doc.base_amt ?? amount);
  const whtAmt = Number(doc.wht_amt ?? 0);
  const transferAmt = Number(doc.transfer_amt ?? amount);

  return (
    <DocumentPrintLayout
      ref={ref}
      title={docPrintTitle(doc, settings)}
      number={doc.number}
      date={doc.date}
      party={{
        heading: "ลูกค้า",
        name: customer?.name ?? "—",
        address: customer?.address,
        taxId: customer?.tax_id,
        phone: customer?.phone,
      }}
      note={doc.note}
      signatures={["ผู้รับเงิน", "ผู้มีอำนาจลงนาม"]}
      footnote={
        doc.type === "ใบเสร็จ" && settings?.vat_registered
          ? "เอกสารออกเป็นชุด — ต้นฉบับสำหรับผู้ซื้อ สำเนาสำหรับผู้ขาย"
          : null
      }
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
          {doc.items.map((it, i) => (
            <tr key={i} className="border-b border-gray-400 align-top">
              <td className="py-1">{i + 1}</td>
              <td className="py-1">{it.name}</td>
              <td className="py-1 text-right">{fmtQty(Number(it.qty))}</td>
              <td className="py-1 text-right">{fmtBaht(Number(it.price))}</td>
              <td className="py-1 text-right">
                {fmtBaht(Number(it.qty) * Number(it.price))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64">
        {doc.vat_rate ? (
          <>
            <div className="flex justify-between">
              <span>มูลค่าสินค้า/บริการ</span>
              <span>{fmtBaht(baseAmt)}</span>
            </div>
            <div className="flex justify-between">
              <span>ภาษีมูลค่าเพิ่ม {doc.vat_rate ?? VAT_RATE}%</span>
              <span>{fmtBaht(vatAmt)}</span>
            </div>
          </>
        ) : null}
        <div className="flex justify-between border-t border-black pt-1 font-bold">
          <span>รวมทั้งสิ้น</span>
          <span>{fmtBaht(amount)}</span>
        </div>
        {whtAmt > 0 && (
          <>
            <div className="flex justify-between">
              <span>หัก ณ ที่จ่าย {doc.wht_rate}%</span>
              <span>-{fmtBaht(whtAmt)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>ยอดชำระจริง</span>
              <span>{fmtBaht(transferAmt)}</span>
            </div>
          </>
        )}
      </div>

      <p className="mt-2 text-center font-bold">({bahtText(amount)})</p>
    </DocumentPrintLayout>
  );
}
