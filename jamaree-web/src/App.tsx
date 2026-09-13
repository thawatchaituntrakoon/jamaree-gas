import { lazy } from "react";
import type { ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { NAV_ITEMS } from "@/lib/nav";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// แยกไฟล์แต่ละหน้าออกจากกัน — เปิดแอปครั้งแรกจะได้ไม่ต้องโหลดทุกหน้าพร้อมกัน
const CustomersPage = lazy(() =>
  import("@/pages/CustomersPage").then((m) => ({ default: m.CustomersPage })),
);
const CustomerDetailPage = lazy(() =>
  import("@/pages/CustomerDetailPage").then((m) => ({
    default: m.CustomerDetailPage,
  })),
);
const ProductsPage = lazy(() =>
  import("@/pages/ProductsPage").then((m) => ({ default: m.ProductsPage })),
);
const ProductDetailPage = lazy(() =>
  import("@/pages/ProductDetailPage").then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const OrdersPage = lazy(() =>
  import("@/pages/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import("@/pages/OrderDetailPage").then((m) => ({
    default: m.OrderDetailPage,
  })),
);
const MoneyPage = lazy(() =>
  import("@/pages/MoneyPage").then((m) => ({ default: m.MoneyPage })),
);
const DocsPage = lazy(() =>
  import("@/pages/DocsPage").then((m) => ({ default: m.DocsPage })),
);
const DocDetailPage = lazy(() =>
  import("@/pages/DocDetailPage").then((m) => ({ default: m.DocDetailPage })),
);
const PurchasesPage = lazy(() =>
  import("@/pages/PurchasesPage").then((m) => ({ default: m.PurchasesPage })),
);
const StaffPage = lazy(() =>
  import("@/pages/StaffPage").then((m) => ({ default: m.StaffPage })),
);
const AttendancePage = lazy(() =>
  import("@/pages/AttendancePage").then((m) => ({
    default: m.AttendancePage,
  })),
);
const PayrollPage = lazy(() =>
  import("@/pages/PayrollPage").then((m) => ({ default: m.PayrollPage })),
);
const CylindersPage = lazy(() =>
  import("@/pages/CylindersPage").then((m) => ({ default: m.CylindersPage })),
);
const BoardPage = lazy(() =>
  import("@/pages/BoardPage").then((m) => ({ default: m.BoardPage })),
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);

/** หน้าที่ทำเสร็จแล้ว — เมนูที่เหลือจะขึ้นหน้า "กำลังย้าย" ให้อัตโนมัติ */
const READY_PAGES: Record<string, ComponentType> = {
  "/customers": CustomersPage,
  "/orders": OrdersPage,
  "/products": ProductsPage,
  "/money": MoneyPage,
  "/docs": DocsPage,
  "/purchases": PurchasesPage,
  "/staff": StaffPage,
  "/attendance": AttendancePage,
  "/payroll": PayrollPage,
  "/tanks": CylindersPage,
  "/board": BoardPage,
  "/reports": ReportsPage,
};

export default function App() {
  const { session, ready } = useSession();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2.5 bg-paper text-muted">
        <Loader2 size={18} className="animate-spin" />
        <span>กำลังเปิดระบบ…</span>
      </div>
    );
  }

  // ต่อฐานข้อมูลแล้วแต่ยังไม่ล็อกอิน — ฐานข้อมูลจะไม่ให้อ่าน/เขียนอะไรเลย
  if (isSupabaseConfigured && !session) return <LoginPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />

          {NAV_ITEMS.filter((item) => item.path !== "/").map((item) => {
            const Page = READY_PAGES[item.path] ?? ComingSoonPage;
            return <Route key={item.key} path={item.path} element={<Page />} />;
          })}

          {/* หน้ารายละเอียดรายตัว — คลิกทะลุจากตารางไหนก็ได้ */}
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/docs/:id" element={<DocDetailPage />} />

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
