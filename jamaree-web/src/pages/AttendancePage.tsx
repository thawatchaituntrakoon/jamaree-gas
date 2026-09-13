import { useMemo, useState } from "react";
import { CalendarDays, Check, LogIn, LogOut, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtDate, todayStr } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import type { Leave, LeaveStatus, Staff, UUID } from "@/types";

type Tab = "today" | "logs" | "leaves";

function nowTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hhmm(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

/** จำนวนวันลา (นับรวมวันแรกและวันสุดท้าย) */
function daysBetween(from: string, to: string) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
  return Math.round((b - a) / 86400000) + 1;
}

function leaveTone(status: LeaveStatus) {
  if (status === "อนุมัติ") return "ok" as const;
  if (status === "ไม่อนุมัติ") return "danger" as const;
  return "warn" as const;
}

export function AttendancePage() {
  const { activeStaff, staffName, timelogs, leaves, leaveUsed } = useDerived();
  const leaveTypes = useAppStore((s) => s.leaveTypes);
  const settings = useAppStore((s) => s.settings);
  const saveTimeLog = useAppStore((s) => s.saveTimeLog);
  const saveLeave = useAppStore((s) => s.saveLeave);
  const deleteLeave = useAppStore((s) => s.deleteLeave);

  const [tab, setTab] = useState<Tab>("today");
  const [busy, setBusy] = useState<UUID | "form" | null>(null);
  const today = todayStr();
  const workStart = settings?.work_start ?? "09:00";

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editing, setEditing] = useState<Leave | null>(null);
  const [staffId, setStaffId] = useState<UUID | "">("");
  const [leaveType, setLeaveType] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [note, setNote] = useState("");

  const logToday = useMemo(() => {
    const map = new Map(
      timelogs.filter((t) => t.date === today).map((t) => [t.staff_id, t]),
    );
    return map;
  }, [timelogs, today]);

  const days = daysBetween(from, to);

  async function punch(s: Staff, kind: "in" | "out") {
    setBusy(s.id);
    try {
      const cur = logToday.get(s.id);
      await saveTimeLog({
        staff_id: s.id,
        date: today,
        in_at: kind === "in" ? nowTime() : (cur?.in_at ?? null),
        out_at: kind === "out" ? nowTime() : (cur?.out_at ?? null),
      });
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(null);
    }
  }

  function openLeave(l: Leave | null) {
    setEditing(l);
    setStaffId(l?.staff_id ?? "");
    setLeaveType(l?.type ?? leaveTypes[0]?.name ?? "");
    setFrom(l?.date_from ?? today);
    setTo(l?.date_to ?? today);
    setNote(l?.note ?? "");
    setLeaveOpen(true);
  }

  async function submitLeave() {
    if (!staffId || !leaveType) return;
    setBusy("form");
    try {
      await saveLeave(
        {
          staff_id: staffId,
          type: leaveType,
          date_from: from,
          date_to: to,
          days,
          note: note.trim() || null,
        },
        editing?.id,
      );
      setLeaveOpen(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(null);
    }
  }

  async function setLeaveStatus(l: Leave, status: LeaveStatus) {
    setBusy(l.id);
    try {
      await saveLeave(
        {
          staff_id: l.staff_id,
          type: l.type,
          date_from: l.date_from,
          date_to: l.date_to,
          status,
        },
        l.id,
      );
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนด้านบนแล้ว
    } finally {
      setBusy(null);
    }
  }

  const TABS: Array<[Tab, string]> = [
    ["today", "ลงเวลาวันนี้"],
    ["logs", "ประวัติลงเวลา"],
    ["leaves", "การลา"],
  ];

  return (
    <>
      <PageHeader
        title="ลงเวลา & ลา"
        hint={`เวลาเข้างาน ${workStart} น. — เข้าหลังเวลานี้นับว่าสาย`}
        action={
          tab === "leaves" ? (
            <Button
              icon={<Plus size={16} />}
              onClick={() => openLeave(null)}
              disabled={!activeStaff.length || !leaveTypes.length}
            >
              บันทึกการลา
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="flex flex-wrap gap-1 border-b border-line p-3">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-btn px-3 py-1.5 text-sm ${
                tab === key
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <DataTable<Staff>
            rows={activeStaff}
            rowKey={(s) => s.id}
            empty="ยังไม่มีพนักงาน เพิ่มที่หน้าพนักงานก่อน"
            columns={[
              {
                header: "พนักงาน",
                cell: (s) => (
                  <span className="font-medium text-ink">
                    {s.nickname || s.name}
                  </span>
                ),
              },
              {
                header: "เข้า",
                align: "right",
                cell: (s) => {
                  const t = logToday.get(s.id);
                  const late = !!t?.in_at && t.in_at.slice(0, 5) > workStart;
                  return (
                    <span
                      className={`tabular-nums ${late ? "font-medium text-warn" : ""}`}
                    >
                      {hhmm(t?.in_at ?? null)}
                      {late && " (สาย)"}
                    </span>
                  );
                },
              },
              {
                header: "ออก",
                align: "right",
                cell: (s) => (
                  <span className="tabular-nums">
                    {hhmm(logToday.get(s.id)?.out_at ?? null)}
                  </span>
                ),
              },
              {
                header: "",
                align: "right",
                cell: (s) => {
                  const t = logToday.get(s.id);
                  return (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant={t?.in_at ? "ghost" : "ok"}
                        size="sm"
                        icon={<LogIn size={14} />}
                        disabled={busy === s.id}
                        onClick={() => punch(s, "in")}
                      >
                        เข้างาน
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<LogOut size={14} />}
                        disabled={busy === s.id || !t?.in_at}
                        onClick={() => punch(s, "out")}
                      >
                        เลิกงาน
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
        )}

        {tab === "logs" && (
          <DataTable
            rows={timelogs.slice(0, 200)}
            rowKey={(t) => t.id}
            empty="ยังไม่มีประวัติลงเวลา"
            columns={[
              { header: "วันที่", cell: (t) => fmtDate(t.date) },
              { header: "พนักงาน", cell: (t) => staffName(t.staff_id) },
              {
                header: "เข้า",
                align: "right",
                cell: (t) => hhmm(t.in_at),
              },
              {
                header: "ออก",
                align: "right",
                cell: (t) => hhmm(t.out_at),
              },
            ]}
          />
        )}

        {tab === "leaves" && (
          <DataTable<Leave>
            rows={leaves}
            rowKey={(l) => l.id}
            empty="ยังไม่มีรายการลา"
            columns={[
              {
                header: "พนักงาน",
                cell: (l) => (
                  <div>
                    <span className="font-medium text-ink">
                      {staffName(l.staff_id)}
                    </span>
                    <p className="text-xs text-muted">
                      {l.type} · ใช้ไปแล้วปีนี้ {leaveUsed(l.staff_id, l.type)}{" "}
                      วัน
                    </p>
                  </div>
                ),
              },
              {
                header: "ช่วงวันที่",
                hideOnMobile: true,
                cell: (l) =>
                  l.date_from === l.date_to
                    ? fmtDate(l.date_from)
                    : `${fmtDate(l.date_from)} – ${fmtDate(l.date_to)}`,
              },
              {
                header: "จำนวนวัน",
                align: "right",
                cell: (l) => `${l.days} วัน`,
              },
              {
                header: "สถานะ",
                cell: (l) => (
                  <Badge tone={leaveTone(l.status)}>{l.status}</Badge>
                ),
              },
              {
                header: "",
                align: "right",
                cell: (l) => (
                  <div className="flex justify-end gap-1">
                    {l.status === "ขอ" && (
                      <>
                        <Button
                          variant="ok"
                          size="sm"
                          icon={<Check size={14} />}
                          disabled={busy === l.id}
                          onClick={() => setLeaveStatus(l, "อนุมัติ")}
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<X size={14} />}
                          disabled={busy === l.id}
                          onClick={() => setLeaveStatus(l, "ไม่อนุมัติ")}
                        >
                          ไม่อนุมัติ
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === l.id}
                      onClick={() => deleteLeave(l.id).catch(() => {})}
                    >
                      ลบ
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={editing ? "แก้ไขการลา" : "บันทึกการลา"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitLeave}
              disabled={busy === "form" || !staffId || !leaveType}
            >
              {busy === "form" ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="พนักงาน">
            {(id) => (
              <Select
                id={id}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              >
                <option value="">เลือกพนักงาน</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="ประเภทการลา"
            hint={
              staffId && leaveType
                ? `ใช้ไปแล้วปีนี้ ${leaveUsed(staffId, leaveType)} วัน จากโควตา ${
                    leaveTypes.find((t) => t.name === leaveType)?.quota_days ??
                    0
                  } วัน`
                : undefined
            }
          >
            {(id) => (
              <Select
                id={id}
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ตั้งแต่วันที่">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (e.target.value > to) setTo(e.target.value);
                  }}
                />
              )}
            </Field>
            <Field label="ถึงวันที่">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              )}
            </Field>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays size={14} /> รวม {days} วัน
          </p>
          <Field label="หมายเหตุ">
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
