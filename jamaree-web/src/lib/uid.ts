type Uuid = `${string}-${string}-${string}-${string}-${string}`;

/** สร้างรหัสสุ่มเองแบบ UUID v4 — ใช้ตอนเบราว์เซอร์ไม่มี crypto.randomUUID ให้ */
function fallbackUuid(): Uuid {
  const bytes = new Uint8Array(16);

  // getRandomValues ใช้ได้ทุกกรณี (ไม่ถูกจำกัดเหมือน randomUUID)
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // เวอร์ชัน 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** รหัสชั่วคราวของแถวในฟอร์ม (ไม่ได้ส่งขึ้นฐานข้อมูล) */
export function uid(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : fallbackUuid();
}

/**
 * ⭐ เบราว์เซอร์จะซ่อน crypto.randomUUID ถ้าเปิดเว็บผ่าน http ธรรมดา
 *    (มีให้เฉพาะ https หรือ localhost) — เปิดจากไอพีเครื่องเซิร์ฟเวอร์จึงพัง
 *    ไลบรารีข้างนอก (เช่น supabase) เรียกตัวนี้ตรง ๆ เลยต้องเติมให้ก่อนแอปเริ่มทำงาน
 */
export function installUuidFallback() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID !== "function") {
    Object.defineProperty(c, "randomUUID", {
      value: fallbackUuid,
      configurable: true,
      writable: true,
    });
  }
}
