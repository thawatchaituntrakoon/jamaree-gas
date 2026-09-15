import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Field, TextInput } from "@/components/ui/Field";
import {
  ADDRESS_MIN_CHARS,
  searchAddress,
  warmThaiAddress,
} from "@/lib/thaiAddress";
import type { ThaiAddressParts } from "@/lib/thaiAddress";

type PartKey = keyof ThaiAddressParts;

interface ThaiAddressInputProps {
  value: ThaiAddressParts;
  onChange: (next: ThaiAddressParts) => void;
  className?: string;
}

/**
 * ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ พร้อมตัวช่วยเดา — พิมพ์ช่องไหนก็ได้ เลือกแล้วเติมให้ครบทั้ง 4 ช่อง
 * ยังพิมพ์เองได้อิสระ ไม่บังคับให้เลือกจากรายการ (ที่อยู่แปลก ๆ ก็ยังบันทึกได้)
 */
export function ThaiAddressInput({
  value,
  onChange,
  className = "",
}: ThaiAddressInputProps) {
  const baseId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [field, setField] = useState<PartKey | null>(null);
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ThaiAddressParts[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => warmThaiAddress(), []);

  // หน่วงไว้นิดเดียวก่อนค้นจริง จะได้ไม่คิดใหม่ทุกตัวอักษรที่พิมพ์
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term), 150);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!field) {
      setHits([]);
      return;
    }
    let alive = true;
    setLoading(true);
    searchAddress(field, query)
      .then((rows) => {
        if (!alive) return;
        setHits(rows);
        setActive(0);
      })
      .catch(() => {
        if (alive) setHits([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [field, query]);

  // แตะที่อื่นแล้วปิดรายการ
  useEffect(() => {
    if (!field) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [field]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function close() {
    setField(null);
    setTerm("");
    setQuery("");
    setHits([]);
  }

  function type(key: PartKey, text: string) {
    onChange({ ...value, [key]: text });
    setField(key);
    setTerm(text);
  }

  function pick(parts: ThaiAddressParts) {
    onChange(parts);
    close();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
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
      pick(hits[active]);
    }
  }

  const searched = query.trim().length >= ADDRESS_MIN_CHARS;
  const showDrop = !!field && (hits.length > 0 || (searched && !loading));

  function box(key: PartKey, label: string, extra?: { numeric?: boolean }) {
    const open = showDrop && field === key;
    const listId = `${baseId}-${key}`;
    return (
      <div className="relative">
        <Field label={label}>
          {(id) => (
            <TextInput
              id={id}
              value={value[key]}
              onChange={(e) => type(key, e.target.value)}
              onFocus={() => {
                setField(key);
                setTerm(value[key]);
                setQuery(value[key]);
              }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                open && hits.length ? `${listId}-${active}` : undefined
              }
              {...(extra?.numeric
                ? { inputMode: "numeric" as const, maxLength: 5 }
                : {})}
            />
          )}
        </Field>

        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-card border border-line bg-card py-1 shadow-pop"
          >
            {hits.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-muted">
                ไม่พบที่อยู่ที่ตรงกับคำค้น พิมพ์เองได้เลย
              </li>
            )}
            {hits.map((hit, i) => (
              <li
                key={`${hit.subDistrict}-${hit.district}-${hit.province}-${hit.postalCode}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(hit)}
                  className={[
                    "flex w-full items-baseline gap-2 px-3 py-2 text-left",
                    i === active ? "bg-accent-soft" : "hover:bg-paper",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {hit.subDistrict}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {hit.district} · {hit.province}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-paper px-1.5 py-0.5 text-[10px] text-muted tabular-nums">
                    {hit.postalCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className={`space-y-3.5 ${className}`}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {box("subDistrict", "ตำบล / แขวง")}
        {box("district", "อำเภอ / เขต")}
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {box("province", "จังหวัด")}
        {box("postalCode", "รหัสไปรษณีย์", { numeric: true })}
      </div>
    </div>
  );
}
