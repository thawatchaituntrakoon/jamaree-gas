import type { ReactNode } from "react";
import { STATUS_TONE, type StatusTone } from "@/lib/constants";

interface BadgeProps {
  children: ReactNode;
  tone?: StatusTone;
}

/** ป้ายสถานะ — สีต้องมีความหมายเสมอ (เขียว=ดี ส้ม=รอ แดง=มีปัญหา) */
export function Badge({ children, tone = "muted" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_TONE[tone]}`}
    >
      {children}
    </span>
  );
}
