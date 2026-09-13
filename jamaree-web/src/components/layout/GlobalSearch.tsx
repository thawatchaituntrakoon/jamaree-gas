import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { SEARCH_MIN_CHARS, searchResults } from "@/lib/search";
import { useDerived } from "@/lib/useDerived";

interface GlobalSearchProps {
  /** ปิดเมนูบนมือถือหลังเลือกผลลัพธ์ */
  onNavigate?: () => void;
}

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { customers, products, orders, customerName } = useDerived();

  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  // หน่วงไว้นิดเดียวก่อนค้นจริง จะได้ไม่คิดใหม่ทุกตัวอักษรที่พิมพ์
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 150);
    return () => clearTimeout(timer);
  }, [text]);

  const hits = useMemo(
    () => searchResults(query, { customers, products, orders, customerName }),
    [query, customers, products, orders, customerName],
  );

  useEffect(() => setActive(0), [query]);

  // แตะที่อื่นแล้วปิดกล่องผลลัพธ์
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function go(path: string) {
    navigate(path);
    setText("");
    setQuery("");
    setOpen(false);
    onNavigate?.();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active].path);
    }
  }

  const tooShort =
    query.trim().length > 0 && query.trim().length < SEARCH_MIN_CHARS;
  const showDrop =
    open &&
    (hits.length > 0 || tooShort || query.trim().length >= SEARCH_MIN_CHARS);

  return (
    <div ref={boxRef} className="relative px-3 pt-3">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="ค้นหาลูกค้า สินค้า บิล"
          aria-label="ค้นหาทั้งระบบ"
          aria-expanded={showDrop}
          aria-controls={listId}
          autoComplete="off"
          className="w-full rounded-btn border border-line bg-paper py-2 pr-8 pl-8 text-sm placeholder:text-muted focus:border-accent focus:bg-card focus:outline-none"
        />
        {text && (
          <button
            type="button"
            aria-label="ล้างคำค้นหา"
            onClick={() => {
              setText("");
              setQuery("");
            }}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-btn p-1 text-muted hover:bg-line"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDrop && (
        <ul
          id={listId}
          className="absolute inset-x-3 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-card border border-line bg-card py-1 shadow-pop"
        >
          {tooShort && (
            <li className="px-3 py-2.5 text-sm text-muted">
              พิมพ์อย่างน้อย {SEARCH_MIN_CHARS} ตัวอักษร
            </li>
          )}
          {!tooShort && hits.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">
              ไม่พบข้อมูลที่ค้นหา
            </li>
          )}
          {hits.map((hit, i) => (
            <li key={`${hit.group}-${hit.id}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit.path)}
                className={[
                  "flex w-full items-baseline gap-2 px-3 py-2 text-left",
                  i === active ? "bg-accent-soft" : "hover:bg-paper",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {hit.label}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {hit.hint}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                  {hit.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
