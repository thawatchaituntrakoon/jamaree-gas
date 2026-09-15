-- ⚠️⚠️ ไฟล์นี้ "ลบข้อมูลทิ้ง" ⚠️⚠️
-- กู้คืนไม่ได้ ถ้าไม่ได้สำรองไว้ก่อน
-- ก่อนรัน: Supabase → Database → Backups (หรือกดสำรองข้อมูลในแอป) ให้เรียบร้อยก่อน
--
-- มี 2 แบบ ให้เลือก "ก๊อปเฉพาะท่อนที่ต้องการ" ไปวางใน Supabase → SQL Editor
--   แบบ A = ล้างเฉพาะรายการซื้อ-ขาย-เงิน  (เก็บลูกค้า/สินค้า/พนักงาน/ตั้งค่าไว้)  ← ใช้บ่อยสุด
--   แบบ B = ล้างเกลี้ยงทั้งฐานข้อมูล      (เหลือแต่โครงตาราง)
-- ============================================================


-- ============================================================
-- แบบ A — ล้างเฉพาะ "ธุรกรรม" (เริ่มนับหนึ่งใหม่ แต่ทะเบียนยังอยู่)
-- ล้าง: ออเดอร์ · การเคลื่อนไหวสต๊อก · เงินเข้า-ออก · เอกสาร · ถังฝาก ·
--       มัดจำถัง · ใบสั่งซื้อ · เงินเดือน · ลงเวลา · การลา · เลขรันเอกสาร
-- เก็บ: ลูกค้า · สินค้า · ผู้ขาย · พนักงาน · หมวดเงิน · ขนาดถัง · ตั้งค่าร้าน
-- ============================================================
-- begin;

-- truncate table
--   public.order_items,
--   public.orders,
--   public.stock_moves,
--   public.transactions,
--   public.documents,
--   public.cylinder_custody,
--   public.cylinder_deposits,
--   public.purchase_orders,
--   public.payrolls,
--   public.timelogs,
--   public.leaves,
--   public.doc_counters
-- restart identity cascade;

-- -- ยอดคงเหลือสินค้าเก็บเป็นคอลัมน์ (ไม่ได้คำนวณสดจาก stock_moves) จึงต้องรีเซ็ตเอง
-- -- ปกติมี "ยามเฝ้าประตู" ห้ามแก้ stock ตรง ๆ (ต้องผ่าน add_move)
-- -- บรรทัดล่างนี้คือการขออนุญาตชั่วคราวเฉพาะในธุรกรรมนี้ พอ commit แล้วยามกลับมาเฝ้าเหมือนเดิม
-- set local app.in_add_move = 'on';
-- update public.products set stock = 0;

-- commit;


-- ============================================================
-- แบบ B — ล้างทุกตาราง (ข้อมูลหายหมดจริง ๆ)
-- ⚠️ ทะเบียนลูกค้า/สินค้า/พนักงาน/ตั้งค่าร้าน หายด้วย
-- ⚠️ หลังรันเสร็จ ให้รัน schema.sql ซ้ำอีกรอบ เพื่อใส่ค่าตั้งต้นกลับมา
--    (ระดับราคา · หมวดเงิน · ประเภทการลา · ขนาดถัง · แถวตั้งค่าร้าน)
-- ============================================================

begin;

truncate table
  public.order_items,
  public.orders,
  public.stock_moves,
  public.transactions,
  public.documents,
  public.cylinder_custody,
  public.cylinder_deposits,
  public.purchase_orders,
  public.payrolls,
  public.timelogs,
  public.leaves,
  public.doc_counters,
  public.products,
  public.customers,
  public.vendors,
  public.staff,
  public.price_tiers,
  public.money_categories,
  public.leave_types,
  public.cylinder_sizes,
  public.shop_settings
restart identity cascade;

commit;



-- ============================================================
-- เช็กผลหลังล้าง (รันได้ทั้งสองแบบ)
-- ============================================================
/*
select 'orders' as ตาราง, count(*) from public.orders
union all select 'stock_moves',       count(*) from public.stock_moves
union all select 'transactions',      count(*) from public.transactions
union all select 'documents',         count(*) from public.documents
union all select 'purchase_orders',   count(*) from public.purchase_orders
union all select 'cylinder_custody',  count(*) from public.cylinder_custody
union all select 'cylinder_deposits', count(*) from public.cylinder_deposits
union all select 'payrolls',          count(*) from public.payrolls
union all select 'customers',         count(*) from public.customers
union all select 'products',          count(*) from public.products;
*/


-- หมายเหตุ
-- · ผู้ใช้สำหรับล็อกอิน (auth.users) ไม่ถูกลบ — ถ้าจะลบ ไปที่ Authentication → Users
-- · view (cylinder_stock, cylinder_deposit_balances) ไม่ต้องล้าง จะว่างตามตารางต้นทางเอง
