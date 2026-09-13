import { NavLink } from "react-router-dom";
import { Flame, LogOut, X } from "lucide-react";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NAV_GROUPS } from "@/lib/nav";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

interface SidebarProps {
  /** เปิดอยู่ไหมบนจอมือถือ */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { session } = useSession();
  // บนมือถือตอนเมนูปิด เมนูยังลอยอยู่นอกจอ — ปิดไม่ให้กด Tab ไปโดนได้
  const hidden = !isDesktop && !open;

  return (
    <>
      {/* ฉากหลังสีเทาบนจอมือถือ — แตะแล้วปิดเมนู */}
      {open && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-overlay lg:hidden"
        />
      )}

      <aside
        inert={hidden}
        aria-hidden={hidden}
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-card",
          "transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-btn bg-accent text-on-accent">
            <Flame size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-head font-semibold">JAMAREE GAS</p>
            <p className="truncate text-xs text-muted">ระบบจัดการร้าน</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
            className="rounded-btn p-1.5 text-muted hover:bg-paper lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <GlobalSearch onNavigate={onClose} />

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-2 text-xs font-medium text-muted">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-ink hover:bg-paper",
                        ].join(" ")
                      }
                    >
                      <item.icon size={17} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.pending && (
                        <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                          เร็ว ๆ นี้
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {isSupabaseConfigured && session && (
          <div className="border-t border-line px-3 py-3">
            <p className="mb-1.5 truncate px-2.5 text-xs text-muted">
              {session.user.email}
            </p>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 text-sm text-ink transition-colors hover:bg-paper"
            >
              <LogOut size={17} className="shrink-0" />
              ออกจากระบบ
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
