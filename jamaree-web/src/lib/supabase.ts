import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * ตั้งค่าเชื่อมต่อฐานข้อมูลครบหรือยัง
 * ถ้ายัง — แอปยังเปิดดูหน้าตาได้ตามปกติ แต่จะไม่ดึงข้อมูลจริง และขึ้นคำแนะนำให้ตั้งค่าก่อน
 * (ตั้งใจไม่ throw ตอนโหลดไฟล์ เพราะจะทำให้จอขาวทั้งหน้าจนดูอะไรไม่ได้เลย)
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("xxxxxxxxxxxx") &&
  supabaseAnonKey !== "your-anon-key-here",
);

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseAnonKey || "ยังไม่ได้ตั้งค่า",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
