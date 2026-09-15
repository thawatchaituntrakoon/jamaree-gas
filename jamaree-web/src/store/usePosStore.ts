import { create } from "zustand";
import type { UUID } from "@/types";

/**
 * บรรทัดในตะกร้า — เก็บแค่ "สินค้าอะไร กี่ชิ้น" เท่านั้น
 * ⭐ ไม่เก็บราคา เพราะราคาคิดสดจากชุดราคาของลูกค้าเสมอ (กฎเดียวกับ order_items ในฐานข้อมูล)
 *    อ่านราคาผ่าน priceFor(product_id, customerId) จุดเดียว — เปลี่ยนลูกค้าแล้วราคาขยับตามเอง
 */
export interface PosCartLine {
  product_id: UUID;
  qty: number;
}

interface PosState {
  cart: PosCartLine[];
  /** null = ลูกค้าจร (ขายหน้าร้านไม่ระบุชื่อ) — orders.customer_id รับ null ได้อยู่แล้ว */
  customerId: UUID | null;
  paidCash: number;
  paidTransfer: number;

  addToCart: (productId: UUID, qty?: number) => void;
  removeFromCart: (productId: UUID) => void;
  updateQuantity: (productId: UUID, qty: number) => void;
  clearCart: () => void;
  setPosCustomer: (customerId: UUID | null) => void;
  setPaidCash: (amount: number) => void;
  setPaidTransfer: (amount: number) => void;
  /** ล้างทุกอย่างเพื่อเริ่มบิลใหม่ — ใช้หลังปิดการขายสำเร็จ */
  resetSale: () => void;
}

const EMPTY = {
  cart: [] as PosCartLine[],
  customerId: null as UUID | null,
  paidCash: 0,
  paidTransfer: 0,
};

/** ตะกร้าขายหน้าร้าน — เป็นสถานะชั่วคราวบนจอ ยังไม่แตะฐานข้อมูลจนกว่าจะกดปิดการขาย */
export const usePosStore = create<PosState>()((set) => ({
  ...EMPTY,

  addToCart: (productId, qty = 1) =>
    set((s) => {
      const line = s.cart.find((x) => x.product_id === productId);
      if (!line) return { cart: [...s.cart, { product_id: productId, qty }] };
      return {
        cart: s.cart.map((x) =>
          x.product_id === productId ? { ...x, qty: x.qty + qty } : x,
        ),
      };
    }),

  removeFromCart: (productId) =>
    set((s) => ({ cart: s.cart.filter((x) => x.product_id !== productId) })),

  updateQuantity: (productId, qty) =>
    set((s) =>
      qty <= 0
        ? { cart: s.cart.filter((x) => x.product_id !== productId) }
        : {
            cart: s.cart.map((x) =>
              x.product_id === productId ? { ...x, qty } : x,
            ),
          },
    ),

  clearCart: () => set({ cart: [], paidCash: 0, paidTransfer: 0 }),

  // ไม่ต้องคิดราคาใหม่ตรงนี้ — ราคาอ่านสดตอนวาดจอจาก customerId ตัวนี้อยู่แล้ว
  setPosCustomer: (customerId) => set({ customerId }),

  setPaidCash: (amount) => set({ paidCash: Math.max(0, amount) }),
  setPaidTransfer: (amount) => set({ paidTransfer: Math.max(0, amount) }),

  resetSale: () => set({ ...EMPTY }),
}));
