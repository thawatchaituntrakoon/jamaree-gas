import { create } from "zustand";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AccessRole, UUID, UserProfileRow } from "@/types";

const SELECT = "*, staff:staff_id(id, name, nickname)";
const ADMIN_FN = "admin-users";

export interface NewUserInput {
  email: string;
  password: string;
  role: AccessRole;
  staff_id: UUID | null;
}

interface UsersState {
  users: UserProfileRow[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  loadUsers: () => Promise<void>;
  createUser: (input: NewUserInput) => Promise<void>;
  updateUser: (
    id: UUID,
    patch: { role?: AccessRole; staff_id?: UUID | null },
  ) => Promise<void>;
  resetPassword: (id: UUID, password: string) => Promise<void>;
  deleteUser: (id: UUID) => Promise<void>;
}

function toMessage(err: unknown): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : "";
  // RLS ปฏิเสธจะเงียบ ๆ แบบ 0 แถว ไม่ได้โยน error — ที่โผล่มาส่วนใหญ่คือ trigger กันล็อกตัวเอง
  if (raw.includes("ผู้ดูแลระบบสูงสุด")) return raw;
  return raw || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

/**
 * เรียกฟังก์ชันฝั่งเซิร์ฟเวอร์ที่ถือกุญแจ service_role
 * (สร้างผู้ใช้จากหน้าเว็บตรง ๆ ด้วย signUp ไม่ได้ เพราะจะเตะคนที่กำลังใช้งานอยู่ออกจากระบบ)
 */
async function callAdmin<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(ADMIN_FN, {
    body: payload,
  });
  if (!error) return data as T;

  // ข้อความภาษาไทยที่ฟังก์ชันส่งกลับมาอยู่ใน body ไม่ได้อยู่ใน error.message
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.error || "ทำรายการไม่สำเร็จ");
  }
  throw new Error(
    "เรียกระบบจัดการบัญชีไม่ได้ — ตรวจว่าได้ติดตั้งฟังก์ชัน admin-users บน Supabase แล้วหรือยัง",
  );
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  async loadUsers() {
    set({ loading: true });
    const { data, error } = await supabase
      .from("user_profiles")
      .select(SELECT)
      .order("created_at");

    if (error) {
      set({ loading: false, error: toMessage(error) });
      return;
    }
    set({ users: (data ?? []) as UserProfileRow[], loading: false });
  },

  async createUser(input) {
    try {
      const { user } = await callAdmin<{ user: UserProfileRow }>({
        action: "create",
        email: input.email,
        password: input.password,
        role: input.role,
        staff_id: input.staff_id,
      });
      set({ users: [...get().users, user] });
    } catch (err) {
      set({ error: toMessage(err) });
      throw err;
    }
  },

  async updateUser(id, patch) {
    const { data, error } = await supabase
      .from("user_profiles")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      set({ error: toMessage(error) });
      throw error;
    }
    // RLS บล็อกแล้วจะไม่มีแถวกลับมา แต่ก็ไม่ฟ้อง error — ต้องดักเอง ไม่งั้นหน้าจอโชว์ว่าสำเร็จ
    if (!data) {
      const message = "ไม่มีสิทธิ์แก้บัญชีนี้";
      set({ error: message });
      throw new Error(message);
    }

    set({
      users: get().users.map((u) =>
        u.id === id ? (data as UserProfileRow) : u,
      ),
    });
  },

  async resetPassword(id, password) {
    try {
      await callAdmin({ action: "reset_password", user_id: id, password });
    } catch (err) {
      set({ error: toMessage(err) });
      throw err;
    }
  },

  // ลบผ่านฝั่งเซิร์ฟเวอร์ เพื่อให้ auth.users หายไปด้วย ไม่งั้นเจ้าของบัญชียังล็อกอินเข้ามาได้อยู่
  async deleteUser(id) {
    try {
      await callAdmin({ action: "delete", user_id: id });
      set({ users: get().users.filter((u) => u.id !== id) });
    } catch (err) {
      set({ error: toMessage(err) });
      throw err;
    }
  },
}));
