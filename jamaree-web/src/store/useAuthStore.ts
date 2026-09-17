import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AccessRole, UserProfileRow } from "@/types";

/**
 * ใครกำลังใช้งานอยู่ + เปิดอะไรได้บ้าง
 * บัญชีล็อกอิน (auth.users) → user_profiles → ผูกกับทะเบียนพนักงานผ่าน staff_id (จะว่างก็ได้)
 */
interface AuthState {
  session: Session | null;
  /** บัญชีของคนที่ล็อกอินอยู่ */
  profile: UserProfileRow | null;
  /** สิทธิ์จริงของบัญชีนี้ — ไม่เปลี่ยนตอนสวมบทดู */
  role: AccessRole;
  /** กำลังสวมบทเป็นสิทธิ์ไหนอยู่ (เฉพาะผู้ดูแลระบบสูงสุด) */
  simulatedRole: AccessRole | null;
  /** เช็คว่าล็อกอินอยู่ไหมเสร็จแล้ว */
  ready: boolean;
  /** รู้สิทธิ์แล้ว — ก่อนหน้านี้ห้ามตัดสินว่าใครเข้าหน้าไหนได้ */
  roleReady: boolean;
  /** ล็อกอินผ่าน แต่ไม่มีแถวบัญชีในระบบ */
  unlinked: boolean;
  error: string | null;
  init: () => () => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setSimulatedRole: (role: AccessRole | null) => void;
  /** สิทธิ์ที่หน้าจอใช้ตัดสินจริง */
  effectiveRole: () => AccessRole;
  can: (roles?: readonly AccessRole[]) => boolean;
}

const GUEST = {
  profile: null,
  role: "GENERAL" as AccessRole,
  simulatedRole: null,
  roleReady: false,
  unlinked: false,
  error: null,
};

// กันสมัครฟังซ้ำตอน React เรียก effect สองรอบใน StrictMode
let subscribed = false;

/** เช็คสิทธิ์แบบไม่ผ่าน store — คอมโพเนนต์ที่ subscribe สิทธิ์ไว้เองให้ใช้ตัวนี้ จะได้วาดใหม่ตอนสลับมุมมอง */
export function roleAllowed(
  role: AccessRole,
  roles?: readonly AccessRole[],
): boolean {
  // เปิดไฟล์ใช้เองแบบไม่ต่อฐานข้อมูล — ไม่มีบัญชี ก็ไม่มีอะไรให้กั้น
  if (!isSupabaseConfigured) return true;
  if (!roles || roles.length === 0) return true;
  return roles.includes(role);
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  ...GUEST,
  // ไม่ได้ต่อฐานข้อมูล = ไม่มีระบบล็อกอินให้รอ
  ready: !isSupabaseConfigured,

  init() {
    if (!isSupabaseConfigured || subscribed) return () => {};
    subscribed = true;

    void supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, ready: true });
      if (data.session) void get().loadProfile();
      else set({ ...GUEST, roleReady: true });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const prev = get().session;
      set({ session: next, ready: true });

      if (!next) {
        set({ ...GUEST, roleReady: true });
        return;
      }
      // ต่ออายุโทเค็นเฉย ๆ ไม่ต้องไปโหลดโปรไฟล์ใหม่
      if (prev?.user.id === next.user.id && get().roleReady) return;

      // ⚠️ ห้ามเรียก supabase ตรง ๆ ในคอลแบ็กนี้ — มันถือล็อกของ auth อยู่ แล้วจะค้างกันเอง
      setTimeout(() => void get().loadProfile(), 0);
    });

    return () => {
      data.subscription.unsubscribe();
      subscribed = false;
    };
  },

  async loadProfile() {
    const user = get().session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*, staff:staff_id(id, name, nickname)")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      // อ่านสิทธิ์ไม่ได้ = ให้สิทธิ์น้อยสุดไว้ก่อน ไม่ใช่ปล่อยผ่าน
      set({
        ...GUEST,
        roleReady: true,
        error: "อ่านสิทธิ์การใช้งานไม่สำเร็จ ลองเข้าสู่ระบบใหม่อีกครั้ง",
      });
      return;
    }

    const profile = (data as UserProfileRow | null) ?? null;
    set({
      profile,
      role: profile?.role ?? "GENERAL",
      simulatedRole: null,
      roleReady: true,
      unlinked: !profile,
      error: null,
    });
  },

  async signOut() {
    set({ ...GUEST, roleReady: true });
    await supabase.auth.signOut();
  },

  setSimulatedRole(role) {
    // คนที่ไม่ใช่ผู้ดูแลระบบสูงสุดสวมบทไม่ได้ — ไม่งั้นสวมเป็นสิทธิ์ที่สูงขึ้นก็ได้
    if (get().role !== "SUPER_ADMIN") return;
    set({ simulatedRole: role === get().role ? null : role });
  },

  effectiveRole() {
    return get().simulatedRole ?? get().role;
  },

  can(roles) {
    return roleAllowed(get().effectiveRole(), roles);
  },
}));
