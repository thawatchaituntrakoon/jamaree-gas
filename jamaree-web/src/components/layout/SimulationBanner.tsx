import { Eye, X } from "lucide-react";
import { accessRoleLabel } from "@/lib/constants";
import { useAuthStore } from "@/store/useAuthStore";

/** แถบเตือนตอนกำลังดูระบบในมุมของคนอื่น — ต้องสะดุดตา ไม่งั้นลืมว่าตัวเองสวมบทอยู่ */
export function SimulationBanner() {
  const simulatedRole = useAuthStore((s) => s.simulatedRole);
  const setSimulatedRole = useAuthStore((s) => s.setSimulatedRole);

  if (!simulatedRole) return null;

  return (
    <div className="flex items-center gap-2.5 border-b border-warn/30 bg-warn-soft px-4 py-2.5 text-sm md:px-6">
      <Eye size={17} className="shrink-0 text-warn" />
      <p className="flex-1 text-ink">
        กำลังดูระบบในมุมของ{" "}
        <span className="font-medium text-warn">
          {accessRoleLabel(simulatedRole)}
        </span>{" "}
        · เมนูและหน้าที่เห็นถูกจำกัดตามสิทธิ์นี้
      </p>
      <button
        type="button"
        onClick={() => setSimulatedRole(null)}
        className="flex shrink-0 items-center gap-1.5 rounded-btn bg-warn px-2.5 py-1.5 text-xs font-medium text-on-accent"
      >
        <X size={14} />
        เลิกสวมบทบาท
      </button>
    </div>
  );
}
