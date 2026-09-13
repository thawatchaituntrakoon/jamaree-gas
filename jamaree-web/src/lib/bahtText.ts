/**
 * แปลงตัวเลขเป็นตัวอักษรไทย เช่น 1250.50 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์"
 * ใช้บนใบกำกับภาษี/ใบเสร็จ — ยกสูตรมาจากระบบเดิมทั้งดุ้น ห้ามแก้ผลลัพธ์
 */
const DIGITS = [
  "",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
];
const POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function numText(input: string): string {
  if (!input || input === "0") return "";

  const chunks: string[] = [];
  let rest = input;
  while (rest.length > 0) {
    chunks.unshift(rest.slice(-6));
    rest = rest.slice(0, -6);
  }

  let out = "";
  chunks.forEach((chunk, ci) => {
    const isLast = ci === chunks.length - 1;
    const digits = chunk.split("").map(Number);
    const len = digits.length;
    let text = "";

    digits.forEach((d, i) => {
      if (d === 0) return;
      const posFromRight = len - 1 - i;
      if (posFromRight === 0) {
        text += d === 1 && len > 1 ? "เอ็ด" : DIGITS[d];
      } else if (posFromRight === 1) {
        text += d === 1 ? "สิบ" : d === 2 ? "ยี่สิบ" : DIGITS[d] + "สิบ";
      } else {
        text += DIGITS[d] + POS[posFromRight];
      }
    });

    out += text + (text && !isLast ? "ล้าน" : "");
  });

  return out;
}

export function bahtText(amountInput: number): string {
  let amount = Math.round((Number(amountInput) || 0) * 100) / 100;
  const negative = amount < 0;
  amount = Math.abs(amount);

  const [rawBaht, satang] = amount.toFixed(2).split(".");
  const baht = rawBaht.replace(/^0+(?=\d)/, "");

  let text = (numText(baht) || "ศูนย์") + "บาท";
  text += satang === "00" ? "ถ้วน" : numText(satang) + "สตางค์";

  return (negative ? "ลบ" : "") + text;
}
