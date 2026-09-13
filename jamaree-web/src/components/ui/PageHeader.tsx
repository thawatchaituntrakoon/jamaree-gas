import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  /** ใส่เพื่อให้มีปุ่มย้อนกลับ */
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  hint,
  action,
  backTo,
  backLabel = "ย้อนกลับ",
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-4">
      {backTo && (
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="mb-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowRight size={15} className="rotate-180" />
          {backLabel}
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">{title}</h2>
          {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
