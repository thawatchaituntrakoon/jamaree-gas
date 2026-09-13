import { Menu, Moon, Sun } from "lucide-react";
import { fmtDate, todayStr } from "@/lib/constants";
import { useThemeStore } from "@/store/useThemeStore";

interface TopbarProps {
  title: string;
  onOpenMenu: () => void;
}

export function Topbar({ title, onOpenMenu }: TopbarProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const dark = theme === "dark";

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
