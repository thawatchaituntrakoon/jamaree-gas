import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AccessRole, Staff } from "@/types";

/**
 * ใครกำลังใช้งานอยู่ + เปิดอะไรได้บ้าง
 * บัญชีล็อกอิน (auth.users) ผูกกับแถวพนักงานผ่าน staff.user_id — สิทธิ์อ่านจาก staff.access_role
 */
interface AuthState {
  session: Session | null;
  /** แถวพนักงานของคนที่ล็อกอินอยู่ — null = ยังไม่ได้ผูกบัญชีไว้กับพนักงานคนไหน */
  profile: Staff | null;
  role: AccessRole;
  /** เช็คว่าล็อกอินอยู่ไหมเสร็จแล้ว */
  ready: boolean;
  /** รู้สิทธิ์แล้ว — ก่อนหน้านี้ห้ามตัดสินว่าใครเข้าหน้าไหนได้ */
  roleReady: boolean;
  /** ล็อกอินผ่าน แต่ไม่มีแถวพนักงานผูกไว้ (หรือถูกบันทึกว่าพ้นสภาพแล้ว) */
  unlinked: boolean;
  error: string | null;
  init: () => () => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  can: (roles?: readonly AccessRole[]) => boolean;
}

const GUEST = {
  profile: null,
  role: "GENERAL" as AccessRole,
  roleReady: false,
  unlinked: false,
  error: null,
};

// กันสมัครฟังซ้ำตอน React เรียก effect สองรอบใน StrictMode
let subscribed = false;

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
      .from("staff")
      .select("*")
      .eq("user_id", user.id)
      .is("terminated_at", null)
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

    const profile = (data as Staff | null) ?? null;
    set({
      profile,
      role: profile?.access_role ?? "GENERAL",
      roleReady: true,
      unlinked: !profile,
      error: null,
    });
  },

  async signOut() {
    set({ ...GUEST, roleReady: true });
    await supabase.auth.signOut();
  },

  can(roles) {
    // เปิดไฟล์ใช้เองแบบไม่ต่อฐานข้อมูล — ไม่มีบัญชี ก็ไม่มีอะไรให้กั้น
    if (!isSupabaseConfigured) return true;
    if (!roles || roles.length === 0) return true;
    return roles.includes(get().role);
  },
}));
