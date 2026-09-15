/**
 * ส่งงานพิมพ์ไปเครื่องพิมพ์ความร้อนผ่าน Web Bluetooth
 * ⚠️ ใช้ได้เฉพาะ Chrome/Edge บน Android, Windows, macOS, ChromeOS และต้องเปิดผ่าน https
 *    Safari/iPhone/iPad ไม่รองรับ Web Bluetooth เลย
 */

/** เครื่องพิมพ์ความร้อนตามท้องตลาดใช้บริการพวกนี้ — ขอสิทธิ์ล่วงหน้าไว้ให้ครบ */
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];

/** บลูทูธรับข้อมูลทีละน้อย ส่งรวดเดียวยาว ๆ เครื่องจะพิมพ์ตกหล่น */
const CHUNK = 180;
const CHUNK_DELAY_MS = 20;

let device: BluetoothDevice | null = null;
let target: BluetoothRemoteGATTCharacteristic | null = null;

export const bluetoothPrintSupported =
  typeof navigator !== "undefined" && "bluetooth" in navigator;

export function printerName(): string | null {
  return device?.name ?? null;
}

/** ลืมเครื่องที่จำไว้ — ครั้งหน้าจะถามให้เลือกใหม่ */
export function forgetPrinter() {
  if (device?.gatt?.connected) device.gatt.disconnect();
  device = null;
  target = null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findWritable(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    for (const ch of await service.getCharacteristics()) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
    }
  }
  throw new Error(
    "ต่อเครื่องได้ แต่หาช่องส่งข้อมูลไม่เจอ — เครื่องนี้อาจใช้กับเว็บไม่ได้",
  );
}

/** ต้องเรียกจากการกดปุ่มของผู้ใช้เท่านั้น เบราว์เซอร์ถึงจะยอมเปิดหน้าต่างเลือกเครื่อง */
async function connect(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!bluetoothPrintSupported) {
    throw new Error(
      "เบราว์เซอร์นี้ต่อเครื่องพิมพ์บลูทูธไม่ได้ — ใช้ Chrome บน Android, Windows หรือ Mac",
    );
  }

  if (target && device?.gatt?.connected) return target;

  if (!device) {
    device = await navigator.bluetooth.requestDevice({
      filters: PRINTER_SERVICES.map((s) => ({ services: [s] })),
      optionalServices: PRINTER_SERVICES,
    });
    device.addEventListener("gattserverdisconnected", () => {
      target = null;
    });
  }

  const server = await device.gatt?.connect();
  if (!server)
    throw new Error("ต่อเครื่องพิมพ์ไม่ได้ — ลองเปิดเครื่องแล้วกดใหม่");

  target = await findWritable(server);
  return target;
}

export async function printBytes(bytes: Uint8Array): Promise<void> {
  const ch = await connect();
  const canFireAndForget = ch.properties.writeWithoutResponse;

  for (let i = 0; i < bytes.length; i += CHUNK) {
    const part = bytes.slice(i, i + CHUNK);
    if (canFireAndForget) await ch.writeValueWithoutResponse(part);
    else await ch.writeValue(part);
    await delay(CHUNK_DELAY_MS);
  }
}

/** แปลงข้อผิดพลาดของ Web Bluetooth เป็นภาษาคน */
export function printErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotFoundError") {
    return "ยังไม่ได้เลือกเครื่องพิมพ์";
  }
  if (err instanceof DOMException && err.name === "SecurityError") {
    return "หน้านี้ต้องเปิดผ่าน https ถึงจะต่อบลูทูธได้";
  }
  if (err instanceof Error && err.message) return err.message;
  return "พิมพ์ไม่สำเร็จ — ลองเปิดเครื่องพิมพ์แล้วกดใหม่";
}
