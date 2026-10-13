import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { matchQuery } from "@/lib/search";

export interface SearchOption {
  value: string;
  label: string;
  /** บรรทัดเล็กใต้ชื่อ — ค้นหาเจอด้วย */
  hint?: string;
}

interface SearchSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  /** ข้อความตอนยังไม่เลือก และเป็นตัวเลือก “ไม่ระบุ” ในรายการด้วย */
  placeholder: string;
  /** โชว์มากสุดกี่รายการต่อการค้นหาหนึ่งครั้ง */
  limit?: number;
}

const EMPTY = "__none__";

/** ช่องเลือกที่พิมพ์ค้นหาได้ — ใช้แทน <select> ตอนรายการยาวจนหาไม่เจอ */
export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  limit = 50,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const rows = useMemo(() => {
    const q = term.trim();
    const hits = q
      ? options.filter((o) => matchQuery(q, o.label, o.hint))
      : options;
    const list = hits.slice(0, limit);
    return q ? list : [{ value: "", label: placeholder }, ...list];
  }, [options, term, limit, placeholder]);

  useEffect(() => setActive(0), [term]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setTerm("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      // กันไม่ให้ Escape ทะลุไปปิดหน้าต่างทั้งบาน ทั้งที่ตั้งใจแค่ปิดรายการ
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + rows.length) % Math.max(1, rows.length));
      return;
    }
    if (e.key === "Enter" && open && rows[active]) {
      e.preventDefault();
      pick(rows[active].value);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id ?? EMPTY}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? term : (selected?.label ?? "")}
        placeholder={selected ? selected.label : placeholder}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setTerm("");
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-btn border border-line bg-card py-2 pr-9 pl-9 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="เปิดรายการ"
        onClick={() => setOpen((v) => !v)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-btn p-1.5 text-muted hover:text-ink"
      >
        <ChevronDown size={16} />
      </button>

      {open && (
        <ul
          id={`${id ?? EMPTY}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-card border border-line bg-card py-1 shadow-pop"
        >
          {rows.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">
              ไม่พบรายการที่ค้นหา
            </li>
          )}
          {rows.map((o, i) => (
            <li key={o.value || EMPTY}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={[
                  "block w-full px-3 py-2 text-left text-sm",
                  i === active ? "bg-accent-soft text-accent" : "text-ink",
                ].join(" ")}
              >
                <span className="block truncate">{o.label}</span>
                {o.hint && (
                  <span className="block truncate text-xs text-muted">
                    {o.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
