import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ACCESS_ROLES, accessRoleLabel, fmtDate } from "@/lib/constants";
import { useDerived } from "@/lib/useDerived";
import { useAuthStore } from "@/store/useAuthStore";
import { useUsersStore } from "@/store/useUsersStore";
import type { AccessRole, UUID, UserProfileRow } from "@/types";

const BLANK_NEW = {
  email: "",
  password: "",
  role: "GENERAL" as AccessRole,
  staff_id: "" as UUID | "",
};

export function UserManagementPage() {
  const { staff } = useDerived();
  const {
    users,
    loading,
    error,
    clearError,
    loadUsers,
    createUser,
    updateUser,
    resetPassword,
    deleteUser,
  } = useUsersStore();
  const myId = useAuthStore((s) => s.profile?.id ?? null);
  // สวมบทเป็นผู้จัดการแล้วต้องเห็นข้อจำกัดของผู้จัดการจริง ๆ ไม่งั้นทดสอบไม่มีความหมาย
  const myRole = useAuthStore((s) => s.simulatedRole ?? s.role);

  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(BLANK_NEW);
  const [editing, setEditing] = useState<UserProfileRow | null>(null);
  const [form, setForm] = useState<{ role: AccessRole; staff_id: UUID | "" }>({
    role: "GENERAL",
    staff_id: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<UserProfileRow | null>(null);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const isSuper = myRole === "SUPER_ADMIN";

  /** ผู้จัดการแตะบัญชีผู้ดูแลระบบสูงสุดไม่ได้ — กันยกตัวเองขึ้นเป็นเจ้าของ */
  function canManage(u: UserProfileRow) {
    return isSuper || u.role !== "SUPER_ADMIN";
  }

  const roleOptions = ACCESS_ROLES.filter(
    (r) => r.value !== "SUPER_ADMIN" || isSuper,
  );

  // พนักงานที่ยังไม่มีบัญชี + คนที่ผูกกับบัญชีที่กำลังแก้อยู่
  const linkable = staff.filter(
    (s) =>
      !s.terminated_at &&
      (!users.some((u) => u.staff_id === s.id) || s.id === editing?.staff_id),
  );

  function openEdit(u: UserProfileRow) {
    setEditing(u);
    setForm({ role: u.role, staff_id: u.staff_id ?? "" });
    setNewPassword("");
  }

  function openCreate() {
    clearError();
    setNewUser(BLANK_NEW);
    setCreating(true);
  }

  async function submitNew() {
    setBusy(true);
    try {
      await createUser({
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        staff_id: newUser.staff_id || null,
      });
      setCreating(false);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!editing) return;
    setBusy(true);
    try {
      await updateUser(editing.id, {
        role: form.role,
        staff_id: form.staff_id || null,
      });
      if (newPassword) await resetPassword(editing.id, newPassword);
      setEditing(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนแล้ว
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteUser(removing.id);
      setRemoving(null);
    } catch {
      // ข้อความผิดพลาดโชว์บนแถบเตือนแล้ว
    } finally {
      setBusy(false);
    }
  }

  // แก้สิทธิ์ตัวเองไม่ได้ (ฐานข้อมูลก็ปฏิเสธอยู่แล้ว) — กันเผลอตัดสิทธิ์ตัวเองจนเข้าไม่ได้
  const editingSelf = editing?.id === myId;
  const newUserValid =
    newUser.email.includes("@") && newUser.password.length >= 8;

  return (
    <>
      <PageHeader
        title="บัญชีผู้ใช้"
        hint="ใครเข้าระบบได้บ้าง และเข้าได้ถึงไหน"
        action={
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            เพิ่มบัญชี
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft p-3.5 text-sm text-ink">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="font-medium text-danger"
          >
            ปิด
          </button>
        </div>
      )}

      <Card>
        <DataTable<UserProfileRow>
          rows={users}
          rowKey={(u) => u.id}
          empty={loading ? "กำลังโหลด…" : "ยังไม่มีบัญชีผู้ใช้"}
          columns={[
            {
              header: "อีเมล",
              cell: (u) => (
                <div>
                  <span className="font-medium text-ink">{u.email ?? "—"}</span>
                  {u.id === myId && <span className="text-muted"> (คุณ)</span>}
                </div>
              ),
            },
            {
              header: "สิทธิ์",
              cell: (u) => (
                <Badge tone={u.role === "SUPER_ADMIN" ? "info" : "muted"}>
                  {accessRoleLabel(u.role)}
                </Badge>
              ),
            },
            {
              header: "ผูกกับพนักงาน",
              hideOnMobile: true,
              cell: (u) =>
                u.staff ? (
                  u.staff.name
                ) : (
                  <span className="text-muted">ยังไม่ได้ผูก</span>
                ),
            },
            {
              header: "เปิดใช้เมื่อ",
              hideOnMobile: true,
              cell: (u) => fmtDate(u.created_at),
            },
            {
              header: "",
              align: "right",
              cell: (u) => (
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Pencil size={14} />}
                    disabled={!canManage(u)}
                    onClick={() => openEdit(u)}
                  >
                    แก้ไข
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={14} />}
                    disabled={!canManage(u) || u.id === myId}
                    onClick={() => setRemoving(u)}
                  >
                    ลบ
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        title="แก้ไขบัญชี"
        hint={editing?.email ?? undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              บันทึก
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field
            label="สิทธิ์เข้าใช้ระบบ"
            hint={
              editingSelf
                ? "แก้สิทธิ์ของตัวเองไม่ได้ ให้ผู้ดูแลอีกคนแก้ให้"
                : ACCESS_ROLES.find((r) => r.value === form.role)?.hint
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.role}
                disabled={editingSelf}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as AccessRole })
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

          <Field
            label="ผูกกับพนักงาน"
            hint="ไว้ให้ระบบรู้ว่าบัญชีนี้คือใครในทะเบียนพนักงาน"
          >
            {(id) => (
              <Select
                id={id}
                value={form.staff_id}
                onChange={(e) =>
                  setForm({ ...form, staff_id: e.target.value as UUID | "" })
                }
              >
                <option value="">— ไม่ผูก —</option>
                {linkable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.nickname ? ` (${s.nickname})` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="ตั้งรหัสผ่านใหม่"
            hint="เว้นไว้ = ใช้รหัสเดิมต่อ · อย่างน้อย 8 ตัวอักษร"
          >
            {(id) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            )}
          </Field>
        </div>
      </Modal>

      <Modal
        open={creating}
        title="เพิ่มบัญชีผู้ใช้"
        hint="คนนี้จะเข้าระบบด้วยอีเมลและรหัสผ่านนี้ได้ทันที"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => void submitNew()}
              disabled={busy || !newUserValid}
            >
              สร้างบัญชี
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="อีเมล" hint="ใช้เป็นชื่อสำหรับเข้าระบบ">
            {(id) => (
              <TextInput
                id={id}
                type="email"
                autoComplete="off"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                placeholder="somchai@jamareegas.com"
              />
            )}
          </Field>

          <Field
            label="รหัสผ่าน"
            hint="อย่างน้อย 8 ตัวอักษร · บอกเจ้าตัวไปเปลี่ยนทีหลังได้"
          >
            {(id) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="new-password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
            )}
          </Field>

          <Field
            label="สิทธิ์เข้าใช้ระบบ"
            hint={ACCESS_ROLES.find((r) => r.value === newUser.role)?.hint}
          >
            {(id) => (
              <Select
                id={id}
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    role: e.target.value as AccessRole,
                  })
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

          <Field
            label="ผูกกับพนักงาน"
            hint="ไว้ให้ระบบรู้ว่าบัญชีนี้คือใครในทะเบียนพนักงาน"
          >
            {(id) => (
              <Select
                id={id}
                value={newUser.staff_id}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    staff_id: e.target.value as UUID | "",
                  })
                }
              >
                <option value="">— ไม่ผูก —</option>
                {linkable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.nickname ? ` (${s.nickname})` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!removing}
        title="ลบบัญชีนี้?"
        onClose={() => setRemoving(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmRemove()}
              disabled={busy}
            >
              ลบบัญชี
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 text-sm text-ink">
          <UserCog size={18} className="mt-0.5 shrink-0 text-danger" />
          <p>
            {removing?.email} จะถูกลบออกจากระบบถาวร เข้าสู่ระบบไม่ได้อีก ·
            ทะเบียนพนักงานและประวัติการทำงานไม่ถูกลบ
          </p>
        </div>
      </Modal>
    </>
  );
}
