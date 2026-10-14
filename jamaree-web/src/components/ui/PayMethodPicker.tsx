import { Banknote, Landmark } from "lucide-react";
import type { PayMethod } from "@/types";

const CHOICES: { value: PayMethod; icon: typeof Banknote }[] = [
  { value: "เงินสด", icon: Banknote },
  { value: "เงินโอน", icon: Landmark },
];

interface PayMethodPickerProps {
  value: PayMethod;
  onChange: (value: PayMethod) => void;
  /** ปุ่มใหญ่สำหรับจอสัมผัสหน้าร้าน */
  big?: boolean;
}

/** เลือกว่ารับ/จ่ายเป็นเงินสดหรือเงินโอน */
export function PayMethodPicker({
  value,
  onChange,
  big,
}: PayMethodPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CHOICES.map(({ value: v, icon: Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={[
            "flex items-center justify-center gap-2 rounded-btn border font-medium transition-colors",
            big ? "h-12 text-base" : "px-3 py-2 text-sm",
            value === v
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-card text-muted hover:bg-paper",
          ].join(" ")}
        >
          <Icon size={big ? 20 : 16} />
          {v}
        </button>
      ))}
    </div>
  );
}
