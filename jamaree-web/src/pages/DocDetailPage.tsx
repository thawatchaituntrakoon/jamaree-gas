import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Printer,
  Receipt,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { bahtText } from "@/lib/bahtText";
import {
  VAT_RATE,
  docStatusTone,
  fmtBaht,
  fmtDate,
  fmtQty,
} from "@/lib/constants";
import {
  docChain,
  docPrintTitle,
  docTypeTone,
  taxInvoiceProblems,
} from "@/lib/docMath";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { TradeDocument } from "@/types";

function Chain({
  chain,
  currentId,
}: {
  chain: TradeDocument[];
  currentId: string;
}) {
  if (chain.length < 2) return null;
  return (
    <Card className="flex flex-wrap items-center gap-1.5 px-4 py-3">
      {chain.map((d, i) => (
        <span key={d.id} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} className="text-muted" />}
          {d.id === currentId ? (
            <span className="rounded-btn bg-accent-soft px-2 py-1 text-sm font-medium text-accent">
              {d.number}
            </span>
          ) : (
            <Link
              to={`/docs/${d.id}`}
              className="rounded-btn px-2 py-1 text-sm text-muted hover:bg-paper hover:text-ink"
            >
              {d.number}
            </Link>
          )}
        </span>
      ))}
    </Card>
  );
}

export function DocDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { customerById } = useDerived();
  const documents = useAppStore((s) => s.documents);
  const settings = useAppStore((s) => s.settings);
  const markDocSent = useAppStore((s) => s.markDocSent);
  const convertDocument = useAppStore((s) => s.convertDocument);
  const [busy, setBusy] = useState(false);

  const doc = documents.find((d) => d.id === id);

  if (!doc) {
    return (
      <>
        <PageHeader title="ไม่พบเอกสาร" backTo="/docs" backLabel="เอกสาร" />
        <Card className="p-6 text-sm text-muted">
          เอกสารนี้อาจถูกลบไปแล้ว หรือยังโหลดไม่เสร็จ
        </Card>
      </>
    );
  }

  const customer = customerById(doc.customer_id);
  const chain = docChain(doc.id, documents);
  const problems = taxInvoiceProblems(doc, customer, settings);
  const canPrint = problems.length === 0;

  const amount = Number(doc.amount);
  const vatAmt = Number(doc.vat_amt ?? 0);
  const baseAmt = Number(doc.base_amt ?? amount);
  const whtAmt = Number(doc.wht_amt ?? 0);
  const transferAmt = Number(doc.transfer_amt ?? amount);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      return await fn();
    } catch {
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onConvert(to: "ใบแจ้งหนี้" | "ใบเสร็จ") {
    const next = await run(() => convertDocument(id, to));
    if (next) navigate(`/docs/${(next as TradeDocument).id}`);
  }

  return (
    <>
      {/* ---------- หน้าจอ ---------- */}
      <div className="space-y-4 print:hidden">
        <PageHeader
          title={doc.number}
          backTo="/docs"
          backLabel="เอกสาร"
          hint={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={docTypeTone(doc.type)}>{doc.type}</Badge>
              <Badge tone={docStatusTone(doc.status)}>{doc.status}</Badge>
              <span className="text-muted">{fmtDate(doc.date)}</span>
            </span>
          }
          action={
            <div className="flex flex-wrap gap-2">
              {doc.status === "ร่าง" && (
                <Button
                  variant="secondary"
                  icon={<Send size={16} />}
                  disabled={busy}
                  onClick={() => run(() => markDocSent(id))}
                >
                  ส่งให้ลูกค้าแล้ว
                </Button>
              )}
              {doc.type === "ใบเสนอราคา" && (
                <Button
                  variant="secondary"
                  icon={<ArrowRight size={16} />}
                  disabled={busy}
                  onClick={() => onConvert("ใบแจ้งหนี้")}
                >
                  แปลงเป็นใบแจ้งหนี้
                </Button>
              )}
              {doc.type === "ใบแจ้งหนี้" && doc.status !== "ชำระแล้ว" && (
                <Button
                  variant="ok"
                  icon={<Receipt size={16} />}
                  disabled={busy}
                  onClick={() => onConvert("ใบเสร็จ")}
                >
                  รับชำระ & ออกใบเสร็จ
                </Button>
              )}
              <Button
                icon={<Printer size={16} />}
                disabled={!canPrint}
                onClick={() => window.print()}
              >
                พิมพ์
              </Button>
            </div>
          }
        />

        <Chain chain={chain} currentId={doc.id} />

        {problems.length > 0 && (
          <Card className="border-danger/30 bg-danger-soft p-4">
            <p className="flex items-center gap-2 font-medium text-danger">
              <TriangleAlert size={16} />
              ยังพิมพ์ใบกำกับภาษีไม่ได้
            </p>
            <ul className="mt-2 ml-6 list-disc space-y-0.5 text-sm text-ink">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link
              to={`/customers/${doc.customer_id}`}
              className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
            >
              ไปแก้ข้อมูลลูกค้า →
            </Link>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="ลูกค้า" className="lg:col-span-1">
            <div className="space-y-1.5 p-4 text-sm md:p-5">
              <Link
                to={`/customers/${doc.customer_id}`}
                className="font-medium text-ink hover:text-accent hover:underline"
              >
                {customer?.name ?? "—"}
              </Link>
              {customer?.phone && (
                <p className="text-muted">{customer.phone}</p>
              )}
              {customer?.address && (
                <p className="whitespace-pre-line text-muted">
                  {customer.address}
                </p>
              )}
              {customer?.tax_id && (
                <p className="text-muted">เลขภาษี {customer.tax_id}</p>
              )}
              {doc.note && (
                <p className="mt-3 border-t border-line pt-3 whitespace-pre-line text-muted">
                  {doc.note}
                </p>
              )}
            </div>
          </Section>

          <Section title="รายการ" className="lg:col-span-2">
            <div className="p-4 md:p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="pb-2 font-medium">รายการ</th>
                    <th className="pb-2 text-right font-medium">จำนวน</th>
                    <th className="pb-2 text-right font-medium">ราคา</th>
                    <th className="pb-2 text-right font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((it, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="py-2 text-ink">{it.name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtQty(it.qty)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtBaht(it.price)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtBaht(it.qty * it.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
                {doc.vat_rate ? (
                  <>
                    <div className="flex justify-between text-muted">
                      <span>ก่อน VAT</span>
                      <span className="tabular-nums">{fmtBaht(baseAmt)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>VAT {doc.vat_rate}%</span>
                      <span className="tabular-nums">{fmtBaht(vatAmt)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between border-t border-line pt-1 font-medium text-ink">
                  <span>ยอดรวม</span>
                  <span className="tabular-nums">{fmtBaht(amount)}</span>
                </div>
                {whtAmt > 0 && (
                  <>
                    <div className="flex justify-between text-warn">
                      <span>หัก ณ ที่จ่าย {doc.wht_rate}%</span>
                      <span className="tabular-nums">-{fmtBaht(whtAmt)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-ink">
                      <span>ยอดโอนจริง</span>
                      <span className="tabular-nums">
                        {fmtBaht(transferAmt)}
                      </span>
                    </div>
                  </>
                )}
                <p className="pt-1 text-right text-xs text-muted">
                  ({bahtText(amount)})
                </p>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* ---------- เวอร์ชันพิมพ์ ---------- */}
      <div className="print-area hidden print:block">
        <div className="flex justify-between gap-6 border-b border-black pb-3">
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
          <div className="text-right">
            <p className="text-lg font-bold">{docPrintTitle(doc, settings)}</p>
            <p>เลขที่ {doc.number}</p>
            <p>วันที่ {fmtDate(doc.date)}</p>
          </div>
        </div>

        <div className="mt-3 border-b border-black pb-3">
          <p className="font-bold">ลูกค้า</p>
          <p>{customer?.name ?? "—"}</p>
          {customer?.address && (
            <p className="whitespace-pre-line">{customer.address}</p>
          )}
          {customer?.tax_id && <p>เลขประจำตัวผู้เสียภาษี {customer.tax_id}</p>}
          {customer?.phone && <p>โทร. {customer.phone}</p>}
        </div>

        <table className="mt-3 w-full">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1">รายการ</th>
              <th className="py-1 text-right">จำนวน</th>
              <th className="py-1 text-right">ราคา/หน่วย</th>
              <th className="py-1 text-right">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i} className="border-b border-gray-400">
                <td className="py-1">{it.name}</td>
                <td className="py-1 text-right">{fmtQty(it.qty)}</td>
                <td className="py-1 text-right">{fmtBaht(it.price)}</td>
                <td className="py-1 text-right">
                  {fmtBaht(it.qty * it.price)}
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

        {doc.note && <p className="mt-3 whitespace-pre-line">{doc.note}</p>}

        <div className="mt-12 flex justify-between gap-8">
          <div className="flex-1 text-center">
            <p className="border-t border-black pt-1">ผู้รับเงิน</p>
          </div>
          <div className="flex-1 text-center">
            <p className="border-t border-black pt-1">ผู้มีอำนาจลงนาม</p>
          </div>
        </div>

        {doc.type === "ใบเสร็จ" && settings?.vat_registered && (
          <p className="mt-6 text-xs">
            เอกสารออกเป็นชุด — ต้นฉบับสำหรับผู้ซื้อ สำเนาสำหรับผู้ขาย
          </p>
        )}
      </div>
    </>
  );
}
