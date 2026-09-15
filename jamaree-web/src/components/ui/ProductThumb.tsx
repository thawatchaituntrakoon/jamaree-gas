import { useEffect, useState } from "react";
import { Package } from "lucide-react";

const SIZES = {
  sm: "size-9",
  md: "size-12",
  lg: "size-28",
} as const;

interface ProductThumbProps {
  url: string | null | undefined;
  name: string;
  size?: keyof typeof SIZES;
}

/** รูปสินค้า — ไม่มีรูปหรือโหลดรูปไม่ขึ้น จะโชว์ไอคอนแทน ไม่ปล่อยให้เป็นช่องว่าง */
export function ProductThumb({ url, name, size = "sm" }: ProductThumbProps) {
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [url]);

  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-lg border border-line bg-paper`;

  if (!url?.trim() || broken) {
    return (
      <div className={`${box} grid place-items-center text-muted`} aria-hidden>
        <Package size={size === "lg" ? 32 : 16} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`${box} object-cover`}
    />
  );
}
