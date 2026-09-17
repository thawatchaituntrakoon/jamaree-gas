import { Link } from "react-router-dom";
import { Lock, UserX } from "lucide-react";
import { accessRoleLabel } from "@/lib/constants";
import { useAuthStore } from "@/store/useAuthStore";

/** เปิดหน้านี้ไม่ได้ — บอกให้ชัดว่าทำไม จะได้ไม่ต้องเดา */
export function AccessDeniedPage() {
  const role = useAuthStore((s) => s.simulatedRole ?? s.role);
  const simulatedRole = useAuthStore((s) => s.simulatedRole);
  const setSimulatedRole = useAuthStore((s) => s.setSimulatedRole);
  const unlinked = useAuthStore((s) => s.unlinked);

  return (
    <div className="rounded-card border border-line bg-card p-10 text-center shadow-card">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warn-soft text-warn">
        {unlinked ? <UserX size={22} /> : <Lock size={22} />}
      </span>

      {unlinked ? (
        <>
          <h2 className="mt-4 text-lg">บัญชีนี้ยังไม่ได้ผูกกับพนักงาน</h2>
          <p className="mt-1.5 text-muted">
            ให้ผู้ดูแลระบบเปิดทะเบียนพนักงาน
            แล้วผูกบัญชีนี้เข้ากับชื่อของคุณก่อน
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-4 text-lg">ไม่มีสิทธิ์เข้าหน้านี้</h2>
          <p className="mt-1.5 text-muted">
            {simulatedRole ? (
              <>
                กำลังดูในมุมของ “{accessRoleLabel(role)}” —
                สิทธิ์นี้เข้าหน้านี้ไม่ได้
              </>
            ) : (
              <>
                สิทธิ์ของคุณคือ “{accessRoleLabel(role)}” —
                ถ้าต้องใช้หน้านี้จริง ให้ผู้จัดการปรับสิทธิ์ให้
              </>
            )}
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {simulatedRole && (
          <button
            type="button"
            onClick={() => setSimulatedRole(null)}
            className="rounded-btn bg-warn px-4 py-2 font-medium text-on-accent hover:opacity-90"
          >
            เลิกสวมบทบาท
          </button>
        )}
        <Link
          to="/"
          className="rounded-btn bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
