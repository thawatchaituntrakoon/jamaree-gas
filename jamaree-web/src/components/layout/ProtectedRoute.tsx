import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AccessDeniedPage } from "@/pages/AccessDeniedPage";
import { roleAllowed, useAuthStore } from "@/store/useAuthStore";
import type { AccessRole } from "@/types";

interface ProtectedRouteProps {
  /** ว่างไว้ = ใครก็เข้าได้ ขอแค่ล็อกอิน */
  allowedRoles?: readonly AccessRole[];
  /** ไม่มีสิทธิ์แล้วให้เด้งไปหน้าไหน — ไม่ใส่ = โชว์หน้า "ไม่มีสิทธิ์" ตรงนั้นเลย */
  redirectTo?: string;
  children?: ReactNode;
}

/**
 * ด่านหน้าเส้นทาง — ใช้ครอบ <Route> หรือครอบคอมโพเนนต์ตรง ๆ ก็ได้
 * ⚠️ กันตาไม่ให้เห็นเฉย ๆ ไม่ใช่กันมือ — ตัวจริงต้องกันที่ RLS ฝั่งฐานข้อมูล
 */
export function ProtectedRoute({
  allowedRoles,
  redirectTo,
  children,
}: ProtectedRouteProps) {
  const { pathname } = useLocation();
  const ready = useAuthStore((s) => s.ready);
  const roleReady = useAuthStore((s) => s.roleReady);
  const unlinked = useAuthStore((s) => s.unlinked);
  // อ่านสิทธิ์เป็นค่า ไม่ใช่ can() — จะได้วาดใหม่เมื่อสลับมุมมอง
  const role = useAuthStore((s) => s.simulatedRole ?? s.role);

  // ยังไม่รู้ว่าใครใช้อยู่ — ตัดสินตอนนี้จะไล่คนที่มีสิทธิ์ออกไปเปล่า ๆ
  if (!ready || !roleReady) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-16 text-muted">
        <Loader2 size={18} className="animate-spin" />
        <span>กำลังตรวจสิทธิ์…</span>
      </div>
    );
  }

  if (unlinked || !roleAllowed(role, allowedRoles)) {
    // เด้งกลับที่เดิม = วนไม่จบ ถ้าเจอแบบนั้นให้โชว์เหตุผลแทน
    if (redirectTo && redirectTo !== pathname) {
      return <Navigate to={redirectTo} replace />;
    }
    return <AccessDeniedPage />;
  }

  return children ?? <Outlet />;
}
