-- ============================================================
-- JAMAREE GAS — โครงฐานข้อมูล Supabase (PostgreSQL)
-- ยกมาจาก SSOT เดิมใน erp.html (localStorage key: bizsuite_erp)
--
-- วิธีใช้: เปิด Supabase → SQL Editor → วางไฟล์นี้ทั้งไฟล์ → Run
--
-- กติกาเหล็ก (เหมือนของเดิมทุกตัวอักษร):
--  1. สต๊อกขยับผ่านฟังก์ชัน add_move() จุดเดียวเท่านั้น — ห้าม UPDATE products.stock ตรง ๆ
--  2. ห้ามลบข้อมูลที่มีประวัติ — ใช้ active=false / status='ยกเลิก' แทน
--  3. ทุกตารางเปิด RLS — ต้องล็อกอินก่อนถึงจะเห็นข้อมูล
-- ============================================================

-- ============ 1. ทะเบียน (Master) ============

-- ชุดราคา — ลูกค้าคนละกลุ่มได้ราคาต่างกัน (ของเดิมมี 10 ชุดตายตัว)
create table if not exists public.price_tiers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) > 0),
  phone         text,
  note          text,
  person_type   text not null default 'บุคคล'
                  check (person_type in ('บุคคล', 'นิติบุคคล')),
  tax_id        text,   -- จำเป็นถ้าต้องออกใบกำกับภาษีเต็มรูป
  address       text,   -- จำเป็นถ้าต้องออกใบกำกับภาษีเต็มรูป
  price_tier_id uuid references public.price_tiers (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (name);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique,
  name        text not null check (length(btrim(name)) > 0),
  unit        text not null default 'ชิ้น',
  kind        text not null default ''
                check (kind in ('', 'ดิบ', 'น้ำแก๊ส', 'เปล่า', 'ใหม่', 'ชำรุด',
                                'ต่างยี่ห้อ', 'หมุนเวียน', 'เตาแก๊ส', 'อุปกรณ์แก๊ส', 'บริการ')),
  size        text,                       -- '4kg' / '11.5kg' / '15kg' / '48kg'
  fill_kg     numeric(10, 2),             -- กิโลแก๊สต่อถัง (เฉพาะ น้ำแก๊ส/หมุนเวียน)
  stock       numeric(14, 3) not null default 0,
  low_at      numeric(14, 3) not null default 0,
  price       numeric(14, 2) not null default 0,
  cost        numeric(14, 2),
  active      boolean not null default true,
  tier_prices jsonb   not null default '{}'::jsonb,   -- { price_tier_id: ราคา }
  created_at  timestamptz not null default now(),
  -- น้ำแก๊ส/ถังหมุนเวียน ต้องบอกน้ำหนักต่อถัง ไม่งั้นตอนขายจะตัดแก๊สดิบไม่ได้
  constraint products_fill_kg_required
    check (kind not in ('น้ำแก๊ส', 'หมุนเวียน') or (fill_kg is not null and fill_kg > 0))
);

create index if not exists products_kind_idx on public.products (kind) where active;

-- มีแก๊สดิบ (ถังเก็บใหญ่) ได้แถวเดียวเท่านั้น
create unique index if not exists products_single_raw_gas_idx
  on public.products ((kind)) where kind = 'ดิบ';

-- ============ 2. รายการเคลื่อนไหว (Transaction) ============

create table if not exists public.stock_moves (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  product_id uuid not null references public.products (id) on delete restrict,
  type       text not null check (type in ('รับเข้า', 'เบิกออก', 'ปรับเพิ่ม', 'ปรับลด')),
  qty        numeric(14, 3) not null check (qty > 0),
  note       text not null default '',
  ref_type   text check (ref_type in ('order', 'doc', 'po', 'payroll', 'custody')),
  ref_id     uuid,
  created_at timestamptz not null default now()
);

create index if not exists stock_moves_product_idx on public.stock_moves (product_id, date desc);
create index if not exists stock_moves_ref_idx on public.stock_moves (ref_type, ref_id);

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customers (id) on delete restrict,
  date           date not null default current_date,
  status         text not null default 'ใหม่' check (status in ('ใหม่', 'เสร็จ', 'ยกเลิก')),
  -- ไทม์ไลน์แสดงผล — คนละตัวกับ status/stock_deducted โดยเจตนา ห้ามผูกรวมกัน
  work_stage     text not null default 'ใหม่'
                   check (work_stage in ('ใหม่', 'กำลังทำ', 'ส่งแล้ว', 'ปิด')),
  stock_deducted boolean not null default false,
  assignee_id    uuid,   -- พนักงานผู้รับผิดชอบ (ผูก FK ตอนทำโมดูลพนักงาน)
  paid_cash      numeric(14, 2) not null default 0 check (paid_cash >= 0),
  paid_transfer  numeric(14, 2) not null default 0 check (paid_transfer >= 0),
  voided         boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists orders_date_idx on public.orders (date desc);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_open_idx on public.orders (work_stage) where not stock_deducted and not voided;

-- ไม่แช่ราคาไว้ — ราคาคิดสดจากชุดราคาของลูกค้าเสมอ (เหมือนของเดิม)
create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  qty        numeric(14, 3) not null check (qty > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- เงินเข้า-ออก (ของเดิมชื่อ money)
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  date              date not null default current_date,
  type              text not null check (type in ('เข้า', 'ออก')),
  amount            numeric(14, 2) not null check (amount >= 0),
  note              text not null default '',
  category          text,
  unpaid            boolean not null default false,
  -- มีค่า = ระบบสร้างให้อัตโนมัติ ห้ามลบจากหน้าจอ
  ref_type          text check (ref_type in ('order', 'doc', 'po', 'payroll', 'custody')),
  ref_id            uuid,
  vat_amt           numeric(14, 2),
  wht_amt           numeric(14, 2),
  wht_rate          numeric(6, 2),
  payee_name        text,
  payee_tax_id      text,
  payee_person_type text check (payee_person_type in ('บุคคล', 'นิติบุคคล')),
  created_at        timestamptz not null default now()
);

create index if not exists transactions_date_idx on public.transactions (date desc);
create index if not exists transactions_unpaid_idx on public.transactions (type) where unpaid;
create index if not exists transactions_ref_idx on public.transactions (ref_type, ref_id);

-- เอกสารการค้า — items แช่แข็งไว้ตอนออกเอกสาร ไม่ผูกกับ products แล้ว
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('ใบเสนอราคา', 'ใบแจ้งหนี้', 'ใบเสร็จ')),
  number        text not null unique,
  customer_id   uuid not null references public.customers (id) on delete restrict,
  order_id      uuid references public.orders (id) on delete set null,
  items         jsonb not null default '[]'::jsonb,  -- [{name, qty, price}]
  amount        numeric(14, 2) not null default 0,
  date          date not null default current_date,
  status        text not null default 'ร่าง' check (status in ('ร่าง', 'ส่งแล้ว', 'ชำระแล้ว')),
  note          text,
  source_doc_id uuid references public.documents (id) on delete set null,
  vat_rate      numeric(6, 2),
  vat_amt       numeric(14, 2),
  base_amt      numeric(14, 2),
  wht_type      text,
  wht_rate      numeric(6, 2),
  wht_amt       numeric(14, 2),
  transfer_amt  numeric(14, 2),
  created_at    timestamptz not null default now()
);

create index if not exists documents_customer_idx on public.documents (customer_id);
create index if not exists documents_status_idx on public.documents (status, date desc);

-- ถังที่อยู่กับลูกค้า (ยืม/ฝาก)
create table if not exists public.cylinder_custody (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  customer_id uuid not null references public.customers (id) on delete restrict,
  size        text not null,
  type        text not null check (type in ('ยืม', 'คืน', 'ฝาก', 'ถอนฝาก', 'เปลี่ยนถังชำรุด')),
  qty         numeric(14, 3) not null check (qty > 0),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists custody_customer_idx on public.cylinder_custody (customer_id, size);

-- ============ 3. เครื่องยนต์สต๊อก — add_move() จุดเดียว ============
-- ⭐ ทำเป็นฟังก์ชันในฐานข้อมูล ไม่ใช่ในเว็บ เพราะแอป Flutter (POS) จะเรียกตัวเดียวกันนี้
--    การขยับสต๊อก + บันทึกประวัติ จึงเกิดพร้อมกันเสมอ (atomic) ไม่มีทางหลุดครึ่งทาง

-- ยามเฝ้าประตู: ห้ามใครแก้ products.stock ตรง ๆ ต้องผ่าน add_move() เท่านั้น
create or replace function public.guard_direct_stock_edit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.in_add_move', true), '') <> 'on' then
    raise exception 'ห้ามแก้จำนวนคงเหลือตรง ๆ — ต้องบันทึกผ่านการรับเข้า/เบิกออก/ตรวจนับเท่านั้น';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_stock on public.products;
create trigger products_guard_stock
  before update on public.products
  for each row execute function public.guard_direct_stock_edit();

create or replace function public.add_move(
  p_product_id uuid,
  p_type       text,
  p_qty        numeric,
  p_note       text default '',
  p_ref_type   text default null,
  p_ref_id     uuid default null
)
returns public.stock_moves
-- security definer: ต้องข้ามด่าน RLS ของ stock_moves (ที่ปิดการเขียนตรงไว้) และปลดล็อก trigger ข้างบน
-- ปลอดภัยเพราะรับพารามิเตอร์แบบมีชนิดตายตัว ไม่มีการต่อ SQL เอง + เช็คว่าล็อกอินแล้วก่อนเสมอ
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_delta numeric;
  v_stock numeric;
  v_name  text;
  v_move  public.stock_moves;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;

  v_delta := case
    when p_type in ('รับเข้า', 'ปรับเพิ่ม') then  p_qty
    when p_type in ('เบิกออก', 'ปรับลด')   then -p_qty
  end;

  if v_delta is null then
    raise exception 'ประเภทการเคลื่อนไหวไม่ถูกต้อง: %', p_type;
  end if;

  -- ปลดล็อกยามเฝ้าประตูเฉพาะใน transaction นี้เท่านั้น
  perform set_config('app.in_add_move', 'on', true);

  -- UPDATE ล็อกแถวสินค้าไว้ กันสองเครื่องตัดสต๊อกชนกัน
  update public.products
     set stock = stock + v_delta
   where id = p_product_id
   returning stock, name into v_stock, v_name;

  if not found then
    raise exception 'ไม่พบสินค้าที่ต้องการ';
  end if;

  if v_stock < 0 then
    raise exception 'ของไม่พอ: % เหลือ %', v_name, v_stock - v_delta;
  end if;

  insert into public.stock_moves (product_id, type, qty, note, ref_type, ref_id)
  values (p_product_id, p_type, p_qty, coalesce(p_note, ''), p_ref_type, p_ref_id)
  returning * into v_move;

  perform set_config('app.in_add_move', 'off', true);
  return v_move;
end;
$$;

-- เรียกได้เฉพาะคนที่ล็อกอินแล้ว
revoke all on function public.add_move(uuid, text, numeric, text, text, uuid) from public, anon;
grant execute on function public.add_move(uuid, text, numeric, text, text, uuid) to authenticated;

-- ============ 3.5 ราคาขาย + ปิดออเดอร์ ============
-- ⭐ อยู่ในฐานข้อมูลเพราะแอป Flutter (POS) ต้องใช้ตัวเดียวกัน
--    ตัดสต๊อก + ลงบัญชี + ปิดออเดอร์ เกิดพร้อมกันเสมอ ถ้าพังกลางทางจะย้อนคืนทั้งหมด

-- ราคาขายของสินค้าสำหรับลูกค้าคนนั้น — จุดเดียวที่อ่านราคา กันราคาเพี้ยนไม่ตรงกัน
create or replace function public.price_for(p_product_id uuid, p_customer_id uuid)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
           nullif(p.tier_prices ->> c.price_tier_id::text, '')::numeric,
           p.price
         )
    from public.products p
    left join public.customers c on c.id = p_customer_id
   where p.id = p_product_id;
$$;

create or replace function public.order_total(p_order_id uuid)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(oi.qty * public.price_for(oi.product_id, o.customer_id)), 0)
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
   where o.id = p_order_id;
$$;

-- ⭐ ปิดออเดอร์ = ตัดสต๊อกผ่าน add_move จุดเดียว + ลงบัญชีเงินเข้าตามที่จ่ายจริง
--    น้ำแก๊ส/ถังหมุนเวียน → ไม่มีสต๊อกของตัวเอง แปลงเป็นกิโลแล้วตัดจากแก๊สดิบ (ถังเก็บใหญ่)
--    ถังใหม่/อุปกรณ์ → ตัดสต๊อกก้อนของตัวเอง · บริการ → ไม่ตัดสต๊อกเลย
create or replace function public.complete_order(p_order_id uuid)
returns public.orders
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order    public.orders;
  v_raw      public.products;
  v_raw_kg   numeric := 0;
  v_total    numeric;
  v_remain   numeric;
  v_short    record;
  v_item     record;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  -- ล็อกแถวออเดอร์ กันสองเครื่องกดปิดพร้อมกันแล้วตัดสต๊อกซ้ำ
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ไม่พบออเดอร์ที่ต้องการ';
  end if;
  if v_order.voided then
    raise exception 'ออเดอร์นี้ถูกยกเลิกไปแล้ว';
  end if;
  if v_order.stock_deducted then
    raise exception 'ออเดอร์นี้ปิดไปแล้ว';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'ออเดอร์นี้ยังไม่มีรายการสินค้า';
  end if;

  -- 1) รวมกิโลแก๊สทั้งออเดอร์ก่อน — หลายไซส์ในบิลเดียวรวมกันอาจเกินที่มี
  select coalesce(sum(oi.qty * p.fill_kg), 0)
    into v_raw_kg
    from public.order_items oi
    join public.products p on p.id = oi.product_id
   where oi.order_id = p_order_id
     and p.kind in ('น้ำแก๊ส', 'หมุนเวียน');

  -- 2) ของที่มีสต๊อกของตัวเอง ต้องพอ (รวมทุกบรรทัดของสินค้าเดียวกัน)
  select p.name as name, p.stock as stock
    into v_short
    from public.order_items oi
    join public.products p on p.id = oi.product_id
   where oi.order_id = p_order_id
     and p.kind not in ('น้ำแก๊ส', 'หมุนเวียน', 'บริการ')
   group by p.id, p.name, p.stock
  having sum(oi.qty) > p.stock
   limit 1;
  if found then
    raise exception 'ของไม่พอ: % เหลือ %', v_short.name, trim_scale(v_short.stock);
  end if;

  -- 3) แก๊สดิบในถังเก็บใหญ่พอไหม
  if v_raw_kg > 0 then
    select * into v_raw from public.products where kind = 'ดิบ';
    if not found then
      raise exception 'ยังไม่ได้ตั้งสินค้าแก๊สดิบ (ถังเก็บใหญ่) ในระบบ';
    end if;
    if v_raw.stock < v_raw_kg then
      raise exception 'แก๊สดิบไม่พอ: ต้องใช้ % kg เหลือ % kg',
        trim_scale(v_raw_kg), trim_scale(v_raw.stock);
    end if;
  end if;

  -- 4) ตัดสต๊อกจริง
  for v_item in
    select oi.qty, p.id as product_id, p.kind, p.fill_kg, p.name, p.size
      from public.order_items oi
      join public.products p on p.id = oi.product_id
     where oi.order_id = p_order_id
  loop
    if v_item.kind = 'บริการ' then
      continue;
    elsif v_item.kind in ('น้ำแก๊ส', 'หมุนเวียน') then
      perform public.add_move(
        v_raw.id, 'เบิกออก', v_item.qty * v_item.fill_kg,
        'ขายแก๊ส ' || coalesce(nullif(v_item.size, ''), v_item.name)
          || ' x' || trim_scale(v_item.qty),
        'order', p_order_id);
    else
      perform public.add_move(
        v_item.product_id, 'เบิกออก', v_item.qty, 'ขาย/ออเดอร์', 'order', p_order_id);
    end if;
  end loop;

  -- 5) ลงบัญชี — จ่ายผสมได้ (สด + โอน) ส่วนที่เหลือเป็นลูกหนี้อัตโนมัติ
  v_total  := public.order_total(p_order_id);
  v_remain := greatest(0, v_total - v_order.paid_cash - v_order.paid_transfer);

  if v_order.paid_cash > 0 then
    insert into public.transactions (date, type, amount, note, category, ref_type, ref_id)
    values (v_order.date, 'เข้า', v_order.paid_cash, 'ขายออเดอร์ (สด)', 'ขาย', 'order', p_order_id);
  end if;
  if v_order.paid_transfer > 0 then
    insert into public.transactions (date, type, amount, note, category, ref_type, ref_id)
    values (v_order.date, 'เข้า', v_order.paid_transfer, 'ขายออเดอร์ (โอน)', 'ขาย', 'order', p_order_id);
  end if;
  if v_remain > 0 then
    insert into public.transactions (date, type, amount, note, category, ref_type, ref_id, unpaid)
    values (v_order.date, 'เข้า', v_remain, 'ขายออเดอร์ (ค้างชำระ)', 'ขาย', 'order', p_order_id, true);
  end if;

  -- 6) ปิดออเดอร์ — work_stage บังคับเป็น 'ปิด' เสมอ
  update public.orders
     set stock_deducted = true,
         status         = 'เสร็จ',
         work_stage     = 'ปิด'
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ยกเลิกบิล — คืนสต๊อกกลับ + ล้างยอดเงินของบิลนี้ (ไม่ลบออเดอร์ ประวัติยังอยู่)
create or replace function public.void_order(p_order_id uuid)
returns public.orders
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_raw   public.products;
  v_item  record;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ไม่พบออเดอร์ที่ต้องการ';
  end if;
  if v_order.voided then
    raise exception 'ออเดอร์นี้ถูกยกเลิกไปแล้ว';
  end if;

  -- คืนของเฉพาะบิลที่ตัดสต๊อกไปแล้วเท่านั้น
  if v_order.stock_deducted then
    select * into v_raw from public.products where kind = 'ดิบ';

    for v_item in
      select oi.qty, p.id as product_id, p.kind, p.fill_kg
        from public.order_items oi
        join public.products p on p.id = oi.product_id
       where oi.order_id = p_order_id
    loop
      if v_item.kind = 'บริการ' then
        continue;
      elsif v_item.kind in ('น้ำแก๊ส', 'หมุนเวียน') then
        perform public.add_move(v_raw.id, 'รับเข้า', v_item.qty * v_item.fill_kg,
                                'ยกเลิกบิล (คืนสต๊อก)', 'order', p_order_id);
      else
        perform public.add_move(v_item.product_id, 'รับเข้า', v_item.qty,
                                'ยกเลิกบิล (คืนสต๊อก)', 'order', p_order_id);
      end if;
    end loop;

    delete from public.transactions where ref_type = 'order' and ref_id = p_order_id;
  end if;

  update public.orders
     set voided = true, status = 'ยกเลิก'
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.price_for(uuid, uuid) from public, anon;
revoke all on function public.order_total(uuid) from public, anon;
revoke all on function public.complete_order(uuid) from public, anon;
revoke all on function public.void_order(uuid) from public, anon;
grant execute on function public.price_for(uuid, uuid) to authenticated;
grant execute on function public.order_total(uuid) to authenticated;
grant execute on function public.complete_order(uuid) to authenticated;
grant execute on function public.void_order(uuid) to authenticated;

-- ============ 4. ความปลอดภัย (RLS) ============
-- แอปนี้ใช้คนเดียว/ในร้านเดียว — เปิดให้เฉพาะคนที่ล็อกอินแล้วเท่านั้น
-- ผู้ที่ยังไม่ล็อกอิน (anon) มองไม่เห็นอะไรเลย

-- ⭐ ล้างกติกาสิทธิ์เดิมทิ้งทั้งหมดก่อน แล้วสร้างใหม่จากไฟล์นี้
--    ทำให้รันไฟล์นี้ซ้ำกี่รอบก็ได้ ไม่ติด "policy already exists"
--    (ทุกกติกาที่ใช้จริงถูกสร้างใหม่หมดในส่วนที่ 4, 6, 7, 8, 9, 10 ด้านล่าง)
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

alter table public.price_tiers      enable row level security;
alter table public.customers        enable row level security;
alter table public.products         enable row level security;
alter table public.stock_moves      enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.transactions     enable row level security;
alter table public.documents        enable row level security;
alter table public.cylinder_custody enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'price_tiers', 'customers', 'products', 'stock_moves', 'orders',
    'order_items', 'transactions', 'documents', 'cylinder_custody'
  ]
  loop
    execute format(
      'drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.%I', t
    );
    execute format(
      'create policy "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.%I
         for all to authenticated using (true) with check (true)', t
    );
  end loop;
end;
$$;

-- ห้ามเขียน stock_moves ตรง ๆ จากฝั่งเว็บ/มือถือ — ต้องผ่าน add_move() เท่านั้น
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.stock_moves;
create policy "อ่านประวัติสต๊อกได้"
  on public.stock_moves for select to authenticated using (true);

-- ============ 5. ข้อมูลตั้งต้น ============

insert into public.price_tiers (name, sort_order)
select 'ชุดราคา ' || i, i
from generate_series(1, 10) as i
where not exists (select 1 from public.price_tiers);

-- ============================================================
-- 6. โมดูลการเงิน (เพิ่มรอบที่ 2 — รันซ้ำได้ ไม่กระทบของเดิม)
-- ============================================================

-- หมวดเงินเข้า/ออก — เจ้าของตั้งเองได้ ดรอปดาวน์ทุกที่อ่านจากตารางนี้ที่เดียว
create table if not exists public.money_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  type       text not null check (type in ('เข้า', 'ออก')),
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (type, name)
);

-- เพิ่มคอลัมน์ให้ตารางเงินเดิม (ปลอดภัยถ้ารันซ้ำ)
alter table public.transactions add column if not exists wht_type   text;
alter table public.transactions add column if not exists settled_at date;

comment on column public.transactions.wht_type is
  'รหัสประเภทหัก ณ ที่จ่าย — snapshot ไว้ตอนบันทึก ใช้ตอนพิมพ์ใบ 50 ทวิ';
comment on column public.transactions.settled_at is
  'วันที่เก็บเงิน/จ่ายเงินจริง — ใส่ตอนตัดยอดค้าง';

alter table public.money_categories enable row level security;

drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.money_categories;
create policy "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้"
  on public.money_categories for all to authenticated
  using (true) with check (true);

-- ห้ามลบหมวดที่มีรายการเงินใช้อยู่ (ลบแล้วรายงานย้อนหลังจะเพี้ยน)
create or replace function public.guard_category_in_use()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.transactions
     where category = old.name
       and type = old.type
  ) then
    raise exception 'ลบไม่ได้ — หมวด "%" ยังมีรายการเงินใช้อยู่', old.name;
  end if;
  return old;
end;
$$;

drop trigger if exists money_categories_guard_delete on public.money_categories;
create trigger money_categories_guard_delete
  before delete on public.money_categories
  for each row execute function public.guard_category_in_use();

-- ⭐ ลบได้เฉพาะรายการที่เจ้าของกรอกเอง
--    รายการที่ระบบสร้างจากบิล/เอกสาร/ใบสั่งซื้อ (ref_type มีค่า) ห้ามลบ เพราะยอดจะไม่ตรงกับต้นทาง
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.transactions;
create policy "อ่านรายการเงินได้"
  on public.transactions for select to authenticated using (true);
create policy "เพิ่มรายการเงินได้"
  on public.transactions for insert to authenticated with check (true);
create policy "แก้รายการเงินได้"
  on public.transactions for update to authenticated using (true) with check (true);
create policy "ลบเฉพาะรายการที่กรอกเอง"
  on public.transactions for delete to authenticated using (ref_type is null);

-- ⭐ ตัดยอดค้าง (เก็บเงินลูกหนี้ / จ่ายเจ้าหนี้) — จ่ายบางส่วนได้
--    จ่ายครบ  → ปิดแถวเดิม (unpaid=false) ยอดรวมไม่เปลี่ยน
--    จ่ายบางส่วน → ลดยอดค้างของแถวเดิม แล้วแตกแถวใหม่ที่จ่ายแล้วออกมา (ยอดรวมเท่าเดิมเสมอ)
create or replace function public.settle_transaction(
  p_txn_id uuid,
  p_amount numeric default null,
  p_date   date    default null
)
returns public.transactions
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row  public.transactions;
  v_out  public.transactions;
  v_pay  numeric;
  v_when date := coalesce(p_date, current_date);
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_row from public.transactions where id = p_txn_id for update;
  if not found then
    raise exception 'ไม่พบรายการเงินที่ต้องการ';
  end if;
  if not v_row.unpaid then
    raise exception 'รายการนี้ตัดยอดไปแล้ว';
  end if;

  v_pay := coalesce(p_amount, v_row.amount);
  if v_pay <= 0 then
    raise exception 'จำนวนเงินต้องมากกว่า 0';
  end if;
  if v_pay > v_row.amount then
    raise exception 'มากกว่ายอดค้าง (ค้างอยู่ % บาท)', trim_scale(v_row.amount);
  end if;

  if v_pay = v_row.amount then
    update public.transactions
       set unpaid = false, settled_at = v_when
     where id = p_txn_id
     returning * into v_out;
  else
    update public.transactions
       set amount = amount - v_pay
     where id = p_txn_id;

    insert into public.transactions (
      date, type, amount, note, category, unpaid, settled_at,
      ref_type, ref_id, payee_name, payee_tax_id, payee_person_type
    )
    values (
      v_when, v_row.type, v_pay,
      v_row.note || case when v_row.type = 'เข้า'
                         then ' (รับชำระบางส่วน)'
                         else ' (จ่ายบางส่วน)' end,
      v_row.category, false, v_when,
      v_row.ref_type, v_row.ref_id,
      v_row.payee_name, v_row.payee_tax_id, v_row.payee_person_type
    )
    returning * into v_out;
  end if;

  return v_out;
end;
$$;

revoke all on function public.settle_transaction(uuid, numeric, date) from public, anon;
grant execute on function public.settle_transaction(uuid, numeric, date) to authenticated;

-- หมวดตั้งต้น — ใส่ให้ครั้งเดียว ลบ/เพิ่มทีหลังได้ตามใจ
insert into public.money_categories (name, type, sort_order)
select v.name, v.type, v.ord
from (values
  ('ขาย',          'เข้า', 1),
  ('รายได้อื่น',    'เข้า', 2),
  ('วัตถุดิบ',      'ออก', 1),
  ('ค่าขนส่ง',      'ออก', 2),
  ('เงินเดือน',     'ออก', 3),
  ('ค่าใช้จ่ายร้าน', 'ออก', 4)
) as v(name, type, ord)
where not exists (select 1 from public.money_categories);


-- ============================================================
-- 7. โมดูลเอกสารการค้า (เพิ่มรอบที่ 3 — รันซ้ำได้ ไม่กระทบของเดิม)
-- ============================================================

-- ข้อมูลร้าน — มีได้แถวเดียว ใช้พิมพ์หัวเอกสาร/ใบกำกับภาษี
create table if not exists public.shop_settings (
  id             boolean primary key default true check (id),
  shop_name      text not null default 'JAMAREE GAS',
  address        text not null default '',
  tax_id         text not null default '',
  branch         text not null default 'สำนักงานใหญ่',
  phone          text not null default '',
  vat_registered boolean not null default false,
  promptpay_id   text not null default '',
  updated_at     timestamptz not null default now()
);

insert into public.shop_settings (id) values (true) on conflict (id) do nothing;

-- ⭐ เลขรันเอกสาร — เดินหน้าอย่างเดียว แยกตามประเภท+ปีไทย
--    เก็บตัวนับไว้ในฐานข้อมูล ไม่ใช่นับจำนวนแถว (ลบเอกสารแล้วเลขจะซ้ำ)
create table if not exists public.doc_counters (
  prefix text not null,
  year   int  not null,
  n      int  not null default 0,
  primary key (prefix, year)
);

create or replace function public.doc_prefix(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
           when 'ใบเสนอราคา' then 'QT'
           when 'ใบแจ้งหนี้'  then 'IV'
           when 'ใบเสร็จ'    then 'RC'
           else 'DOC'
         end;
$$;

-- ขอเลขถัดไป — ปลอดภัยแม้หลายเครื่องกดพร้อมกัน (เว็บ + POS)
create or replace function public.next_doc_number(p_type text)
returns text
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_prefix text := public.doc_prefix(p_type);
  v_year   int  := extract(year from current_date)::int + 543;
  v_n      int;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  if v_prefix = 'DOC' then
    raise exception 'ไม่รู้จักประเภทเอกสาร: %', p_type;
  end if;

  insert into public.doc_counters (prefix, year, n)
  values (v_prefix, v_year, 1)
  on conflict (prefix, year)
  do update set n = public.doc_counters.n + 1
  returning n into v_n;

  return v_prefix || '-' || v_year || '-' || lpad(v_n::text, 3, '0');
end;
$$;

-- ⭐ แปลงเอกสาร: ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ
--    คัดลอกรายการเป็น snapshot ชุดใหม่ ไม่แตะเอกสารต้นทาง (นอกจากเปลี่ยนสถานะ)
--    ตอนออกใบเสร็จจะลงเงินเข้าให้อัตโนมัติ 1 แถว ผูกกลับด้วย ref_type='doc'
--    ยอดเงินที่รับจริง = amount − wht_amt (ผู้ซื้อหักภาษีไว้ก่อนโอน)
create or replace function public.convert_document(p_doc_id uuid, p_to_type text)
returns public.documents
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_src public.documents;
  v_new public.documents;
  v_received numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_src from public.documents where id = p_doc_id for update;
  if not found then
    raise exception 'ไม่พบเอกสารที่ต้องการ';
  end if;

  if p_to_type = 'ใบแจ้งหนี้' then
    if v_src.type <> 'ใบเสนอราคา' then
      raise exception 'แปลงเป็นใบแจ้งหนี้ได้เฉพาะใบเสนอราคา';
    end if;
  elsif p_to_type = 'ใบเสร็จ' then
    if v_src.type <> 'ใบแจ้งหนี้' then
      raise exception 'ออกใบเสร็จได้เฉพาะจากใบแจ้งหนี้';
    end if;
    if v_src.status = 'ชำระแล้ว' then
      raise exception 'ใบแจ้งหนี้นี้รับชำระไปแล้ว';
    end if;
  else
    raise exception 'แปลงเป็นเอกสารประเภทนี้ไม่ได้';
  end if;

  insert into public.documents (
    type, number, customer_id, order_id, items, amount, date, status, note,
    source_doc_id, vat_rate, vat_amt, base_amt,
    wht_type, wht_rate, wht_amt, transfer_amt
  )
  values (
    p_to_type,
    public.next_doc_number(p_to_type),
    v_src.customer_id, v_src.order_id, v_src.items, v_src.amount, current_date,
    case when p_to_type = 'ใบเสร็จ' then 'ชำระแล้ว' else 'ส่งแล้ว' end,
    case when p_to_type = 'ใบเสร็จ'
         then 'รับชำระจาก ' || v_src.number
         else 'แปลงจาก ' || v_src.number end,
    v_src.id, v_src.vat_rate, v_src.vat_amt, v_src.base_amt,
    v_src.wht_type, v_src.wht_rate, v_src.wht_amt, v_src.transfer_amt
  )
  returning * into v_new;

  if p_to_type = 'ใบเสร็จ' then
    v_received := v_src.amount - coalesce(v_src.wht_amt, 0);

    insert into public.transactions (
      date, type, amount, note, category, unpaid, settled_at,
      ref_type, ref_id, vat_amt, wht_amt, wht_rate
    )
    values (
      current_date, 'เข้า', v_received,
      'รับชำระ ' || v_src.number ||
        case when coalesce(v_src.wht_amt, 0) > 0
             then ' (หัก ณ ที่จ่ายแล้ว ' || trim_scale(v_src.wht_amt) || ' บาท)'
             else '' end,
      'ขาย', false, current_date,
      'doc', v_new.id, v_src.vat_amt, v_src.wht_amt, v_src.wht_rate
    );

    update public.documents set status = 'ชำระแล้ว' where id = v_src.id;
  end if;

  return v_new;
end;
$$;

revoke all on function public.next_doc_number(text) from public, anon;
revoke all on function public.convert_document(uuid, text) from public, anon;
grant execute on function public.next_doc_number(text) to authenticated;
grant execute on function public.convert_document(uuid, text) to authenticated;

alter table public.shop_settings enable row level security;
alter table public.doc_counters  enable row level security;

drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.shop_settings;
create policy "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้"
  on public.shop_settings for all to authenticated
  using (true) with check (true);

-- ตัวนับเลขเอกสารแก้มือไม่ได้ — ขยับผ่าน next_doc_number() เท่านั้น
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.doc_counters;
create policy "อ่านตัวนับเลขเอกสารได้"
  on public.doc_counters for select to authenticated using (true);

-- ⭐ ลบเอกสารได้เฉพาะตอนยังเป็น "ร่าง" — ส่งให้ลูกค้าแล้วห้ามลบ เลขที่ต้องเรียงต่อเนื่อง
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.documents;
create policy "อ่านเอกสารได้"
  on public.documents for select to authenticated using (true);
create policy "ออกเอกสารได้"
  on public.documents for insert to authenticated with check (true);
create policy "แก้เอกสารได้"
  on public.documents for update to authenticated using (true) with check (true);
create policy "ลบได้เฉพาะเอกสารร่าง"
  on public.documents for delete to authenticated using (status = 'ร่าง');


-- ============================================================
-- 8. โมดูลจัดซื้อ (เพิ่มรอบที่ 4 — รันซ้ำได้ ไม่กระทบของเดิม)
-- ============================================================

create table if not exists public.vendors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  phone      text,
  tax_id     text,
  address    text,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists vendors_name_idx on public.vendors (name);

-- ใบสั่งซื้อ — items คือ "ที่สั่ง", received_items คือ "ที่ได้จริง"
-- product_id เป็น null ได้ (พิมพ์ชื่อของเองก็สั่งได้ แต่รับแล้วจะไม่เข้าสต๊อก)
create table if not exists public.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  vendor_id      uuid not null references public.vendors (id) on delete restrict,
  date           date not null default current_date,
  items          jsonb not null default '[]'::jsonb,  -- [{product_id, name, qty, price}]
  received_items jsonb,                               -- เติมตอนกดรับของ
  status         text not null default 'ร่าง'
                   check (status in ('ร่าง', 'สั่งแล้ว', 'รับแล้ว', 'ยกเลิก')),
  received_at    date,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists po_vendor_idx on public.purchase_orders (vendor_id);
create index if not exists po_status_idx on public.purchase_orders (status, date desc);

-- เลขที่ PO — ใช้ตัวนับก้อนเดียวกับเอกสารขาย แต่แยก prefix 'PO' กันชนกัน
create or replace function public.next_po_number()
returns text
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_year int := extract(year from current_date)::int + 543;
  v_n    int;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  insert into public.doc_counters (prefix, year, n)
  values ('PO', v_year, 1)
  on conflict (prefix, year)
  do update set n = public.doc_counters.n + 1
  returning n into v_n;

  return 'PO-' || v_year || '-' || lpad(v_n::text, 3, '0');
end;
$$;

-- ⭐ รับของเข้าคลัง — หัวใจของโมดูลนี้ เกิดพร้อมกัน 3 อย่าง ถ้าพังกลางทางย้อนคืนหมด
--    1) สต๊อกเพิ่มผ่าน add_move() จุดเดียว (เฉพาะบรรทัดที่ผูกสินค้าไว้)
--    2) ตั้งเจ้าหนี้ 1 แถวในโมดูลการเงิน (unpaid=true) ตามยอด "ที่รับจริง" ไม่ใช่ยอดที่สั่ง
--    3) ปิดใบสั่งซื้อ
--    p_received = [{product_id, name, qty, price}] — ของมาไม่ครบก็ปิดใบได้ ใส่ qty เท่าที่ได้
create or replace function public.receive_po(p_po_id uuid, p_received jsonb)
returns public.purchase_orders
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_po     public.purchase_orders;
  v_vendor public.vendors;
  v_item   record;
  v_total  numeric(14, 2) := 0;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'ไม่พบใบสั่งซื้อที่ต้องการ';
  end if;
  if v_po.status = 'รับแล้ว' then
    raise exception 'ใบสั่งซื้อนี้รับของไปแล้ว';
  end if;
  if v_po.status = 'ยกเลิก' then
    raise exception 'ใบสั่งซื้อนี้ถูกยกเลิกไปแล้ว';
  end if;
  if v_po.status <> 'สั่งแล้ว' then
    raise exception 'ต้องกดส่งใบสั่งซื้อให้ผู้ขายก่อนถึงจะรับของได้';
  end if;

  select * into v_vendor from public.vendors where id = v_po.vendor_id;

  for v_item in
    select (e ->> 'product_id')::uuid as product_id,
           coalesce(e ->> 'name', '')  as name,
           coalesce((e ->> 'qty')::numeric, 0)   as qty,
           coalesce((e ->> 'price')::numeric, 0) as price
      from jsonb_array_elements(coalesce(p_received, '[]'::jsonb)) as e
  loop
    if v_item.qty <= 0 then
      continue;
    end if;

    v_total := v_total + v_item.qty * v_item.price;

    if v_item.product_id is not null then
      perform public.add_move(
        v_item.product_id, 'รับเข้า', v_item.qty,
        'รับของ ' || v_po.number, 'po', v_po.id);
    end if;
  end loop;

  if v_total > 0 then
    insert into public.transactions (
      date, type, amount, note, category, unpaid,
      ref_type, ref_id, payee_name, payee_tax_id
    )
    values (
      current_date, 'ออก', v_total,
      'ซื้อของ ' || v_po.number ||
        case when v_vendor.name is not null then ' — ' || v_vendor.name else '' end,
      'วัตถุดิบ', true,
      'po', v_po.id, v_vendor.name, v_vendor.tax_id
    );
  end if;

  update public.purchase_orders
     set received_items = coalesce(p_received, '[]'::jsonb),
         status         = 'รับแล้ว',
         received_at    = current_date
   where id = p_po_id
   returning * into v_po;

  return v_po;
end;
$$;

-- ยกเลิกใบสั่งซื้อ — เปลี่ยนสถานะอย่างเดียว ไม่แตะสต๊อก/เงิน (ห้ามลบ ประวัติต้องอยู่)
create or replace function public.cancel_po(p_po_id uuid)
returns public.purchase_orders
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_po public.purchase_orders;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'ไม่พบใบสั่งซื้อที่ต้องการ';
  end if;
  if v_po.status = 'รับแล้ว' then
    raise exception 'รับของเข้าคลังแล้ว ยกเลิกไม่ได้';
  end if;
  if v_po.status = 'ยกเลิก' then
    raise exception 'ใบสั่งซื้อนี้ถูกยกเลิกไปแล้ว';
  end if;

  update public.purchase_orders set status = 'ยกเลิก'
   where id = p_po_id
   returning * into v_po;

  return v_po;
end;
$$;

revoke all on function public.next_po_number() from public, anon;
revoke all on function public.receive_po(uuid, jsonb) from public, anon;
revoke all on function public.cancel_po(uuid) from public, anon;
grant execute on function public.next_po_number() to authenticated;
grant execute on function public.receive_po(uuid, jsonb) to authenticated;
grant execute on function public.cancel_po(uuid) to authenticated;

alter table public.vendors         enable row level security;
alter table public.purchase_orders enable row level security;

drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.vendors;
create policy "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้"
  on public.vendors for all to authenticated
  using (true) with check (true);

-- ⭐ ลบใบสั่งซื้อได้เฉพาะตอนยังเป็น "ร่าง" — ส่งให้ผู้ขายแล้วใช้ "ยกเลิก" แทน
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.purchase_orders;
create policy "อ่านใบสั่งซื้อได้"
  on public.purchase_orders for select to authenticated using (true);
create policy "เปิดใบสั่งซื้อได้"
  on public.purchase_orders for insert to authenticated with check (true);
create policy "แก้ใบสั่งซื้อได้"
  on public.purchase_orders for update to authenticated using (true) with check (true);
create policy "ลบได้เฉพาะใบสั่งซื้อร่าง"
  on public.purchase_orders for delete to authenticated using (status = 'ร่าง');


-- ============================================================
-- 9. โมดูลพนักงาน & เงินเดือน (เพิ่มรอบที่ 5 — รันซ้ำได้ ไม่กระทบของเดิม)
-- ============================================================

-- เวลาเข้างานกลางของร้าน — ใช้เช็คว่ามาสายไหม
alter table public.shop_settings add column if not exists work_start text not null default '09:00';

create table if not exists public.staff (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (length(btrim(name)) > 0),
  nickname             text,
  role                 text,
  phone                text,
  pay_type             text not null default 'รายเดือน'
                         check (pay_type in ('รายเดือน', 'รายวัน')),
  salary               numeric(14, 2) not null default 0 check (salary >= 0),
  daily_rate           numeric(14, 2) not null default 0 check (daily_rate >= 0),
  start_date           date,
  note                 text,
  -- 🔒 ข้อมูลส่วนตัว (PDPA) — กรอกเท่าที่จำเป็นต่อการจ่ายเงิน
  address              text,
  bank_name            text,
  bank_account         text,
  leave_quota_override jsonb not null default '{}'::jsonb,  -- { ประเภทลา: จำนวนวัน }
  terminated_at        date,   -- มีค่า = พ้นสภาพ (ประวัติยังอยู่ แต่ไม่เข้างวดใหม่)
  termination_reason   text,
  created_at           timestamptz not null default now()
);

create index if not exists staff_active_idx on public.staff (name) where terminated_at is null;

-- ผูกออเดอร์กับพนักงานผู้รับผิดชอบ (คอลัมน์ assignee_id มีอยู่แล้วตั้งแต่ส่วนที่ 2)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_assignee_fk'
  ) then
    alter table public.orders
      add constraint orders_assignee_fk
      foreign key (assignee_id) references public.staff (id) on delete set null;
  end if;
end;
$$;

-- ประเภทการลา + โควตาต่อปี — เจ้าของเพิ่ม/แก้เองได้
create table if not exists public.leave_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) > 0),
  quota_days numeric(6, 1) not null default 0 check (quota_days >= 0),
  created_at timestamptz not null default now()
);

-- ลงเวลา — 1 คน 1 วัน ได้แถวเดียว
create table if not exists public.timelogs (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff (id) on delete cascade,
  date       date not null default current_date,
  in_at      time,
  out_at     time,
  note       text,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);

create index if not exists timelogs_date_idx on public.timelogs (date desc);

create table if not exists public.leaves (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff (id) on delete cascade,
  type       text not null,
  status     text not null default 'ขอ' check (status in ('ขอ', 'อนุมัติ', 'ไม่อนุมัติ')),
  date_from  date not null,
  date_to    date not null,
  days       numeric(6, 1) not null default 1 check (days > 0),
  note       text,
  created_at timestamptz not null default now(),
  constraint leaves_date_order check (date_to >= date_from)
);

create index if not exists leaves_staff_idx on public.leaves (staff_id, date_from desc);

-- งวดเงินเดือน — rows คือ snapshot ทั้งก้อน
-- แก้ทะเบียนพนักงาน/ลงเวลาทีหลัง จะไม่กระทบงวดที่ทำไปแล้ว
create table if not exists public.payrolls (
  id              uuid primary key default gen_random_uuid(),
  period          text not null unique,   -- 'YYYY-MM'
  sso_rate        numeric(6, 2)  not null default 5,
  sso_floor       numeric(14, 2) not null default 1650,
  sso_salary_cap  numeric(14, 2) not null default 15000,
  rows            jsonb not null default '[]'::jsonb,
  status          text not null default 'ร่าง' check (status in ('ร่าง', 'จ่ายแล้ว')),
  paid_at         date,
  created_at      timestamptz not null default now()
);

-- ⭐ ภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได (คิดจากเงินเดือนต่อเดือน)
--    หักค่าใช้จ่าย 50% (ไม่เกิน 100,000) + ค่าลดหย่อนส่วนตัว 60,000 + ปกส.ทั้งปี
create or replace function public.pit_monthly(
  p_monthly_gross numeric,
  p_monthly_sso   numeric default 0
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_year_income numeric := coalesce(p_monthly_gross, 0) * 12;
  v_net         numeric;
  v_tax         numeric := 0;
begin
  v_net := v_year_income
           - least(v_year_income * 0.5, 100000)   -- ค่าใช้จ่าย
           - 60000                                -- ลดหย่อนส่วนตัว
           - coalesce(p_monthly_sso, 0) * 12;     -- ประกันสังคม

  if v_net <= 150000 then
    return 0;
  end if;

  v_tax := v_tax + (least(v_net, 300000)  - 150000) * 0.05;
  if v_net > 300000 then
    v_tax := v_tax + (least(v_net, 500000)  - 300000) * 0.10;
  end if;
  if v_net > 500000 then
    v_tax := v_tax + (least(v_net, 750000)  - 500000) * 0.15;
  end if;
  if v_net > 750000 then
    v_tax := v_tax + (least(v_net, 1000000) - 750000) * 0.20;
  end if;
  if v_net > 1000000 then
    v_tax := v_tax + (least(v_net, 2000000) - 1000000) * 0.25;
  end if;
  if v_net > 2000000 then
    v_tax := v_tax + (least(v_net, 5000000) - 2000000) * 0.30;
  end if;
  if v_net > 5000000 then
    v_tax := v_tax + (v_net - 5000000) * 0.35;
  end if;

  return round(v_tax / 12, 2);
end;
$$;

-- ⭐ สร้าง/คำนวณงวดเงินเดือนใหม่ — แช่ผลลัพธ์เป็น snapshot
--    รายเดือน → ได้เต็มเดือน · รายวัน → อัตราต่อวัน × วันที่มาทำงานจริง
--    ปกส. = 5% ของฐาน (ขั้นต่ำ 1,650 เพดาน 15,000) → สูงสุด 750 บาท/เดือน
create or replace function public.build_payroll(p_period text)
returns public.payrolls
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_pay    public.payrolls;
  v_from   date;
  v_to     date;
  v_rows   jsonb := '[]'::jsonb;
  v_s      record;
  v_days   int;
  v_gross  numeric;
  v_sso    numeric;
  v_tax    numeric;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' then
    raise exception 'รูปแบบงวดไม่ถูกต้อง ต้องเป็น ปี-เดือน เช่น 2026-09';
  end if;

  v_from := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_to   := (v_from + interval '1 month - 1 day')::date;

  select * into v_pay from public.payrolls where period = p_period for update;
  if found and v_pay.status = 'จ่ายแล้ว' then
    raise exception 'งวดนี้จ่ายเงินไปแล้ว คำนวณใหม่ไม่ได้';
  end if;

  if not found then
    insert into public.payrolls (period) values (p_period) returning * into v_pay;
  end if;

  for v_s in
    select * from public.staff
     where terminated_at is null or terminated_at >= v_from
     order by name
  loop
    select count(*) into v_days
      from public.timelogs t
     where t.staff_id = v_s.id
       and t.date between v_from and v_to
       and t.in_at is not null;

    if v_s.pay_type = 'รายวัน' then
      v_gross := round(v_s.daily_rate * v_days, 2);
    else
      v_gross := round(v_s.salary, 2);
    end if;

    -- ปกส. คิดจากฐานที่ถูกบีบให้อยู่ในช่วง ขั้นต่ำ–เพดาน
    if v_gross <= 0 then
      v_sso := 0;
    else
      v_sso := round(
        least(greatest(v_gross, v_pay.sso_floor), v_pay.sso_salary_cap)
        * v_pay.sso_rate / 100, 2);
    end if;

    v_tax := public.pit_monthly(v_gross, v_sso);

    v_rows := v_rows || jsonb_build_object(
      'staff_id',     v_s.id,
      'name',         v_s.name,
      'pay_type',     v_s.pay_type,
      'daily_rate',   v_s.daily_rate,
      'present_days', v_days,
      'salary',       v_gross,
      'gross',        v_gross,
      'sso_amt',      v_sso,
      'tax_amt',      v_tax,
      'other_deduct', 0,
      'net',          round(v_gross - v_sso - v_tax, 2)
    );
  end loop;

  update public.payrolls set rows = v_rows
   where id = v_pay.id
   returning * into v_pay;

  return v_pay;
end;
$$;

-- ⭐ จ่ายเงินเดือน — ปิดงวด + ลงรายจ่ายก้อนเดียวในโมดูลการเงิน (ยอดรวมสุทธิ)
create or replace function public.pay_payroll(p_payroll_id uuid)
returns public.payrolls
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_pay public.payrolls;
  v_net numeric;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_pay from public.payrolls where id = p_payroll_id for update;
  if not found then
    raise exception 'ไม่พบงวดเงินเดือนที่ต้องการ';
  end if;
  if v_pay.status = 'จ่ายแล้ว' then
    raise exception 'งวดนี้จ่ายเงินไปแล้ว';
  end if;

  select coalesce(sum((e ->> 'net')::numeric), 0) into v_net
    from jsonb_array_elements(v_pay.rows) as e;

  if v_net <= 0 then
    raise exception 'งวดนี้ยอดจ่ายเป็นศูนย์ ยังจ่ายไม่ได้';
  end if;

  insert into public.transactions (
    date, type, amount, note, category, unpaid, settled_at, ref_type, ref_id
  )
  values (
    current_date, 'ออก', round(v_net, 2),
    'จ่ายเงินเดือนงวด ' || v_pay.period,
    'เงินเดือน', false, current_date, 'payroll', v_pay.id
  );

  update public.payrolls
     set status = 'จ่ายแล้ว', paid_at = current_date
   where id = p_payroll_id
   returning * into v_pay;

  return v_pay;
end;
$$;

revoke all on function public.pit_monthly(numeric, numeric) from public, anon;
revoke all on function public.build_payroll(text) from public, anon;
revoke all on function public.pay_payroll(uuid) from public, anon;
grant execute on function public.pit_monthly(numeric, numeric) to authenticated;
grant execute on function public.build_payroll(text) to authenticated;
grant execute on function public.pay_payroll(uuid) to authenticated;

alter table public.staff       enable row level security;
alter table public.leave_types enable row level security;
alter table public.timelogs    enable row level security;
alter table public.leaves      enable row level security;
alter table public.payrolls    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['staff', 'leave_types', 'timelogs', 'leaves']
  loop
    execute format(
      'drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.%I', t
    );
    execute format(
      'create policy "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.%I
         for all to authenticated using (true) with check (true)', t
    );
  end loop;
end;
$$;

-- ⭐ งวดที่จ่ายไปแล้วห้ามแก้/ห้ามลบ — ตัวเลขต้องตรงกับเงินที่โอนออกไปจริง
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.payrolls;
create policy "อ่านงวดเงินเดือนได้"
  on public.payrolls for select to authenticated using (true);
create policy "เปิดงวดเงินเดือนได้"
  on public.payrolls for insert to authenticated with check (true);
create policy "แก้ได้เฉพาะงวดร่าง"
  on public.payrolls for update to authenticated
  using (status = 'ร่าง') with check (true);
create policy "ลบได้เฉพาะงวดร่าง"
  on public.payrolls for delete to authenticated using (status = 'ร่าง');

-- ประเภทการลาตั้งต้น
insert into public.leave_types (name, quota_days)
select v.name, v.quota
from (values ('ลากิจ', 6), ('ลาป่วย', 30), ('ลาพักร้อน', 6)) as v(name, quota)
where not exists (select 1 from public.leave_types);


-- ============================================================
-- 10. โมดูลถังแก๊ส (เพิ่มรอบที่ 6 — หัวใจของธุรกิจ รันซ้ำได้)
--
-- แนวคิด: "ถัง" ไม่ได้เก็บแยกเป็นตารางใหม่ — ถังคือสินค้าในตาราง products อยู่แล้ว
--   ถังเปล่า (kind='เปล่า') · ถังเต็ม (kind='เต็ม') · ถังชำรุด · ถังต่างยี่ห้อ · ถังใหม่
-- ตารางสต๊อกถังจึงเป็น "มุมมอง" (view) ที่รวมยอดจาก products ให้ดูง่ายเป็นราย ๆ ขนาด
-- ไม่เก็บตัวเลขซ้ำสองที่ และยังขยับผ่าน add_move() จุดเดียวเหมือนเดิม
-- ============================================================

-- เพิ่มชนิด 'เต็ม' (ถังที่บรรจุแก๊สแล้ว พร้อมขาย)
alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check
  check (kind in ('', 'ดิบ', 'น้ำแก๊ส', 'เปล่า', 'เต็ม', 'ใหม่', 'ชำรุด',
                  'ต่างยี่ห้อ', 'หมุนเวียน', 'เตาแก๊ส', 'อุปกรณ์แก๊ส', 'บริการ'));

-- เพิ่มที่มาของรายการ: 'fill' = การบรรจุ · 'deposit' = มัดจำถัง
alter table public.stock_moves drop constraint if exists stock_moves_ref_type_check;
alter table public.stock_moves add constraint stock_moves_ref_type_check
  check (ref_type in ('order', 'doc', 'po', 'payroll', 'custody', 'fill', 'deposit'));

alter table public.transactions drop constraint if exists transactions_ref_type_check;
alter table public.transactions add constraint transactions_ref_type_check
  check (ref_type in ('order', 'doc', 'po', 'payroll', 'custody', 'fill', 'deposit'));

-- ขนาดถังที่ร้านมี + ค่ามัดจำต่อใบ
create table if not exists public.cylinder_sizes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (length(btrim(name)) > 0),
  sort_order    int  not null default 0,
  deposit_price numeric(14, 2) not null default 0 check (deposit_price >= 0),
  created_at    timestamptz not null default now()
);

insert into public.cylinder_sizes (name, sort_order, deposit_price)
select v.name, v.ord, v.price
from (values ('4kg', 1, 0), ('7kg', 2, 0), ('15kg', 3, 0), ('48kg', 4, 0))
     as v(name, ord, price)
where not exists (select 1 from public.cylinder_sizes);

-- ⭐ สต๊อกถังรายขนาด — รวมยอดจาก products ไม่เก็บซ้ำ
create or replace view public.cylinder_stock
with (security_invoker = true) as
select
  s.name       as size,
  s.sort_order as sort_order,
  coalesce(sum(p.stock) filter (where p.kind = 'เต็ม'),       0) as filled,
  coalesce(sum(p.stock) filter (where p.kind = 'เปล่า'),      0) as empty,
  coalesce(sum(p.stock) filter (where p.kind = 'ชำรุด'),      0) as damaged,
  coalesce(sum(p.stock) filter (where p.kind = 'ต่างยี่ห้อ'),  0) as other_brand,
  coalesce(sum(p.stock) filter (where p.kind = 'ใหม่'),       0) as new_cyl,
  coalesce((
    select sum(case when c.type = 'ยืม' then c.qty
                    when c.type = 'คืน' then -c.qty else 0 end)
      from public.cylinder_custody c where c.size = s.name
  ), 0) as at_customer
from public.cylinder_sizes s
left join public.products p
       on coalesce(nullif(btrim(p.size), ''), '') = s.name and p.active
group by s.name, s.sort_order;

-- ⭐ บันทึกการบรรจุ — งานหลักของโรงบรรจุ เกิดพร้อมกัน 3 อย่าง ถ้าพังย้อนคืนหมด
--    ถังเปล่า −จำนวน · แก๊สดิบ −(จำนวน × กิโลต่อถัง) · ถังเต็ม +จำนวน
create or replace function public.fill_cylinders(
  p_size text,
  p_qty  numeric,
  p_note text default ''
)
returns public.products
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_empty public.products;
  v_full  public.products;
  v_raw   public.products;
  v_kg    numeric;
  v_size  text := btrim(coalesce(p_size, ''));
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนถังต้องมากกว่า 0';
  end if;

  select * into v_empty from public.products
   where kind = 'เปล่า' and btrim(coalesce(size, '')) = v_size and active
   order by created_at limit 1;
  if not found then
    raise exception 'ยังไม่ได้ตั้งสินค้า "ถังเปล่า" ขนาด %', v_size;
  end if;

  select * into v_full from public.products
   where kind = 'เต็ม' and btrim(coalesce(size, '')) = v_size and active
   order by created_at limit 1;
  if not found then
    raise exception 'ยังไม่ได้ตั้งสินค้า "ถังเต็ม" ขนาด %', v_size;
  end if;

  -- กิโลแก๊สต่อถัง: เอาจากถังเต็มก่อน ถ้าไม่ได้ใส่ไว้ค่อยไปดูจากสินค้าน้ำแก๊สขนาดเดียวกัน
  v_kg := v_full.fill_kg;
  if v_kg is null or v_kg <= 0 then
    select fill_kg into v_kg from public.products
     where kind in ('น้ำแก๊ส', 'หมุนเวียน')
       and btrim(coalesce(size, '')) = v_size and active
     order by created_at limit 1;
  end if;
  if v_kg is null or v_kg <= 0 then
    raise exception 'ยังไม่ได้ระบุกิโลแก๊สต่อถังของขนาด %', v_size;
  end if;

  select * into v_raw from public.products where kind = 'ดิบ';
  if not found then
    raise exception 'ยังไม่ได้ตั้งสินค้าแก๊สดิบ (ถังเก็บใหญ่) ในระบบ';
  end if;

  perform public.add_move(v_empty.id, 'เบิกออก', p_qty,
    coalesce(nullif(p_note, ''), 'บรรจุแก๊ส ' || v_size), 'fill', null);
  perform public.add_move(v_raw.id, 'เบิกออก', p_qty * v_kg,
    'บรรจุแก๊ส ' || v_size || ' x' || trim_scale(p_qty), 'fill', null);
  perform public.add_move(v_full.id, 'รับเข้า', p_qty,
    coalesce(nullif(p_note, ''), 'บรรจุแก๊ส ' || v_size), 'fill', null);

  select * into v_full from public.products where id = v_full.id;
  return v_full;
end;
$$;

-- ============ มัดจำถัง ============

create table if not exists public.cylinder_deposits (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  customer_id uuid not null references public.customers (id) on delete restrict,
  size        text not null,
  type        text not null check (type in ('รับมัดจำ', 'คืนมัดจำ')),
  qty         numeric(14, 3) not null check (qty > 0),
  amount      numeric(14, 2) not null default 0 check (amount >= 0),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists deposits_customer_idx
  on public.cylinder_deposits (customer_id, size);

-- ยอดมัดจำคงเหลือรายลูกค้า/ขนาด — จำนวนถังที่ลูกค้ายังวางมัดจำไว้ + เงินที่ต้องคืน
create or replace view public.cylinder_deposit_balances
with (security_invoker = true) as
select customer_id,
       size,
       sum(case when type = 'รับมัดจำ' then qty    else -qty    end) as qty,
       sum(case when type = 'รับมัดจำ' then amount else -amount end) as amount
  from public.cylinder_deposits
 group by customer_id, size
having sum(case when type = 'รับมัดจำ' then qty else -qty end) <> 0;

-- ⭐ รับ/คืนมัดจำ — บันทึกถัง + ลงเงินในโมดูลการเงินพร้อมกันเสมอ
--    รับมัดจำ = เงินเข้า · คืนมัดจำ = เงินออก (คืนเกินที่วางไว้ไม่ได้)
create or replace function public.add_deposit(
  p_customer_id uuid,
  p_size        text,
  p_type        text,
  p_qty         numeric,
  p_amount      numeric,
  p_date        date default null,
  p_note        text default ''
)
returns public.cylinder_deposits
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row  public.cylinder_deposits;
  v_cus  public.customers;
  v_have numeric;
  v_when date := coalesce(p_date, current_date);
  v_size text := btrim(coalesce(p_size, ''));
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  if p_type not in ('รับมัดจำ', 'คืนมัดจำ') then
    raise exception 'ประเภทมัดจำไม่ถูกต้อง: %', p_type;
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนถังต้องมากกว่า 0';
  end if;
  if v_size = '' then
    raise exception 'ต้องเลือกขนาดถัง';
  end if;

  select * into v_cus from public.customers where id = p_customer_id;
  if not found then
    raise exception 'ไม่พบลูกค้าที่ต้องการ';
  end if;

  if p_type = 'คืนมัดจำ' then
    select coalesce(sum(case when type = 'รับมัดจำ' then qty else -qty end), 0)
      into v_have
      from public.cylinder_deposits
     where customer_id = p_customer_id and size = v_size;

    if p_qty > v_have then
      raise exception 'คืนมากกว่าที่วางมัดจำไว้ (วางไว้ % ใบ)', trim_scale(v_have);
    end if;
  end if;

  insert into public.cylinder_deposits (date, customer_id, size, type, qty, amount, note)
  values (v_when, p_customer_id, v_size, p_type, p_qty,
          round(coalesce(p_amount, 0), 2), coalesce(p_note, ''))
  returning * into v_row;

  if v_row.amount > 0 then
    insert into public.transactions (
      date, type, amount, note, category, unpaid, settled_at, ref_type, ref_id
    )
    values (
      v_when,
      case when p_type = 'รับมัดจำ' then 'เข้า' else 'ออก' end,
      v_row.amount,
      p_type || 'ถัง ' || v_size || ' x' || trim_scale(p_qty) || ' — ' || v_cus.name,
      'มัดจำถัง', false, v_when, 'deposit', v_row.id
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.fill_cylinders(text, numeric, text) from public, anon;
revoke all on function public.add_deposit(uuid, text, text, numeric, numeric, date, text)
  from public, anon;
grant execute on function public.fill_cylinders(text, numeric, text) to authenticated;
grant execute on function public.add_deposit(uuid, text, text, numeric, numeric, date, text)
  to authenticated;
grant select on public.cylinder_stock to authenticated;
grant select on public.cylinder_deposit_balances to authenticated;

alter table public.cylinder_sizes    enable row level security;
alter table public.cylinder_deposits enable row level security;

drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.cylinder_sizes;
create policy "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้"
  on public.cylinder_sizes for all to authenticated
  using (true) with check (true);

-- ⭐ ประวัติมัดจำห้ามแก้/ห้ามลบ — เงินออกไปแล้วต้องตรงกับที่บันทึก
drop policy if exists "ผู้ใช้ที่ล็อกอินแล้วใช้งานได้" on public.cylinder_deposits;
create policy "อ่านประวัติมัดจำได้"
  on public.cylinder_deposits for select to authenticated using (true);

-- หมวดเงินสำหรับมัดจำถัง (เพิ่มให้ทั้งฝั่งเข้าและออก)
insert into public.money_categories (name, type, sort_order)
values ('มัดจำถัง', 'เข้า', 9), ('มัดจำถัง', 'ออก', 9)
on conflict (type, name) do nothing;


-- ============ 10.5 ผูก "ถังเต็ม" เข้ากับการขาย ============
-- ⭐ ปัญหาที่ต้องกัน: ถ้าตัดแก๊สดิบตอนบรรจุ แล้วตัดอีกทีตอนขาย = แก๊สหายสองรอบ
--    กติกาใหม่ (ยังเข้ากับของเดิมได้ทั้งหมด):
--      • ถ้ามีสินค้า "ถังเต็ม" ขนาดเดียวกัน → ขายแล้วตัดถังเต็ม + รับถังเปล่ากลับ (ถังแลกถัง)
--        ไม่ตัดแก๊สดิบซ้ำ เพราะตัดไปแล้วตอนบรรจุ
--      • ถ้ายังไม่ได้ตั้งสินค้าถังเต็ม → ทำงานเหมือนเดิมทุกอย่าง (ตัดแก๊สดิบตอนขาย)

create or replace function public.full_cyl_id(p_size text)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select id from public.products
   where kind = 'เต็ม'
     and btrim(coalesce(size, '')) = btrim(coalesce(p_size, ''))
     and active
   order by created_at limit 1;
$$;

create or replace function public.empty_cyl_id(p_size text)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select id from public.products
   where kind = 'เปล่า'
     and btrim(coalesce(size, '')) = btrim(coalesce(p_size, ''))
     and active
   order by created_at limit 1;
$$;

grant execute on function public.full_cyl_id(text)  to authenticated;
grant execute on function public.empty_cyl_id(text) to authenticated;

create or replace function public.complete_order(p_order_id uuid)
returns public.orders
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order    public.orders;
  v_raw      public.products;
  v_raw_kg   numeric := 0;
  v_total    numeric;
  v_remain   numeric;
  v_short    record;
  v_item     record;
  v_full_id  uuid;
  v_empty_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ไม่พบออเดอร์ที่ต้องการ';
  end if;
  if v_order.voided then
    raise exception 'ออเดอร์นี้ถูกยกเลิกไปแล้ว';
  end if;
  if v_order.stock_deducted then
    raise exception 'ออเดอร์นี้ปิดไปแล้ว';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'ออเดอร์นี้ยังไม่มีรายการสินค้า';
  end if;

  -- 1) แก๊สดิบที่ต้องใช้ — นับเฉพาะไซส์ที่ "ยังไม่มีถังเต็ม" ในระบบ
  select coalesce(sum(oi.qty * p.fill_kg), 0)
    into v_raw_kg
    from public.order_items oi
    join public.products p on p.id = oi.product_id
   where oi.order_id = p_order_id
     and p.kind in ('น้ำแก๊ส', 'หมุนเวียน')
     and public.full_cyl_id(p.size) is null;

  -- 2) ของที่มีสต๊อกของตัวเอง ต้องพอ
  select p.name as name, p.stock as stock
    into v_short
    from public.order_items oi
    join public.products p on p.id = oi.product_id
   where oi.order_id = p_order_id
     and p.kind not in ('น้ำแก๊ส', 'หมุนเวียน', 'บริการ')
   group by p.id, p.name, p.stock
  having sum(oi.qty) > p.stock
   limit 1;
  if found then
    raise exception 'ของไม่พอ: % เหลือ %', v_short.name, trim_scale(v_short.stock);
  end if;

  -- 2.5) ถังเต็มต้องพอ (รวมทุกบรรทัดที่ใช้ถังเต็มใบเดียวกัน)
  select f.name as name, f.stock as stock
    into v_short
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.products f on f.id = public.full_cyl_id(p.size)
   where oi.order_id = p_order_id
     and p.kind in ('น้ำแก๊ส', 'หมุนเวียน')
   group by f.id, f.name, f.stock
  having sum(oi.qty) > f.stock
   limit 1;
  if found then
    raise exception 'ถังเต็มไม่พอ: % เหลือ %', v_short.name, trim_scale(v_short.stock);
  end if;

  -- 3) แก๊สดิบในถังเก็บใหญ่พอไหม
  if v_raw_kg > 0 then
    select * into v_raw from public.products where kind = 'ดิบ';
    if not found then
      raise exception 'ยังไม่ได้ตั้งสินค้าแก๊สดิบ (ถังเก็บใหญ่) ในระบบ';
    end if;
    if v_raw.stock < v_raw_kg then
      raise exception 'แก๊สดิบไม่พอ: ต้องใช้ % kg เหลือ % kg',
        trim_scale(v_raw_kg), trim_scale(v_raw.stock);
    end if;
  end if;

  -- 4) ตัดสต๊อกจริง
  for v_item in
    select oi.qty, p.id as product_id, p.kind, p.fill_kg, p.name, p.size
      from public.order_items oi
      join public.products p on p.id = oi.product_id
     where oi.order_id = p_order_id
  loop
    if v_item.kind = 'บริการ' then
      continue;

    elsif v_item.kind in ('น้ำแก๊ส', 'หมุนเวียน') then
      v_full_id := public.full_cyl_id(v_item.size);

      if v_full_id is not null then
        -- ขายถังเต็ม แล้วรับถังเปล่ากลับเข้าคลัง (ถังแลกถัง)
        perform public.add_move(v_full_id, 'เบิกออก', v_item.qty,
          'ขายถังเต็ม ' || coalesce(nullif(v_item.size, ''), v_item.name),
          'order', p_order_id);

        v_empty_id := public.empty_cyl_id(v_item.size);
        if v_empty_id is not null then
          perform public.add_move(v_empty_id, 'รับเข้า', v_item.qty,
            'รับถังเปล่าคืน (ถังแลกถัง)', 'order', p_order_id);
        end if;
      else
        if v_raw.id is null then
          select * into v_raw from public.products where kind = 'ดิบ';
        end if;
        perform public.add_move(
          v_raw.id, 'เบิกออก', v_item.qty * v_item.fill_kg,
          'ขายแก๊ส ' || coalesce(nullif(v_item.size, ''), v_item.name)
            || ' x' || trim_scale(v_item.qty),
          'order', p_order_id);
      end if;

    else
      perform public.add_move(
        v_item.product_id, 'เบิกออก', v_item.qty, 'ขาย/ออเดอร์', 'order', p_order_id);
    end if;
  end loop;

  -- 5) ลงบัญชี — จ่ายผสมได้ (สด + โอน) ส่วนที่เหลือเป็นลูกหนี้อัตโนมัติ
  v_total  := public.order_total(p_order_id);
  v_remain := greatest(0, v_total - v_order.paid_cash - v_order.paid_transfer);

  if v_order.paid_cash > 0 then
    insert into public.transactions (date, type, amount, note, category, ref_type, ref_id)
    values (v_order.date, 'เข้า', v_order.paid_cash, 'ขายออเดอร์ (สด)', 'ขาย', 'order', p_order_id);
  end if;
  if v_order.paid_transfer > 0 then
    insert into public.transactions (date, type, amount, note, category, ref_type, ref_id)
    values (v_order.date, 'เข้า', v_order.paid_transfer, 'ขายออเดอร์ (โอน)', 'ขาย', 'order', p_order_id);
  end if;
  if v_remain > 0 then
    insert into public.transactions (date, type, amount, note, category, ref_type, ref_id, unpaid)
    values (v_order.date, 'เข้า', v_remain, 'ขายออเดอร์ (ค้างชำระ)', 'ขาย', 'order', p_order_id, true);
  end if;

  -- 6) ปิดออเดอร์ — work_stage บังคับเป็น 'ปิด' เสมอ
  update public.orders
     set stock_deducted = true,
         status         = 'เสร็จ',
         work_stage     = 'ปิด'
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ยกเลิกบิล — ย้อนทุกอย่างกลับตามทางที่ตัดไป
create or replace function public.void_order(p_order_id uuid)
returns public.orders
security definer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_order    public.orders;
  v_raw      public.products;
  v_item     record;
  v_full_id  uuid;
  v_empty_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ไม่พบออเดอร์ที่ต้องการ';
  end if;
  if v_order.voided then
    raise exception 'ออเดอร์นี้ถูกยกเลิกไปแล้ว';
  end if;

  if v_order.stock_deducted then
    select * into v_raw from public.products where kind = 'ดิบ';

    for v_item in
      select oi.qty, p.id as product_id, p.kind, p.fill_kg, p.size
        from public.order_items oi
        join public.products p on p.id = oi.product_id
       where oi.order_id = p_order_id
    loop
      if v_item.kind = 'บริการ' then
        continue;

      elsif v_item.kind in ('น้ำแก๊ส', 'หมุนเวียน') then
        v_full_id := public.full_cyl_id(v_item.size);

        if v_full_id is not null then
          perform public.add_move(v_full_id, 'รับเข้า', v_item.qty,
            'ยกเลิกบิล (คืนถังเต็ม)', 'order', p_order_id);

          v_empty_id := public.empty_cyl_id(v_item.size);
          if v_empty_id is not null then
            perform public.add_move(v_empty_id, 'เบิกออก', v_item.qty,
              'ยกเลิกบิล (คืนถังเปล่าให้ลูกค้า)', 'order', p_order_id);
          end if;
        else
          perform public.add_move(v_raw.id, 'รับเข้า', v_item.qty * v_item.fill_kg,
            'ยกเลิกบิล (คืนสต๊อก)', 'order', p_order_id);
        end if;

      else
        perform public.add_move(v_item.product_id, 'รับเข้า', v_item.qty,
          'ยกเลิกบิล (คืนสต๊อก)', 'order', p_order_id);
      end if;
    end loop;

    delete from public.transactions where ref_type = 'order' and ref_id = p_order_id;
  end if;

  update public.orders
     set voided = true, status = 'ยกเลิก'
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;


-- ============================================================
-- 11. ความจุถังเก็บใหญ่ (เพิ่มรอบที่ 7 — รันซ้ำได้)
-- เก็บที่ข้อมูลร้าน ไม่ใช่ที่สินค้า — เพราะเป็น "ขนาดถัง" ไม่ใช่จำนวนแก๊สที่มี
-- ใช้คิดเปอร์เซ็นต์แก๊สคงเหลือบนหน้าแดชบอร์ด (0 = ยังไม่ได้ตั้ง)
-- ============================================================

alter table public.shop_settings
  add column if not exists bulk_tank_kg numeric(14, 2) not null default 0;

comment on column public.shop_settings.bulk_tank_kg is
  'ความจุถังเก็บแก๊สใหญ่ (กิโล) — ใช้คิด % ที่เหลือบนหน้าแดชบอร์ด · 0 = ยังไม่ได้ตั้ง';


