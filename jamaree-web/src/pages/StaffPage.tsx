import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThaiAddressInput } from "@/components/ui/ThaiAddressInput";
import {
  ACCESS_ROLES,
  accessRoleLabel,
  fmtBaht,
  fmtDate,
  todayStr,
} from "@/lib/constants";
import { EMPTY_ADDRESS, composeAddress, parseAddress } from "@/lib/thaiAddress";
import type { ThaiAddressParts } from "@/lib/thaiAddress";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { AccessRole, PayType, Staff, StaffInput } from "@/types";

const PAY_TYPES: ReadonlyArray<PayType> = ["รายเดือน", "รายวัน"];

export function StaffPage() {
  const { staff } = useDerived();
  const saveStaff = useAppStore((s) => s.saveStaff);
  const myRole = useAuthStore((s) => s.role);
  const myStaffId = useAuthStore((s) => s.profile?.id ?? null);

  const [showLeft, setShowLeft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffInput>({ name: "" });
  const [street, setStreet] = useState("");
  const [addr, setAddr] = useState<ThaiAddressParts>(EMPTY_ADDRESS);
  const [endFor, setEndFor] = useState<Staff | null>(null);
  const [endDate, setEndDate] = useState(todayStr());
  const [endReason, setEndReason] = useState("");

  // กันผลแยกที่อยู่ของคนเก่ามาทับ ตอนกดสลับคนเร็ว ๆ
  const addrToken = useRef(0);

  const rows = staff.filter((s) => (showLeft ? true : !s.terminated_at));

  /**
   * ใครแก้สิทธิ์ของใครได้บ้าง
   * ผู้จัดการแต่งตั้งผู้ดูแลระบบสูงสุดไม่ได้ และแก้สิทธิ์ของผู้ดูแลระบบสูงสุดไม่ได้ — กันยกตัวเองขึ้นเป็นเจ้าของ
   * ตัวเองก็แก้สิทธิ์ตัวเองไม่ได้ — กันลดสิทธิ์ตัวเองจนเข้าระบบไม่ได้อีก
   */
  function roleEditable(target: Staff | null) {
    if (myRole !== "SUPER_ADMIN" && myRole !== "MANAGER") return false;
    if (target && target.id === myStaffId) return false;
    if (myRole === "MANAGER" && target?.access_role === "SUPER_ADMIN")
      return false;
    return true;
  }

  const canEditRole = roleEditable(editing);
  const roleOptions = ACCESS_ROLES.filter(
    (r) => r.value !== "SUPER_ADMIN" || myRole === "SUPER_ADMIN",
  );

  function openForm(s: Staff | null) {
    setEditing(s);
    setForm(
      s
        ? {
            name: s.name,
            nickname: s.nickname,
            role: s.role,
            access_role: s.access_role,
            phone: s.phone,
            pay_type: s.pay_type,
            salary: s.salary,
            daily_rate: s.daily_rate,
            start_date: s.start_date,
            address: s.address,
            bank_name: s.bank_name,
            bank_account: s.bank_account,
            note: s.note,
          }
        : {
            name: "",
            pay_type: "รายเดือน",
            start_date: todayStr(),
            access_role: "GENERAL",
          },
    );
    // เปิดหน้าต่างทันทีด้วยที่อยู่เดิมทั้งก้อน แล้วค่อยแยกช่องให้ทีหลัง
    setStreet(s?.address ?? "");
    setAddr(EMPTY_ADDRESS);
    setOpen(true);

    const token = (addrToken.current += 1);
    void parseAddress(s?.address).then(({ street: line, parts }) => {
      if (addrToken.current !== token) return;
      setStreet(line);
      setAddr(parts);
    });
  }

  async function submit() {
    if (!form.name?.trim()) return;
    setBusy(true);
    try {
      // ไม่มีสิทธิ์แต่งตั้ง = ไม่ส่งช่องสิทธิ์ไปเลย ของเดิมในฐานข้อมูลจะได้ไม่ถูกทับ
      const { access_role, ...rest } = form;
      await saveStaff(
        {
          ...rest,
          ...(canEditRole ? { access_role } : {}),
          name: form.name.trim(),
          address: await composeAddress(street, addr),
          salary: Number(form.salary) || 0,
          daily_rate: Number(form.daily_rate) || 0,
        },
        editing?.id,
      );
      setOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function submitEnd() {
    if (!endFor) return;
    setBusy(true);
    try {
      await saveStaff(
        {
          name: endFor.name,
          terminated_at: endDate,
          termination_reason: endReason.trim() || null,
        },
        endFor.id,
      );
      setEndFor(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(false);
    }
  }

  const set = (patch: Partial<StaffInput>) => setForm({ ...form, ...patch });

  return (
    <>
      <PageHeader
        title="พนักงาน"
        hint="ทะเบียนพนักงาน เงินเดือน/ค่าแรงรายวัน"
        action={
          <Button icon={<Plus size={16} />} onClick={() => openForm(null)}>
            เพิ่มพนักงาน
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={showLeft}
              onChange={(e) => setShowLeft(e.target.checked)}
              className="size-4 accent-[#2563eb]"
            />
            แสดงคนที่พ้นสภาพแล้วด้วย
          </label>
          <Link
            to="/attendance"
            className="ml-auto text-sm font-medium text-accent hover:underline"
          >
            ลงเวลา & ลา →
          </Link>
          <Link
            to="/payroll"
            className="text-sm font-medium text-accent hover:underline"
          >
            เงินเดือน →
          </Link>
        </div>

        <DataTable<Staff>
          rows={rows}
          rowKey={(s) => s.id}
          empty="ยังไม่มีพนักงาน กดปุ่ม “เพิ่มพนักงาน” เพื่อเริ่ม"
          columns={[
            {
              header: "ชื่อ",
              cell: (s) => (
                <div>
                  <span className="font-medium text-ink">{s.name}</span>
                  {s.nickname && (
                    <span className="text-muted"> ({s.nickname})</span>
                  )}
                  {s.role && <p className="text-xs text-muted">{s.role}</p>}
                </div>
              ),
            },
            {
              header: "สิทธิ์",
              hideOnMobile: true,
              cell: (s) => (
                <span className="text-muted">
                  {accessRoleLabel(s.access_role)}
                </span>
              ),
            },
            { header: "เบอร์โทร", hideOnMobile: true, cell: (s) => s.phone },
            {
              header: "ค่าจ้าง",
              align: "right",
              cell: (s) => (
                <div>
                  <span className="tabular-nums">
                    {fmtBaht(s.pay_type === "รายวัน" ? s.daily_rate : s.salary)}
                  </span>
                  <p className="text-xs text-muted">{s.pay_type}</p>
                </div>
              ),
            },
            {
              header: "เริ่มงาน",
              hideOnMobile: true,
              cell: (s) => (s.start_date ? fmtDate(s.start_date) : "—"),
            },
            {
              header: "สถานะ",
              cell: (s) =>
                s.terminated_at ? (
                  <Badge tone="muted">พ้นสภาพ</Badge>
                ) : (
                  <Badge tone="ok">ทำงานอยู่</Badge>
                ),
            },
            {
              header: "",
              align: "right",
              cell: (s) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil size={14} />}
                    onClick={() => openForm(s)}
                  >
                    แก้ไข
                  </Button>
                  {!s.terminated_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<UserRoundX size={14} />}
                      onClick={() => {
                        setEndFor(s);
                        setEndDate(todayStr());
                        setEndReason("");
                      }}
                    >
                      พ้นสภาพ
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        wide
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={busy || !form.name?.trim()}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.name ?? ""}
                  onChange={(e) => set({ name: e.target.value })}
                />
              )}
            </Field>
            <Field label="ชื่อเล่น">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.nickname ?? ""}
                  onChange={(e) => set({ nickname: e.target.value })}
                />
              )}
            </Field>
            <Field label="ตำแหน่ง">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.role ?? ""}
                  onChange={(e) => set({ role: e.target.value })}
                  placeholder="เช่น คนขับรถส่งแก๊ส"
                />
              )}
            </Field>
            <Field
              label="สิทธิ์เข้าใช้ระบบ"
              hint={
                canEditRole
                  ? ACCESS_ROLES.find((r) => r.value === form.access_role)?.hint
                  : editing?.id === myStaffId
                    ? "แก้สิทธิ์ของตัวเองไม่ได้ ให้คนอื่นแก้ให้"
                    : "เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่แก้สิทธิ์นี้ได้"
              }
            >
              {(id) => (
                <Select
                  id={id}
                  value={form.access_role ?? "GENERAL"}
                  disabled={!canEditRole}
                  onChange={(e) =>
                    set({ access_role: e.target.value as AccessRole })
                  }
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="เบอร์โทร">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.phone ?? ""}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="จ่ายแบบไหน">
              {(id) => (
                <Select
                  id={id}
                  value={form.pay_type ?? "รายเดือน"}
                  onChange={(e) => set({ pay_type: e.target.value as PayType })}
                >
                  {PAY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {form.pay_type === "รายวัน" ? (
              <Field label="ค่าแรงต่อวัน">
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={form.daily_rate ?? ""}
                    onChange={(e) =>
                      set({ daily_rate: Number(e.target.value) })
                    }
                  />
                )}
              </Field>
            ) : (
              <Field label="เงินเดือน">
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={form.salary ?? ""}
                    onChange={(e) => set({ salary: Number(e.target.value) })}
                  />
                )}
              </Field>
            )}
            <Field label="วันเริ่มงาน">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={form.start_date ?? ""}
                  onChange={(e) => set({ start_date: e.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ธนาคาร" hint="ใช้ตอนโอนเงินเดือน">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.bank_name ?? ""}
                  onChange={(e) => set({ bank_name: e.target.value })}
                />
              )}
            </Field>
            <Field label="เลขที่บัญชี">
              {(id) => (
                <TextInput
                  id={id}
                  value={form.bank_account ?? ""}
                  onChange={(e) => set({ bank_account: e.target.value })}
                />
              )}
            </Field>
          </div>

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

          <Field label="หมายเหตุ">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={form.note ?? ""}
                onChange={(e) => set({ note: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!endFor}
        onClose={() => setEndFor(null)}
        title="บันทึกการพ้นสภาพ"
        hint="ประวัติทั้งหมดยังอยู่ แต่จะไม่เข้างวดเงินเดือนใหม่"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndFor(null)}>
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={submitEnd} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "ยืนยัน"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <p className="text-sm text-ink">{endFor?.name}</p>
          <Field label="วันสุดท้ายที่ทำงาน">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            )}
          </Field>
          <Field label="เหตุผล">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={endReason}
                onChange={(e) => setEndReason(e.target.value)}
                placeholder="เช่น ลาออกเอง"
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
