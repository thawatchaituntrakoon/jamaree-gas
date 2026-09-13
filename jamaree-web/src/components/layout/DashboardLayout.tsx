import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { navItemByPath } from "@/lib/nav";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";

export function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const title = navItemByPath(pathname)?.label ?? "JAMAREE GAS";

  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);
  const loadAll = useAppStore((s) => s.loadAll);

  useEffect(() => {
    if (isSupabaseConfigured) void loadAll();
  }, [loadAll]);

  // ปิดเมนูมือถือทุกครั้งที่เปลี่ยนหน้า
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-paper">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-64">
        <Topbar title={title} onOpenMenu={() => setMenuOpen(true)} />

        <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
          {!isSupabaseConfigured && (
            <div className="mb-5 rounded-card border border-warn/30 bg-warn-soft p-4">
              <div className="flex gap-3">
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-warn"
                />
                <div className="text-sm">
                  <p className="font-medium text-warn">ยังไม่ได้ต่อฐานข้อมูล</p>
                  <p className="mt-1 text-ink">
                    ตอนนี้ดูได้แค่หน้าตาระบบ ยังไม่มีข้อมูลจริง — คัดลอกไฟล์{" "}
                    <code className="rounded bg-card px-1">.env.example</code>{" "}
                    เป็น{" "}
                    <code className="rounded bg-card px-1">.env.local</code>{" "}
                    แล้วใส่ค่าจาก Supabase จากนั้นรันใหม่อีกครั้ง
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-card border border-danger/30 bg-danger-soft p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-danger"
                />
                <p className="flex-1 text-sm text-ink">{error}</p>
                <button
                  type="button"
                  onClick={clearError}
                  className="rounded-btn px-2 py-1 text-sm font-medium text-danger hover:bg-card"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}

          {status === "loading" ? (
            <div className="flex items-center justify-center gap-2.5 py-20 text-muted">
              <Loader2 size={18} className="animate-spin" />
              <span>กำลังโหลดข้อมูล…</span>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2.5 py-20 text-muted">
                  <Loader2 size={18} className="animate-spin" />
                  <span>กำลังเปิดหน้า…</span>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}
