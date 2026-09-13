import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** กล่องขาวมุมมน เงานุ่ม — ใช้เป็นกรอบมาตรฐานของทุกหน้า */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line bg-card shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

interface SectionProps {
  title: string;
  /** คำอธิบายใต้หัวข้อ */
  hint?: string;
  /** ปุ่มมุมขวาบน */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** หัวข้อ + เนื้อหา ในการ์ดเดียว */
export function Section({
  title,
  hint,
  action,
  className = "",
  children,
}: SectionProps) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 md:px-5">
        <div>
          <h2 className="text-base">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
