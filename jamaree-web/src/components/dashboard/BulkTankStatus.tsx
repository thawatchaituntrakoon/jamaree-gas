import { useState } from "react";
import { Chart } from "react-google-charts";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { fmtQty } from "@/lib/constants";
import { useChartTheme } from "@/lib/chartTheme";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";

/**
 * สถานะน้ำแก๊สในถังเก็บใหญ่ — วงกลม 3 มิติ
 * แก๊สที่เหลือมาจากสินค้าชนิด "ดิบ" (ตัวจริงตัวเดียวในระบบ)
 * ความจุถังมาจากข้อมูลร้าน (ตั้งครั้งเดียวจบ)
 */
export function BulkTankStatus() {
  const { rawGas } = useDerived();
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const theme = useChartTheme();

  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const [saving, setSaving] = useState(false);

  const current = Math.max(0, Number(rawGas?.stock ?? 0));
  const capacity = Math.max(0, Number(settings?.bulk_tank_kg ?? 0));
  const free = Math.max(0, capacity - current);
  const percent = capacity > 0 ? Math.min(100, (current / capacity) * 100) : 0;

  // เหลือน้อยกว่า 20% = ควรสั่งแก๊สเข้าได้แล้ว
  const lowTone =
    capacity > 0 && percent < 20
      ? "text-danger"
      : capacity > 0 && percent < 40
        ? "text-warn"
        : "text-ink";

  function openSetup() {
    setKg(capacity > 0 ? String(capacity) : "");
    setOpen(true);
  }

  async function submit() {
    const value = Number(kg);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    try {
      await saveSettings({ bulk_tank_kg: value });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Flame size={14} /> แก๊สในถังเก็บใหญ่
            </p>
            <p
              className={`mt-1 font-head text-2xl font-semibold tabular-nums ${lowTone}`}
            >
              {fmtQty(current)} kg
            </p>
            {capacity > 0 && (
              <p className="text-xs text-muted">
                เหลือ {percent.toFixed(0)}% ของความจุ {fmtQty(capacity)} kg
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={openSetup}>
            ตั้งความจุ
          </Button>
        </div>

        {!rawGas ? (
          <p className="py-10 text-center text-sm text-muted">
            ยังไม่ได้ตั้งสินค้า “แก๊สดิบ (ถังเก็บใหญ่)” ในระบบ
          </p>
        ) : capacity <= 0 ? (
          <div className="py-9 text-center">
            <p className="text-sm text-muted">
              ใส่ความจุถังเก็บใหญ่ก่อน ถึงจะเห็นว่าเหลือกี่เปอร์เซ็นต์
            </p>
            <Button className="mt-3" onClick={openSetup}>
              ตั้งความจุถัง
            </Button>
          </div>
        ) : (
          <Chart
            chartType="PieChart"
            width="100%"
            height="240px"
            loader={
              <p className="py-16 text-center text-sm text-muted">
                กำลังวาดกราฟ…
              </p>
            }
            data={[
              ["สถานะ", "กิโล"],
              ["ปริมาณแก๊สคงเหลือ", current],
              ["พื้นที่ว่าง", free],
            ]}
            options={{
              ...theme.base,
              title: "สถานะน้ำแก๊สในถังเก็บใหญ่ (Bulk Tank)",
              is3D: true,
              colors: [theme.accent, theme.line],
              pieSliceTextStyle: { color: theme.dark ? "#0f172a" : "#ffffff" },
              legend: { position: "bottom", textStyle: { color: theme.muted } },
              chartArea: { width: "92%", height: "72%" },
            }}
          />
        )}
      </Card>

      <Modal
        open={open}
        title="ความจุถังเก็บใหญ่"
        hint="ใส่ครั้งเดียว ใช้คิดว่าแก๊สเหลือกี่เปอร์เซ็นต์"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={saving || Number(kg) <= 0}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <Field label="ความจุ (กิโล)" hint="เช่น ถัง 5 ตัน ใส่ 5000">
          {(id) => (
            <TextInput
              id={id}
              type="number"
              min={0}
              step="any"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="0"
            />
          )}
        </Field>
      </Modal>
    </>
  );
}
