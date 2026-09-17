import { Eye, Menu, Moon, Sun } from "lucide-react";
import { ACCESS_ROLES, fmtDate, todayStr } from "@/lib/constants";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";
import type { AccessRole } from "@/types";

interface TopbarProps {
  title: string;
  onOpenMenu: () => void;
}

export function Topbar({ title, onOpenMenu }: TopbarProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const dark = theme === "dark";

  // เทียบกับสิทธิ์จริงเท่านั้น — สวมบทแล้วต้องถอดออกได้เสมอ
  const isSuper = useAuthStore((s) => s.role === "SUPER_ADMIN");
  const simulatedRole = useAuthStore((s) => s.simulatedRole);
  const setSimulatedRole = useAuthStore((s) => s.setSimulatedRole);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-card/90 px-4 py-3 backdrop-blur md:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="เปิดเมนู"
        className="rounded-btn p-1.5 text-muted hover:bg-paper lg:hidden"
      >
        <Menu size={20} />
      </button>

      <h1 className="flex-1 truncate text-lg">{title}</h1>

      <p className="hidden text-sm text-muted sm:block">
        วันนี้ {fmtDate(todayStr())}
      </p>

      {isSuper && (
        <label
          className={[
            "flex items-center gap-1.5 rounded-btn border px-2 py-1.5 text-sm",
            simulatedRole
              ? "border-warn/40 bg-warn-soft text-warn"
              : "border-line text-muted",
          ].join(" ")}
          title="ลองดูว่าสิทธิ์อื่นเห็นอะไรบ้าง"
        >
          <Eye size={16} className="shrink-0" />
          <span className="sr-only">ดูระบบในมุมของ</span>
          <select
            value={simulatedRole ?? ""}
            onChange={(e) =>
              setSimulatedRole((e.target.value || null) as AccessRole | null)
            }
            className="bg-transparent text-sm outline-none"
          >
            <option value="">ดูในมุมของ…</option>
            {ACCESS_ROLES.filter((r) => r.value !== "SUPER_ADMIN").map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={dark ? "สลับเป็นจอสว่าง" : "สลับเป็นจอมืด"}
        title={dark ? "สลับเป็นจอสว่าง" : "สลับเป็นจอมืด"}
        className="rounded-btn p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    </header>
  );
}
