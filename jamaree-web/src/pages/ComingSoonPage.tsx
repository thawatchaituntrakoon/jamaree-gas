import { Link, useLocation } from "react-router-dom";
import { Hammer } from "lucide-react";
import { navItemByPath } from "@/lib/nav";

/** หน้าที่ยังย้ายมาไม่เสร็จ — บอกตรง ๆ ว่ายังไม่พร้อม ดีกว่าโชว์หน้าเปล่า */
export function ComingSoonPage() {
  const { pathname } = useLocation();
  const label = navItemByPath(pathname)?.label ?? "หน้านี้";

  return (
    <div className="rounded-card border border-line bg-card p-10 text-center shadow-card">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-paper text-muted">
        <Hammer size={22} />
      </span>
      <h2 className="mt-4 text-lg">กำลังย้ายหน้า “{label}” มาที่ระบบใหม่</h2>
      <p className="mt-1.5 text-muted">
        ระหว่างนี้ยังใช้งานหน้านี้ในระบบเดิมได้ตามปกติ
      </p>
      <Link
        to="/"
        className="mt-5 inline-block rounded-btn bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90"
      >
        กลับหน้าแดชบอร์ด
      </Link>
    </div>
  );
}
