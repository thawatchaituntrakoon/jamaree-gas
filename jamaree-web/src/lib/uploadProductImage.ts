import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/uid";

const BUCKET = "product-images";
const MAX_BYTES = 3 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * อัปโหลดรูปสินค้าแล้วคืนลิงก์รูป
 * ด่านตรวจชนิด/ขนาดไฟล์ฝั่งนี้ไว้บอกเจ้าของเร็ว ๆ — ตัวจริงที่กันคือถังเก็บใน Supabase
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!OK_TYPES.includes(file.type)) {
    throw new Error("ไฟล์ต้องเป็นรูปภาพ (JPG, PNG, WEBP หรือ GIF)");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("รูปใหญ่เกิน 3 MB — ย่อรูปก่อนแล้วลองใหม่");
  }

  // ตั้งชื่อไฟล์ใหม่เองเสมอ ไม่เอาชื่อเดิมจากเครื่องผู้ใช้ (กันชื่อซ้ำและอักขระแปลก ๆ)
  const ext = OK_TYPES.indexOf(file.type) === 0 ? "jpg" : file.type.slice(6);
  const path = `${uid()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
