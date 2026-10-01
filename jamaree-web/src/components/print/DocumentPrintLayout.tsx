import type { ReactNode, Ref } from "react";
import { fmtDate } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

/** คู่ค้าที่อยู่หัวเอกสาร — ลูกค้าสำหรับใบขาย ผู้ขายสำหรับใบสั่งซื้อ */
export interface PrintParty {
  heading: string;
  name: string;
  address?: string | null;
  taxId?: string | null;
  phone?: string | null;
}

interface Props {
  /** ชื่อเอกสาร เช่น "ใบเสร็จรับเงิน" "ใบสั่งซื้อ" */
  title: string;
  /** ข้อความใต้ชื่อเอกสาร เช่น "ต้นฉบับ" / "สำเนา" */
  subtitle?: string;
  number?: string | null;
  date?: string | null;
  party?: PrintParty | null;
  /** ชื่อใต้เส้นเซ็น เช่น ["ผู้รับเงิน", "ผู้มีอำนาจลงนาม"] — ไม่ส่ง = ไม่มีช่องเซ็น */
  signatures?: ReadonlyArray<string>;
  note?: string | null;
  /** ข้อความท้ายกระดาษ เช่น หมายเหตุตามมาตรา 78 */
  footnote?: string | null;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * กระดาษ A4 มาตรฐานของร้าน — ใบขาย/ใบสั่งซื้อ/สรุปลูกค้า ใช้ตัวนี้ตัวเดียวกันหมด
 *
 * ⭐ คลาส `print-area` จำเป็น: ตอนสั่งพิมพ์ทั้งหน้า CSS กลางจะซ่อนทุกอย่างแล้วโชว์เฉพาะกล่องนี้
 *    ขนาด 210×297mm มีไว้ให้ดูตัวอย่างบนจอ — เวลาพิมพ์จริงปล่อยให้ @page คุมขอบกระดาษแทน
 */
export function DocumentPrintLayout({
  title,
  subtitle,
  number,
  date,
  party,
  signatures,
  note,
  footnote,
  ref,
  children,
}: Props) {
  const settings = useAppStore((s) => s.settings);

  return (
    <div
      ref={ref}
      className={[
        "print-area mx-auto flex w-[210mm] min-h-[297mm] flex-col",
        "bg-white p-[14mm] text-[13px] leading-relaxed text-black",
        "print:w-full print:min-h-0 print:p-0",
      ].join(" ")}
    >
      <header className="flex justify-between gap-6 border-b border-black pb-3">
        <div>
          <p className="text-lg font-bold">
            {settings?.shop_name ?? "JAMAREE GAS"}
          </p>
          {settings?.address && (
            <p className="whitespace-pre-line">{settings.address}</p>
          )}
          {settings?.tax_id && (
            <p>
              เลขประจำตัวผู้เสียภาษี {settings.tax_id}
              {settings.branch ? ` (${settings.branch})` : ""}
            </p>
          )}
          {settings?.phone && <p>โทร. {settings.phone}</p>}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold">{title}</p>
          {subtitle && <p className="text-xs">{subtitle}</p>}
          {number && <p>เลขที่ {number}</p>}
          {date && <p>วันที่ {fmtDate(date)}</p>}
        </div>
      </header>

      {party && (
        <section className="mt-3 border-b border-black pb-3">
          <p className="font-bold">{party.heading}</p>
          <p>{party.name}</p>
          {party.address && (
            <p className="whitespace-pre-line">{party.address}</p>
          )}
          {party.taxId && <p>เลขประจำตัวผู้เสียภาษี {party.taxId}</p>}
          {party.phone && <p>โทร. {party.phone}</p>}
        </section>
      )}

      <main className="mt-3 flex-1">{children}</main>

      {note && <p className="mt-3 whitespace-pre-line">{note}</p>}

      {signatures && signatures.length > 0 && (
        <footer className="mt-12 flex justify-between gap-8">
          {signatures.map((label) => (
            <div key={label} className="flex-1 text-center">
              <p className="border-t border-black pt-1">{label}</p>
            </div>
          ))}
        </footer>
      )}

      {footnote && <p className="mt-6 text-xs">{footnote}</p>}
    </div>
  );
}
