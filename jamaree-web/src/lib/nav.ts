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
  Truck,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  /** key เดิมจาก erp.html — ใช้เป็น path ด้วย */
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** ยังไม่ได้ย้ายมาจากของเดิม — โชว์หน้ารอไปก่อน */
  pending?: boolean;
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
      },
      {
        key: "reports",
        label: "สรุปยอด",
        path: "/reports",
        icon: BarChart3,
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
      },
    ],
  },
  {
    label: "ขาย",
    items: [
      { key: "customers", label: "ลูกค้า", path: "/customers", icon: Users },
      { key: "orders", label: "ออเดอร์", path: "/orders", icon: ShoppingCart },
      {
        key: "docs",
        label: "เอกสารการค้า",
        path: "/docs",
        icon: FileText,
      },
    ],
  },
  {
    label: "คลังสินค้า",
    items: [
      { key: "products", label: "สินค้า", path: "/products", icon: Package },
      {
        key: "tanks",
        label: "ถัง",
        path: "/tanks",
        icon: Cylinder,
      },
      {
        key: "purchases",
        label: "จัดซื้อ",
        path: "/purchases",
        icon: Truck,
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
      },
      {
        key: "attendance",
        label: "ลงเวลา & ลา",
        path: "/attendance",
        icon: Clock,
      },
      {
        key: "payroll",
        label: "เงินเดือน",
        path: "/payroll",
        icon: Banknote,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function navItemByPath(pathname: string): NavItem | undefined {
  // เลือกอันที่ path ตรงที่สุด (ยาวสุด) เพื่อให้หน้ารายละเอียดยังไฮไลต์เมนูแม่ถูก
  return NAV_ITEMS.filter(
    (i) =>
      pathname === i.path || (i.path !== "/" && pathname.startsWith(i.path)),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}
