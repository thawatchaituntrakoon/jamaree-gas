/**
 * admin-users — สร้าง / ตั้งรหัสผ่านใหม่ / ลบบัญชีผู้ใช้
 *
 * ต้องรันฝั่งเซิร์ฟเวอร์เพราะใช้กุญแจ service_role ซึ่งข้ามสิทธิ์ทุกอย่างในฐานข้อมูล
 * ⚠️ ห้ามเอากุญแจนี้ไปไว้ในหน้าเว็บเด็ดขาด ใครเปิด DevTools ก็เห็น
 *
 * เหตุผลที่ต้องมีไฟล์นี้: ถ้าเรียก supabase.auth.signUp จากหน้าเว็บ
 * Supabase จะสลับ session เป็นผู้ใช้ใหม่ทันที = แอดมินที่กำลังสร้างบัญชีหลุดออกจากระบบ
 *
 * ติดตั้ง:  supabase functions deploy admin-users
 * (SUPABASE_URL กับ SUPABASE_SERVICE_ROLE_KEY ทาง Supabase ใส่ให้เองอัตโนมัติ)
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const ROLES = [
  "SUPER_ADMIN",
  "MANAGER",
  "FINANCE",
  "SALES",
  "DELIVERY",
  "FILLER",
  "GENERAL",
] as const;
type Role = (typeof ROLES)[number];

const PROFILE_SELECT = "*, staff:staff_id(id, name, nickname)";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("ใช้ได้เฉพาะ POST", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey)
    return fail("ยังไม่ได้ตั้งค่ากุญแจฝั่งเซิร์ฟเวอร์", 500);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ตรวจว่าใครเรียกมา แล้วอ่านสิทธิ์จากฐานข้อมูลเอง — ไม่เชื่อ role ที่หน้าเว็บส่งมาเด็ดขาด
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("ต้องเข้าสู่ระบบก่อน", 401);

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user) return fail("ต้องเข้าสู่ระบบก่อน", 401);

  const { data: me } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", caller.user.id)
    .maybeSingle();

  const myRole = (me?.role ?? "GENERAL") as Role;
  if (myRole !== "SUPER_ADMIN" && myRole !== "MANAGER") {
    return fail("ไม่มีสิทธิ์จัดการบัญชีผู้ใช้", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }

  const password = typeof body.password === "string" ? body.password : "";
  const userId = typeof body.user_id === "string" ? body.user_id : "";

  /** ผู้จัดการแตะบัญชีผู้ดูแลระบบสูงสุดไม่ได้ — กันยกตัวเองขึ้นเป็นเจ้าของ */
  async function blockedTarget(id: string) {
    if (myRole === "SUPER_ADMIN") return null;
    const { data } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();
    return data?.role === "SUPER_ADMIN"
      ? fail("เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่แก้บัญชีนี้ได้", 403)
      : null;
  }

  switch (body.action) {
    case "create": {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      if (!EMAIL_RE.test(email)) return fail("อีเมลไม่ถูกต้อง");
      if (password.length < 8)
        return fail("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");

      const role: Role = isRole(body.role) ? body.role : "GENERAL";
      if (role === "SUPER_ADMIN" && myRole !== "SUPER_ADMIN") {
        return fail("เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่ตั้งสิทธิ์นี้ได้", 403);
      }
      const staffId = typeof body.staff_id === "string" ? body.staff_id : null;

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !created.user) {
        const msg = error?.message ?? "";
        return fail(
          /already|registered|exists/i.test(msg)
            ? "อีเมลนี้มีบัญชีอยู่แล้ว"
            : `สร้างบัญชีไม่สำเร็จ: ${msg}`,
        );
      }

      // ทริกเกอร์ในฐานข้อมูลสร้างแถวให้แล้วด้วยสิทธิ์ต่ำสุดเสมอ ตรงนี้ค่อยยกระดับตามที่สั่ง
      const { data: profile, error: upErr } = await admin
        .from("user_profiles")
        .upsert({ id: created.user.id, email, role, staff_id: staffId })
        .select(PROFILE_SELECT)
        .maybeSingle();

      if (upErr) {
        // ตั้งสิทธิ์ไม่ผ่าน = ถอยทั้งหมด ไม่ปล่อยบัญชีค้างที่ล็อกอินได้แต่ไม่มีสิทธิ์
        await admin.auth.admin.deleteUser(created.user.id);
        return fail(
          `ตั้งสิทธิ์ไม่สำเร็จ ยกเลิกการสร้างบัญชีแล้ว: ${upErr.message}`,
        );
      }
      return json({ user: profile });
    }

    case "reset_password": {
      if (!userId) return fail("ไม่พบบัญชีที่ต้องการแก้");
      if (password.length < 8)
        return fail("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");

      const blocked = await blockedTarget(userId);
      if (blocked) return blocked;

      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
      });
      if (error) return fail(`ตั้งรหัสผ่านใหม่ไม่สำเร็จ: ${error.message}`);
      return json({ ok: true });
    }

    case "delete": {
      if (!userId) return fail("ไม่พบบัญชีที่ต้องการลบ");
      if (userId === caller.user.id) return fail("ลบบัญชีของตัวเองไม่ได้");

      const blocked = await blockedTarget(userId);
      if (blocked) return blocked;

      // ลบ auth.users แล้วแถวใน user_profiles จะถูกลบตาม (on delete cascade)
      // ถ้าเป็นผู้ดูแลระบบสูงสุดคนสุดท้าย ทริกเกอร์จะขวางไว้ แล้วการลบทั้งก้อนจะล้มเหลว
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        const msg = error.message ?? "";
        return fail(
          msg.includes("ผู้ดูแลระบบสูงสุด")
            ? "ต้องเหลือผู้ดูแลระบบสูงสุดอย่างน้อย 1 คนเสมอ"
            : `ลบบัญชีไม่สำเร็จ: ${msg}`,
        );
      }
      return json({ ok: true });
    }

    default:
      return fail("ไม่รู้จักคำสั่งนี้");
  }
});
