import {
  Banknote,
  BarChart3,
  ClipboardList,
  Clock,
  Cylinder,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AccessRole } from "@/types";

const ALL: readonly AccessRole[] = [
  "SUPER_ADMIN",
  "MANAGER",
  "FINANCE",
  "SALES",
  "DELIVERY",
  "FILLER",
  "GENERAL",
];
const BOSS: readonly AccessRole[] = ["SUPER_ADMIN", "MANAGER"];

export interface NavItem {
  /** key เดิมจาก erp.html — ใช้เป็น path ด้วย */
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** ใครเปิดหน้านี้ได้บ้าง — บังคับใส่ เมนูใหม่จะได้ไม่ลืมคิดเรื่องสิทธิ์ */
  roles: readonly AccessRole[];
  /** ยังไม่ได้ย้ายมาจากของเดิม — โชว์หน้ารอไปก่อน */
  pending?: boolean;
  /** เปิดเต็มจอ ไม่มีเมนูข้าง — เส้นทางประกาศแยกเองใน App.tsx */
  standalone?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** จัดหมวดเมนูแบบเดียวกับ NAV_GROUPS ใน erp.html เป๊ะ ๆ เพื่อให้เจ้าของหาของเจอที่เดิม */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "หน้าหลัก",
    items: [
      {
        key: "dash",
        label: "แดชบอร์ด",
        path: "/",
        icon: LayoutDashboard,
        // ทุกคนต้องมีหน้าให้ลง — กันเด้งไปมาวนไม่จบ
        roles: ALL,
      },
      {
        key: "reports",
        label: "สรุปยอด",
        path: "/reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE"],
      },
    ],
  },
  {
    label: "งาน",
    items: [
      {
        key: "board",
        label: "บอร์ดงาน",
        path: "/board",
        icon: ClipboardList,
        roles: ["SUPER_ADMIN", "MANAGER", "SALES", "DELIVERY", "FILLER"],
      },
    ],
  },
  {
    label: "ขาย",
    items: [
      {
        key: "pos",
        label: "ขายหน้าร้าน",
        path: "/pos",
        icon: Store,
        standalone: true,
        roles: ["SUPER_ADMIN", "MANAGER", "SALES"],
      },
      {
        key: "customers",
        label: "ลูกค้า",
        path: "/customers",
        icon: Users,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE", "SALES"],
      },
      {
        key: "orders",
        label: "ออเดอร์",
        path: "/orders",
        icon: ShoppingCart,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE", "SALES", "DELIVERY"],
      },
      {
        key: "pricesets",
        label: "ชุดราคา",
        path: "/price-sets",
        icon: Tags,
        roles: BOSS,
      },
      {
        key: "docs",
        label: "เอกสารการค้า",
        path: "/docs",
        icon: FileText,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE", "SALES"],
      },
    ],
  },
  {
    label: "คลังสินค้า",
    items: [
      {
        key: "products",
        label: "สินค้า",
        path: "/products",
        icon: Package,
        roles: ["SUPER_ADMIN", "MANAGER", "SALES", "FILLER"],
      },
      {
        key: "tanks",
        label: "ถัง",
        path: "/tanks",
        icon: Cylinder,
        roles: ["SUPER_ADMIN", "MANAGER", "DELIVERY", "FILLER"],
      },
      {
        key: "purchases",
        label: "จัดซื้อ",
        path: "/purchases",
        icon: Truck,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE"],
      },
    ],
  },
  {
    label: "การเงิน",
    items: [
      {
        key: "money",
        label: "การเงิน",
        path: "/money",
        icon: Wallet,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE"],
      },
    ],
  },
  {
    label: "ทีมงาน",
    items: [
      {
        key: "staff",
        label: "พนักงาน",
        path: "/staff",
        icon: UsersRound,
        roles: BOSS,
      },
      {
        key: "attendance",
        label: "ลงเวลา & ลา",
        path: "/attendance",
        icon: Clock,
        // ทุกคนต้องตอกบัตรและขอลาเอง
        roles: ALL,
      },
      {
        key: "payroll",
        label: "เงินเดือน",
        path: "/payroll",
        icon: Banknote,
        roles: ["SUPER_ADMIN", "MANAGER", "FINANCE"],
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** สิทธิ์ของเมนูนั้น — หา path ไม่เจอ ให้ปิดไว้ก่อน ดีกว่าเปิดทิ้งไว้โดยไม่ตั้งใจ */
export function rolesFor(path: string): readonly AccessRole[] {
  return NAV_ITEMS.find((i) => i.path === path)?.roles ?? ["SUPER_ADMIN"];
}

export function navItemByPath(pathname: string): NavItem | undefined {
  // เลือกอันที่ path ตรงที่สุด (ยาวสุด) เพื่อให้หน้ารายละเอียดยังไฮไลต์เมนูแม่ถูก
  return NAV_ITEMS.filter(
    (i) =>
      pathname === i.path || (i.path !== "/" && pathname.startsWith(i.path)),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}
