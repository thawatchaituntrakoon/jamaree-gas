import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Chart } from "react-google-charts";
import { Package, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBaht } from "@/lib/constants";
import { useChartTheme } from "@/lib/chartTheme";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";

/** เดือนปัจจุบันในรูปแบบ YYYY-MM */
function thisPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** '2026-09' → 'กันยายน 2569' */
function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const name = new Date(y, m - 1, 1).toLocaleDateString("th-TH", {
    month: "long",
  });
  return `${name} ${y + 543}`;
}

/** แถวตัวเลขในตารางสรุป */
function Row({
  label,
  value,
  hint,
  tone = "text-ink",
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-4 py-2.5 md:px-5 ${
        strong ? "border-t border-line bg-paper" : ""
      }`}
    >
      <div>
        <p
          className={`text-sm ${strong ? "font-medium text-ink" : "text-ink"}`}
        >
          {label}
        </p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <p
        className={`shrink-0 tabular-nums ${tone} ${
          strong ? "font-head text-lg font-semibold" : "text-sm"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ReportsPage() {
  const { transactions, stockValue, depositHeld } = useDerived();
  const payrolls = useAppStore((s) => s.payrolls);
  const theme = useChartTheme();

  const [period, setPeriod] = useState(thisPeriod());
  const [cashOnly, setCashOnly] = useState(false);

  const data = useMemo(() => {
    const inMonth = transactions.filter((t) => {
      if (!t.date.startsWith(period)) return false;
      // นับเฉพาะเงินที่เข้า-ออกจริงแล้ว = ตัดบิลที่ยังค้างออก
      return cashOnly ? !t.unpaid : true;
    });

    const byCategory = (type: "เข้า" | "ออก") => {
      const map = new Map<string, number>();
      for (const t of inMonth) {
        if (t.type !== type) continue;
        const key = t.category?.trim() || "ไม่ระบุหมวด";
        map.set(key, (map.get(key) ?? 0) + (Number(t.amount) || 0));
      }
      return [...map.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
    };

    const income = byCategory("เข้า");
    const expense = byCategory("ออก");
    const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
    const expenseTotal = expense.reduce((s, r) => s + r.amount, 0);

    const sum = (fn: (t: (typeof inMonth)[number]) => number) =>
      inMonth.reduce((s, t) => s + fn(t), 0);

    // VAT ขาย = เก็บจากลูกค้า · VAT ซื้อ = จ่ายให้ผู้ขาย (ภ.พ.30)
    const vatOut = sum((t) => (t.type === "เข้า" ? Number(t.vat_amt) || 0 : 0));
    const vatIn = sum((t) => (t.type === "ออก" ? Number(t.vat_amt) || 0 : 0));

    // หัก ณ ที่จ่าย: ที่เราหักไว้ต้องนำส่ง (ภ.ง.ด.3/53) · ที่ถูกหักไว้ = เครดิตภาษีของเรา
    const whtPayable = sum((t) =>
      t.type === "ออก" ? Number(t.wht_amt) || 0 : 0,
    );
    const whtCredit = sum((t) =>
      t.type === "เข้า" ? Number(t.wht_amt) || 0 : 0,
    );

    const payroll = payrolls.find((p) => p.period === period);
    const rows = payroll?.rows ?? [];
    const sso = rows.reduce((s, r) => s + (Number(r.sso_amt) || 0), 0);
    const pit = rows.reduce((s, r) => s + (Number(r.tax_amt) || 0), 0);
    const payrollNet = rows.reduce((s, r) => s + (Number(r.net) || 0), 0);

    return {
      income,
      expense,
      incomeTotal,
      expenseTotal,
      profit: incomeTotal - expenseTotal,
      vatOut,
      vatIn,
      whtPayable,
      whtCredit,
      payroll,
      sso,
      pit,
      payrollNet,
      staffCount: rows.length,
    };
  }, [transactions, payrolls, period, cashOnly]);

  const vatDue = data.vatOut - data.vatIn;

  /** หมวดที่มีเงินขยับ — เอาไว้เทียบเข้า/ออกในกราฟแท่งเดียวกัน */
  const categoryRows = useMemo(() => {
    const names = [
      ...new Set([
        ...data.income.map((r) => r.name),
        ...data.expense.map((r) => r.name),
      ]),
    ];
    return names
      .map((name) => ({
        name,
        income: data.income.find((r) => r.name === name)?.amount ?? 0,
        expense: data.expense.find((r) => r.name === name)?.amount ?? 0,
      }))
      .sort((a, b) => b.income + b.expense - (a.income + a.expense))
      .slice(0, 8);
  }, [data.income, data.expense]);

  /** ย้อนหลัง 12 เดือนจนถึงเดือนที่เลือก — ดูว่าขาขึ้นหรือขาลง */
  const trend = useMemo(() => {
    const [y, m] = period.split("-").map(Number);
    if (!y || !m) return [];

    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      keys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    const map = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]));
    for (const t of transactions) {
      if (cashOnly && t.unpaid) continue;
      const row = map.get(t.date.slice(0, 7));
      if (!row) continue;
      if (t.type === "เข้า") row.income += Number(t.amount) || 0;
      else row.expense += Number(t.amount) || 0;
    }

    return keys.map((k) => {
      const [yy, mm] = k.split("-").map(Number);
      const label = new Date(yy, mm - 1, 1).toLocaleDateString("th-TH", {
        month: "short",
      });
      const row = map.get(k)!;
      return [`${label} ${String((yy + 543) % 100)}`, row.income, row.expense];
    });
  }, [transactions, period, cashOnly]);

  const hasTrend = trend.some((r) => Number(r[1]) > 0 || Number(r[2]) > 0);

  return (
    <>
      <PageHeader
        title="สรุป"
        hint="ปิดยอดประจำเดือน — ตัวเลขชุดนี้ส่งให้นักบัญชีได้เลย"
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value || thisPeriod())}
              className="rounded-btn border border-line bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <Button
              variant="secondary"
              icon={<Printer size={15} />}
              onClick={() => window.print()}
            >
              พิมพ์
            </Button>
          </div>
        }
      />

      <div className="print-area space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted">รายได้ {periodLabel(period)}</p>
            <p className="mt-1 font-head text-2xl font-semibold text-ok tabular-nums">
              {fmtBaht(data.incomeTotal)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted">รายจ่าย</p>
            <p className="mt-1 font-head text-2xl font-semibold text-danger tabular-nums">
              {fmtBaht(data.expenseTotal)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted">
              {data.profit >= 0 ? "กำไร" : "ขาดทุน"}
            </p>
            <p
              className={`mt-1 font-head text-2xl font-semibold tabular-nums ${
                data.profit >= 0 ? "text-ok" : "text-danger"
              }`}
            >
              {fmtBaht(Math.abs(data.profit))}
            </p>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Package size={14} /> มูลค่าของในคลัง
            </p>
            <p className="mt-1 font-head text-2xl font-semibold text-ink tabular-nums">
              {fmtBaht(stockValue.total)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {stockValue.noCostCount
                ? `ยังไม่ใส่ทุน ${stockValue.noCostCount} รายการ`
                : "ยอด ณ วันนี้ (ไม่ใช่ยอดสิ้นเดือน)"}
            </p>
          </Card>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={cashOnly}
            onChange={(e) => setCashOnly(e.target.checked)}
            className="size-4 accent-accent"
          />
          นับเฉพาะเงินที่เข้า-ออกจริงแล้ว (ตัดบิลที่ยังค้างออก)
        </label>

        <div className="grid gap-4 xl:grid-cols-2">
          <Section
            title="เทียบเงินเข้า-เงินออก"
            hint="แยกตามหมวด เดือนที่เลือก"
          >
            {categoryRows.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                เดือนนี้ยังไม่มีรายการเงิน
              </p>
            ) : (
              <div className="p-2">
                <Chart
                  chartType="BarChart"
                  width="100%"
                  height={`${Math.max(220, categoryRows.length * 46 + 70)}px`}
                  loader={
                    <p className="py-16 text-center text-sm text-muted">
                      กำลังวาดกราฟ…
                    </p>
                  }
                  data={[
                    ["หมวด", "เงินเข้า", "เงินออก"],
                    ...categoryRows.map((r) => [r.name, r.income, r.expense]),
                  ]}
                  options={{
                    ...theme.base,
                    colors: [theme.ok, theme.danger],
                    legend: {
                      position: "top",
                      alignment: "start",
                      textStyle: { color: theme.muted },
                    },
                    chartArea: { width: "62%", height: "80%" },
                    hAxis: { ...theme.base.hAxis, format: "short" },
                  }}
                />
              </div>
            )}
          </Section>

          <Section
            title="ย้อนหลัง 12 เดือน"
            hint="ดูว่าขาขึ้นหรือขาลง (นับถึงเดือนที่เลือก)"
          >
            {!hasTrend ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                ยังมีข้อมูลไม่พอวาดเส้นแนวโน้ม
              </p>
            ) : (
              <div className="p-2">
                <Chart
                  chartType="LineChart"
                  width="100%"
                  height="280px"
                  loader={
                    <p className="py-16 text-center text-sm text-muted">
                      กำลังวาดกราฟ…
                    </p>
                  }
                  data={[["เดือน", "รายได้", "รายจ่าย"], ...trend]}
                  options={{
                    ...theme.base,
                    colors: [theme.ok, theme.danger],
                    curveType: "function",
                    pointSize: 5,
                    lineWidth: 2.5,
                    legend: {
                      position: "top",
                      alignment: "start",
                      textStyle: { color: theme.muted },
                    },
                    chartArea: { width: "80%", height: "72%" },
                    vAxis: { ...theme.base.vAxis, format: "short" },
                  }}
                />
              </div>
            )}
          </Section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="เงินเข้า" hint="แยกตามหมวด">
            <div className="divide-y divide-line">
              {data.income.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  เดือนนี้ยังไม่มีเงินเข้า
                </p>
              )}
              {data.income.map((r) => (
                <Row
                  key={r.name}
                  label={r.name}
                  value={fmtBaht(r.amount)}
                  tone="text-ok"
                />
              ))}
              <Row
                label="รวมเงินเข้า"
                value={fmtBaht(data.incomeTotal)}
                tone="text-ok"
                strong
              />
            </div>
          </Section>

          <Section title="เงินออก" hint="แยกตามหมวด">
            <div className="divide-y divide-line">
              {data.expense.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  เดือนนี้ยังไม่มีเงินออก
                </p>
              )}
              {data.expense.map((r) => (
                <Row
                  key={r.name}
                  label={r.name}
                  value={fmtBaht(r.amount)}
                  tone="text-danger"
                />
              ))}
              <Row
                label="รวมเงินออก"
                value={fmtBaht(data.expenseTotal)}
                tone="text-danger"
                strong
              />
            </div>
          </Section>
        </div>

        <Section
          title="ภาษีมูลค่าเพิ่ม (ภ.พ.30)"
          hint="ตัวเลขตั้งต้นสำหรับยื่นแบบ — ให้นักบัญชีตรวจอีกครั้งก่อนยื่น"
        >
          <div className="divide-y divide-line">
            <Row
              label="ภาษีขาย"
              hint="เก็บจากลูกค้า"
              value={fmtBaht(data.vatOut)}
              tone="text-ok"
            />
            <Row
              label="ภาษีซื้อ"
              hint="จ่ายให้ผู้ขาย"
              value={fmtBaht(data.vatIn)}
              tone="text-danger"
            />
            <Row
              label={vatDue >= 0 ? "ต้องนำส่งสรรพากร" : "ขอคืน/ยกไปเดือนหน้า"}
              value={fmtBaht(Math.abs(vatDue))}
              tone={vatDue >= 0 ? "text-warn" : "text-ok"}
              strong
            />
          </div>
        </Section>

        <Section
          title="หัก ณ ที่จ่าย"
          hint="ยอดที่หักไว้ต้องนำส่งภายในวันที่ 7 ของเดือนถัดไป"
        >
          <div className="divide-y divide-line">
            <Row
              label="ที่เราหักคนอื่นไว้ (ภ.ง.ด.3 / 53)"
              hint="ต้องนำส่งสรรพากร"
              value={fmtBaht(data.whtPayable)}
              tone="text-warn"
            />
            <Row
              label="ภาษีเงินได้พนักงาน (ภ.ง.ด.1)"
              hint={
                data.payroll
                  ? `จากงวดเงินเดือน ${data.staffCount} คน`
                  : "ยังไม่ได้ทำงวดเงินเดือนเดือนนี้"
              }
              value={fmtBaht(data.pit)}
              tone="text-warn"
            />
            <Row
              label="รวมต้องนำส่ง"
              value={fmtBaht(data.whtPayable + data.pit)}
              tone="text-warn"
              strong
            />
            <Row
              label="ที่ลูกค้าหักเราไว้"
              hint="เก็บใบ 50 ทวิ ไว้ใช้เป็นเครดิตภาษีตอนสิ้นปี"
              value={fmtBaht(data.whtCredit)}
              tone="text-muted"
            />
          </div>
        </Section>

        <Section
          title="ประกันสังคมและเงินเดือน"
          hint={
            data.payroll
              ? `งวด ${periodLabel(period)} — สถานะ ${data.payroll.status}`
              : "ยังไม่มีงวดเงินเดือนของเดือนนี้"
          }
          action={
            <Link to="/payroll" className="text-sm text-accent hover:underline">
              ไปหน้าเงินเดือน
            </Link>
          }
        >
          {data.payroll ? (
            <div className="divide-y divide-line">
              <Row
                label="หักจากพนักงาน"
                hint={`${data.staffCount} คน · อัตรา ${data.payroll.sso_rate}%`}
                value={fmtBaht(data.sso)}
              />
              <Row
                label="ส่วนที่นายจ้างสมทบ"
                hint="เท่ากับส่วนของพนักงาน"
                value={fmtBaht(data.sso)}
              />
              <Row
                label="รวมนำส่งประกันสังคม"
                value={fmtBaht(data.sso * 2)}
                tone="text-warn"
                strong
              />
              <Row
                label="เงินเดือนที่จ่ายจริง (สุทธิ)"
                value={fmtBaht(data.payrollNet)}
                tone="text-danger"
              />
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted">
              ยังไม่ได้คำนวณงวดเงินเดือนของเดือนนี้
            </p>
          )}
        </Section>

        <Card className="p-4 text-sm text-muted">
          เงินมัดจำถังที่ถือไว้ทั้งหมด{" "}
          <span className="font-medium text-ink">{fmtBaht(depositHeld)}</span>{" "}
          บาท — ไม่ใช่รายได้ เป็นเงินที่ต้องคืนลูกค้าเมื่อเลิกใช้ถัง
        </Card>
      </div>
    </>
  );
}
