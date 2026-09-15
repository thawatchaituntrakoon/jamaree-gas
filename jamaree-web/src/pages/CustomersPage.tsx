import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThaiAddressInput } from "@/components/ui/ThaiAddressInput";
import { PERSON_TYPES, fmtBaht } from "@/lib/constants";
import { EMPTY_ADDRESS, composeAddress, parseAddress } from "@/lib/thaiAddress";
import type { ThaiAddressParts } from "@/lib/thaiAddress";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { Customer, CustomerInput, PersonType } from "@/types";

const BLANK: CustomerInput = {
  name: "",
  phone: "",
  note: "",
  person_type: "บุคคล",
  tax_id: "",
  address: "",
  price_tier_id: null,
};

export function CustomersPage() {
  const { customers, customerDebt } = useDerived();
  const priceTiers = useAppStore((s) => s.priceTiers);
  const saveCustomer = useAppStore((s) => s.saveCustomer);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(BLANK);
  const [street, setStreet] = useState("");
  const [addr, setAddr] = useState<ThaiAddressParts>(EMPTY_ADDRESS);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // กันผลแยกที่อยู่ของรายเก่ามาทับ ตอนกดสลับลูกค้าเร็ว ๆ
  const addrToken = useRef(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, query]);

  function openNew() {
    addrToken.current += 1;
    setEditing(null);
    setForm(BLANK);
    setStreet("");
    setAddr(EMPTY_ADDRESS);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      note: c.note ?? "",
      person_type: c.person_type,
      tax_id: c.tax_id ?? "",
      address: c.address ?? "",
      price_tier_id: c.price_tier_id,
    });
    // เปิดหน้าต่างทันทีด้วยที่อยู่เดิมทั้งก้อน แล้วค่อยแยกช่องให้ทีหลัง
    setStreet(c.address ?? "");
    setAddr(EMPTY_ADDRESS);
    setOpen(true);

    const token = (addrToken.current += 1);
    void parseAddress(c.address).then(({ street: line, parts }) => {
      if (addrToken.current !== token) return;
      setStreet(line);
      setAddr(parts);
    });
  }

  async function submit() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await saveCustomer(
        {
          ...form,
          name: form.name.trim(),
          address: await composeAddress(street, addr),
          price_tier_id: form.price_tier_id || null,
        },
        editing?.id,
      );
      setOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์อยู่บนแถบเตือนด้านบนแล้ว
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="ลูกค้า"
        hint="ทะเบียนลูกค้าทั้งหมด กดที่ชื่อเพื่อดูยอดค้างและถังที่ยืมไป"
        action={
          <Button icon={<Plus size={16} />} onClick={openNew}>
            เพิ่มลูกค้า
          </Button>
        }
      />

      <Card>
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือเบอร์โทร"
              aria-label="ค้นหาลูกค้า"
              className="w-full rounded-btn border border-line bg-card py-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <DataTable<Customer>
          rows={rows}
          rowKey={(c) => c.id}
          empty={
            customers.length
              ? "ไม่พบลูกค้าที่ค้นหา"
              : "ยังไม่มีลูกค้า กดปุ่ม “เพิ่มลูกค้า” เพื่อเริ่ม"
          }
          columns={[
            {
              header: "ชื่อ",
              cell: (c) => (
                <Link
                  to={`/customers/${c.id}`}
                  className="font-medium text-ink hover:text-accent hover:underline"
                >
                  {c.name}
                </Link>
              ),
            },
            { header: "เบอร์โทร", cell: (c) => c.phone || "—" },
            {
              header: "ประเภท",
              hideOnMobile: true,
              cell: (c) => (
                <Badge tone={c.person_type === "นิติบุคคล" ? "info" : "muted"}>
                  {c.person_type}
                </Badge>
              ),
            },
            {
              header: "ชุดราคา",
              hideOnMobile: true,
              cell: (c) =>
                priceTiers.find((t) => t.id === c.price_tier_id)?.name ??
                "ราคาปกติ",
            },
            {
              header: "ค้างจ่าย",
              align: "right",
              cell: (c) => {
                const debt = customerDebt(c.id);
                return debt > 0 ? (
                  <span className="font-medium text-danger">
                    {fmtBaht(debt)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                );
              },
            },
            {
              header: "",
              align: "right",
              cell: (c) => (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={14} />}
                  onClick={() => openEdit(c)}
                >
                  แก้ไข
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"}
        hint="ที่อยู่กับเลขผู้เสียภาษีจำเป็นตอนออกใบกำกับภาษีเต็มรูป"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={saving || !form.name?.trim()}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="ชื่อลูกค้า">
            {(id) => (
              <TextInput
                id={id}
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น ร้านอาหารครัวคุณแดง"
              />
            )}
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="เบอร์โทร">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  inputMode="tel"
                />
              )}
            </Field>
            <Field label="ประเภท">
              {(id) => (
                <Select
                  id={id}
                  value={form.person_type ?? "บุคคล"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      person_type: e.target.value as PersonType,
                    })
                  }
                >
                  {PERSON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="ชุดราคา" hint="ไม่เลือก = ใช้ราคาปกติของสินค้า">
            {(id) => (
              <Select
                id={id}
                value={form.price_tier_id ?? ""}
                onChange={(e) =>
                  setForm({ ...form, price_tier_id: e.target.value || null })
                }
              >
                <option value="">ราคาปกติ</option>
                {priceTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.description ? `${t.name} — ${t.description}` : t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="เลขผู้เสียภาษี">
            {(id) => (
              <TextInput
                id={id}
                value={form.tax_id ?? ""}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                inputMode="numeric"
              />
            )}
          </Field>

          <Field label="ที่อยู่" hint="บ้านเลขที่ อาคาร หมู่ ซอย ถนน">
            {(id) => (
              <TextInput
                id={id}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="เช่น 99/9 หมู่ 5 ถนนสุขุมวิท"
              />
            )}
          </Field>

          <ThaiAddressInput value={addr} onChange={setAddr} />

          <Field label="โน้ต">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={form.note ?? ""}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="เช่น ส่งช่วงบ่ายเท่านั้น"
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
