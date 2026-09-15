import type { IExpanded } from "thai-address-universal";

/** ที่อยู่ส่วนที่เลือกจากทะเบียนราษฎร์ — ส่วนบ้านเลขที่/ถนน แยกเก็บที่ฟอร์มเอง */
export interface ThaiAddressParts {
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

export const EMPTY_ADDRESS: ThaiAddressParts = {
  subDistrict: "",
  district: "",
  province: "",
  postalCode: "",
};

/** พิมพ์สั้นกว่านี้ยังไม่ต้องค้น — ผลลัพธ์จะเยอะเกินจนไม่ช่วยอะไร */
export const ADDRESS_MIN_CHARS = 2;

const MAX_SUGGESTIONS = 8;
/** ขอเผื่อไว้ก่อน เพราะหลายแถวซ้ำกันหลังตัดรหัสไปรษณีย์ที่ใช้ร่วมกัน */
const SEARCH_LIMIT = 24;

type ThaiAddressModule = typeof import("thai-address-universal");

let modulePromise: Promise<ThaiAddressModule> | null = null;

// โหลดตอนใช้จริงเท่านั้น — ตัวไลบรารีกับข้อมูลรวมกันเกือบ 300KB ไม่ควรติดไปกับบันเดิลหลัก
function loadModule(): Promise<ThaiAddressModule> {
  modulePromise ??= import("thai-address-universal");
  return modulePromise;
}

/** ดึงข้อมูลมารอไว้ตอนเปิดฟอร์ม จะได้ไม่ต้องรอตอนพิมพ์ตัวแรก */
export function warmThaiAddress(): void {
  void loadModule()
    .then((lib) => lib.preload())
    .catch(() => {});
}

function toParts(row: IExpanded): ThaiAddressParts {
  return {
    subDistrict: row.sub_district ?? "",
    district: row.district ?? "",
    province: row.province ?? "",
    postalCode: row.postal_code ?? "",
  };
}

function partsKey(p: ThaiAddressParts): string {
  return [p.subDistrict, p.district, p.province, p.postalCode].join("|");
}

export function isAddressBlank(p: ThaiAddressParts): boolean {
  return !p.subDistrict && !p.district && !p.province && !p.postalCode;
}

/** ค้นทะเบียนที่อยู่จากช่องที่กำลังพิมพ์ — คืนชุดที่อยู่เต็ม 4 ส่วนเสมอ */
export async function searchAddress(
  field: keyof ThaiAddressParts,
  term: string,
): Promise<ThaiAddressParts[]> {
  const q = term.trim();
  if (q.length < ADDRESS_MIN_CHARS) return [];

  const lib = await loadModule();
  let rows: IExpanded[];
  switch (field) {
    case "subDistrict":
      rows = await lib.searchAddressBySubDistrict(q, SEARCH_LIMIT);
      break;
    case "district":
      rows = await lib.searchAddressByDistrict(q, SEARCH_LIMIT);
      break;
    case "province":
      rows = await lib.searchAddressByProvince(q, SEARCH_LIMIT);
      break;
    case "postalCode":
      rows = await lib.searchAddressByPostalCode(q, SEARCH_LIMIT);
      break;
  }

  const seen = new Set<string>();
  const out: ThaiAddressParts[] = [];
  for (const row of rows) {
    const parts = toParts(row);
    const key = partsKey(parts);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parts);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * แยกที่อยู่ก้อนเดียวที่เก็บไว้เดิมออกเป็นบ้านเลขที่ + ตำบล/อำเภอ/จังหวัด/ไปรษณีย์
 * แยกไม่ออก (ที่อยู่เก่าที่ไม่มีรหัสไปรษณีย์) ให้คืนข้อความเดิมทั้งก้อน ห้ามทำข้อมูลหาย
 */
export async function parseAddress(
  full: string | null | undefined,
): Promise<{ street: string; parts: ThaiAddressParts }> {
  const text = (full ?? "").trim();
  if (!text) return { street: "", parts: EMPTY_ADDRESS };

  try {
    const lib = await loadModule();
    const hit = await lib.splitAddress(text);
    if (hit) return { street: (hit.address ?? "").trim(), parts: toParts(hit) };
  } catch {
    // แยกไม่ได้ก็ไม่เป็นไร ตกไปใช้ข้อความเดิมด้านล่าง
  }
  return { street: text, parts: EMPTY_ADDRESS };
}

/** ประกอบกลับเป็นที่อยู่บรรทัดเดียวสำหรับเก็บลงฐานข้อมูล (กทม. จะใช้ แขวง/เขต ให้เอง) */
export async function composeAddress(
  street: string,
  parts: ThaiAddressParts,
): Promise<string> {
  const line = street.trim();
  if (isAddressBlank(parts)) return line;

  const lib = await loadModule();
  return lib.formatAddress({
    address: line,
    subDistrict: parts.subDistrict.trim(),
    district: parts.district.trim(),
    province: parts.province.trim(),
    postalCode: parts.postalCode.trim(),
  });
}
