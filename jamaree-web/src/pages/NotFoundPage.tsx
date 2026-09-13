import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="rounded-card border border-line bg-card p-10 text-center shadow-card">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-paper text-muted">
        <Compass size={22} />
      </span>
      <h2 className="mt-4 text-lg">ไม่พบหน้าที่ต้องการ</h2>
      <p className="mt-1.5 text-muted">
        ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว
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
