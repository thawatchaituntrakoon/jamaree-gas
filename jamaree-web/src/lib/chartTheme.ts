import { useMemo } from "react";
import { useThemeStore } from "@/store/useThemeStore";

/** สีกราฟ — ล็อกให้ตรงกับชุดสีของระบบ (ดูที่ src/index.css) */
const LIGHT = {
  ink: "#16192d",
  muted: "#5b6172",
  line: "#e6e8ef",
  accent: "#2563eb",
  accent2: "#0d9488",
  ok: "#16a34a",
  warn: "#d97706",
  danger: "#dc2626",
};

/** จอมืดใช้สีอ่อนขึ้นหนึ่งขั้น — ความหมายของสีเหมือนเดิมทุกอย่าง */
const DARK = {
  ink: "#f8fafc",
  muted: "#94a3b8",
  line: "#334155",
  accent: "#60a5fa",
  accent2: "#2dd4bf",
  ok: "#4ade80",
  warn: "#fbbf24",
  danger: "#f87171",
};

export function useChartTheme() {
  const dark = useThemeStore((s) => s.theme) === "dark";

  return useMemo(() => {
    const c = dark ? DARK : LIGHT;
    return {
      ...c,
      dark,
      /** ค่าพื้นฐานที่กราฟทุกตัวใช้ร่วมกัน — พื้นโปร่งใสเพื่อให้กลืนกับการ์ด */
      base: {
        backgroundColor: "transparent",
        fontName: "Anuphan, sans-serif",
        titleTextStyle: { color: c.ink, fontSize: 15, bold: false },
        legend: { textStyle: { color: c.muted, fontSize: 12 } },
        tooltip: { textStyle: { color: "#16192d", fontName: "Anuphan" } },
        chartArea: { width: "84%", height: "72%" },
        hAxis: {
          textStyle: { color: c.muted, fontSize: 12 },
          gridlines: { color: c.line },
          baselineColor: c.line,
        },
        vAxis: {
          textStyle: { color: c.muted, fontSize: 12 },
          gridlines: { color: c.line },
          minorGridlines: { count: 0 },
          baselineColor: c.line,
        },
      },
    };
  }, [dark]);
}
