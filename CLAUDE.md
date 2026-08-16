# CLAUDE.md — รัฐธรรมนูญระบบ "JAMAREE GAS"

> ไฟล์นี้คือกติกากลางของโปรเจกต์ วาง Claude Code ไว้ในโฟลเดอร์นี้แล้วสั่งงานเป็นภาษาคนได้เลย
> Claude จะอ่านไฟล์นี้ก่อนเสมอ แล้วทำตามแนวทาง สี โครงข้อมูล และกฎด้านล่าง — ไม่หลุดกรอบ ไม่มั่ว
>
> 🦴 **เรื่องโครงสร้างข้อมูล (id/key, ความสัมพันธ์, derived vs snapshot, พิมพ์เขียวแต่ละโมดูล) อ่าน `ARCHITECTURE.md`** — ไฟล์นี้ = หน้าตา+มารยาท · ARCHITECTURE.md = โครงกระดูก
> เพิ่มโมดูลใหม่: พิมพ์สั้น ๆ เช่น **"สร้างโมดูลลูกค้า"** สกิล `/new-module` จะอ่าน ARCHITECTURE.md แล้ววางโครงให้ถูกเอง ไม่ต้องกรอกเงื่อนไข

> ธุรกิจ: **JAMAREE GAS** — โรงบรรจุแก๊ส (รับแก๊สดิบเข้าถังใหญ่ → บรรจุแยกขนาด → ขายทั้งถังแลกถัง/ถังใหม่)

---

## โครงโฟลเดอร์ (อ่านก่อนแตะไฟล์ไหน)
- **`index.html`** — หน้าแลนดิ้งเพจโฆษณาลูกค้า (ของทีมการตลาด) **ไม่ใช่หน้ารวมของระบบ ไม่มีตรรกะธุรกิจ ห้ามสกิลระบบ/โมดูลไปแตะไฟล์นี้**
- **`erp.html`** — **แอปหลักที่ใช้งานจริง** ข้อมูลทั้งหมดของธุรกิจอยู่ที่นี่ที่เดียว (localStorage) — ไฟล์นี้คือ SSOT ตามที่อธิบายด้านล่าง แก้/เพิ่มโมดูลทั้งหมดทำที่ไฟล์นี้ (ยกมาจากสวีท BizSuite ตอนเริ่มโปรเจกต์ พร้อมแบรนด์ JAMAREE GAS อยู่แล้ว)
- **`PROMPTS.md`** — พรอมต์สำเร็จรูปก๊อปวางได้ทันทีสำหรับสั่งงาน AI ต่อจากนี้ (อ้างอิงจากสวีทตั้งต้น อาจมีบางพรอมต์ไม่ตรงบริบทโรงแก๊ส 100% ใช้เป็นแนวทางได้)

---

## ระบบนี้คืออะไร (เป้าหมาย)
ระบบจัดการ "กองงาน" ของเจ้าของกิจการคนเดียว — รวมเรื่องที่กระจัดกระจายอยู่ใน LINE/กระดาษ/Excel มาไว้ที่เดียว:
**ลูกค้า → งาน/ออเดอร์ → เงินเข้า-ออก** แล้วสรุปออกมาเป็นหน้า "งานวันนี้"

หลักคิด: ระบบนี้เป็น **ของเจ้าของ** — สั่งให้มันเป็นแบบไหนก็ได้ ไม่ต้องจ่ายรายเดือน ไม่ต้องเป็นโปรแกรมเมอร์

## ผู้ใช้
เจ้าของกิจการ 1 คน (ไม่ใช่โปรแกรมเมอร์) เปิดใช้คนเดียว เริ่มจากในเครื่องตัวเอง

---

## Stack (เริ่มง่ายก่อน — local-first)
- **เริ่มต้น:** ไฟล์ HTML ไฟล์เดียว เปิดด้วยดับเบิลคลิกก็ใช้ได้ ไม่ต้องลงอะไร ไม่ต้องมี internet
- **เก็บข้อมูล:** `localStorage` ของเบราว์เซอร์ (อยู่ในเครื่อง เป็นส่วนตัว)
- **ไม่มี:** build step, framework, npm, server, บัญชี — ตั้งใจให้ไม่มี เพื่อให้เริ่มได้ใน 5 นาที
- **ภาษา:** HTML + CSS + vanilla JavaScript ล้วน (อ่านง่าย แก้เองได้)

### เส้นทางโตขึ้น (graduation — ทำตอนพร้อม ไม่ใช่ตอนแรก)
เมื่ออยากเปิดจากมือถือ/หลายเครื่อง/หลายคน → ย้ายขึ้น cloud:
- หน้าเว็บ → **Cloudflare Pages** (ฟรี)
- ข้อมูล → **Supabase** (Postgres ฟรี) แทน localStorage
- ตอนนั้นค่อยสั่ง Claude ว่า "ย้ายข้อมูลจาก localStorage ไป Supabase" — โครงข้อมูล (ตารางด้านล่าง) ใช้ต่อได้เลย

---

## Design System (ห้ามหลุด — นี่คือสิ่งที่ทำให้ไม่ดูเหมือน AI สร้างมั่ว ๆ)
- **ฟอนต์:** หัวเรื่อง = `Bai Jamjuree` · เนื้อหา = `Anuphan` (โหลดจาก Google Fonts)
- **โทนสี (CSS variables):**
  - หมึก ink `#16192d` · เทาอ่อน muted `#5b6172` · เส้น line `#e6e8ef`
  - พื้น paper `#f6f8fc` · การ์ด card `#ffffff`
  - accent หลัก (น้ำเงิน) `#2563eb` · accent รอง (เขียวมิ้นต์) `#0d9488`
  - สถานะ: ok เขียว `#16a34a` · เตือน warn ส้ม `#d97706` · อันตราย danger แดง `#dc2626`
- **การ์ด:** พื้นขาว มุมมน 16px เงานุ่ม ๆ (ไม่ใช่เงาหนา) เส้นขอบบางสีจาง
- **ปุ่มหลัก:** พื้นน้ำเงิน `#2563eb` ตัวอักษรขาว มุมมน 11px
- **กฎสี:** สีต้องมี "ความหมาย" — เขียว=เข้า/สำเร็จ, แดง=ออก/เกินกำหนด, ส้ม=รอ/ใกล้ถึง อย่าใส่สีมั่ว
- **ภาษา:** ไทยล้วน เรียบง่าย เหมือนคุยกับเจ้าของร้าน (อย่าใช้ศัพท์เทคนิค)
- หลีกเลี่ยง "AI slop": ระยะห่างต้องสม่ำเสมอ · ลำดับชั้นชัด (อันสำคัญตัวใหญ่/เด่น) · 1 หน้า 1 เรื่องหลัก

---

## โครงข้อมูลกลาง (SSOT — Single Source of Truth)
หัวใจของระบบคือ **"ทะเบียนกลางชุดเดียว"** ทุกโมดูลอ้างอิงข้อมูลก้อนเดียวกัน ห้ามเก็บข้อมูลซ้ำซ้อน

เก็บทั้งหมดใน object เดียวใน localStorage key `erp_owner_v1`:

ระบบนี้เปิดมา **มีกระดูกสันหลังครบ** (backbone — ออฟฟิศย่อที่รันได้เลย) เพื่อให้เจ้าของ "เห็นภาพก่อน" แล้วค่อยขยาย:

```js
{
  shopName: "ชื่อธุรกิจของฉัน",
  bizType: "สินค้า",   // "สินค้า" | "บริการ" — เลือกสายธุรกิจ (กำหนดว่าจะเน้นโมดูลไหน)
  customers: [   // ลูกค้า/คู่ค้า
    { id, name, phone, note }
  ],
  jobs: [        // งาน/โปรเจกต์/ออเดอร์ — "สิ่งที่ต้องตาม"
    { id, customerId, title, status, dueDate, amount, cost, note }
    // status: "ใหม่" | "กำลังทำ" | "รอจ่าย" | "เสร็จ"  ·  cost = ต้นทุนงาน (ไว้คิดกำไร)
  ],
  money: [       // การเงิน-บัญชี (เงินเข้า-ออก)
    { id, date, type, amount, note, jobId, category }
    // type: "เข้า" | "ออก"  ·  jobId = ผูกกับงาน (ถ้ามี)  ·  category = หมวด (ขาย/วัตถุดิบ/ค่าใช้จ่าย...)
  ],
  docs: [        // เอกสาร — ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ
    { id, type, number, customerId, jobId, date, amount, status }
    // type: "ใบเสนอราคา" | "ใบแจ้งหนี้" | "ใบเสร็จ"  ·  status: "ร่าง" | "ส่งแล้ว" | "ชำระแล้ว"
  ],
  staff: [       // พนักงาน (HR เบา ๆ)
    { id, name, role, phone, note }
  ]
}
```

**ความสัมพันธ์:** `jobs.customerId`→`customers.id` · `money.jobId`→`jobs.id` · `docs.customerId`→`customers.id` · `docs.jobId`→`jobs.id`

> ⚠️ **หมายเหตุสำหรับรุ่น BizSuite นี้:** `erp.html` ที่แจกมาเป็นเวอร์ชัน "คลังสินค้า" ใช้ SSOT คนละก้อนกับตัวอย่างข้างบน (`localStorage` key จริงคือ `bizsuite_erp`) — ดูของจริงในไฟล์ `erp.html` เสมอก่อนเพิ่มโมดูล ตารางด้านบนคือ "พิมพ์เขียวอ้างอิง" ที่แค็ตตาล็อกโมดูลด้านล่างและ `ARCHITECTURE.md` อิงตาม ให้ยึดหลักการ (id/FK/derived vs snapshot) เป็นหลัก ไม่ใช่ชื่อฟิลด์ตายตัว — เวลาจะสร้างโมดูลใหม่ ให้เลียนแบบโครงจริงใน `erp.html` เสมอ

### 🗂️ โครง `bizsuite_erp` จริงตอนนี้ (12 โมดูล — v3: HR เต็มระบบ + ภาษีไทยของจริง)
```js
{
  shopName, bizInfo:{address,taxId,vatRegistered,promptpayMobile,promptpayId,branch}, // promptpay* → QR/payload บนใบแจ้งหนี้ (buildPromptPayPayload) · branch="สำนักงานใหญ่"/"สาขาที่ 00001" โชว์คู่เลขภาษีบนเอกสาร
  products[{id,sku,name,unit,stock,lowAt,cost,price}],
  moves[{id,date,productId,type,qty,note,refType?,refId?}],    // stock ขยับผ่าน addMove() จุดเดียวเท่านั้น · type v5 เพิ่ม "ปรับเพิ่ม"/"ปรับลด" (ตรวจนับ) · refType/refId ไม่บังคับ (ใส่ตอนรับของ PO ผ่าน addMove's extra param)
  customers[{id,name,phone,note,taxId,personType,address}],    // personType: "บุคคล"|"นิติบุคคล" — หัก ณ ที่จ่ายเลือกได้เฉพาะนิติบุคคล · address = จำเป็นต่อใบกำกับภาษีเต็มรูป (ด่าน taxInvoiceProblems)
  orders[{id,customerId,date,status,items:[{productId,qty}],stockDeducted,assigneeId,workStage}],
  // assigneeId → staff.id (พนักงานผู้รับผิดชอบ) · workStage = ไทม์ไลน์แสดงผลเท่านั้น "ใหม่"|"กำลังทำ"|"ส่งแล้ว"|"ปิด" (ORDER_STAGES ไหลทางเดียว ผ่าน advanceOrderStage)
  // ⚠️ workStage เป็นคนละตัวกับ status/stockDeducted (ตัวคุมตัดสต๊อกจริงของ completeOrder) — completeOrder บังคับ workStage='ปิด' ให้เองเสมอ ไม่ต้องแตะ
  money[{id,date,type,amount,note,category,unpaid,orderId,refType,refId,vatAmt,whtAmt,payeeName,payeeTaxId,payeePersonType,whtRate}],
  // unpaid=true+type="ออก" → เจ้าหนี้ (แท็บบัญชี) · refType/refId = ผูกกลับไปยัง docs/payrolls/pos ที่โพสต์เงินแถวนี้อัตโนมัติ (ห้ามลบจาก UI เสมอ — refType='po' v5 ยกเว้นให้ "แก้" ได้เพื่อเติมหัก ณ ที่จ่าย ตัวอื่นล็อกเต็มเหมือนเดิม)
  // vatAmt/whtAmt = ไม่บังคับ → ไหลเข้า "สรุปภาษีเบื้องต้น"+เตรียม ภ.พ.30/ภ.ง.ด.3-53 · payee* = ข้อมูลผู้รับเงินสำหรับพิมพ์ใบ 50 ทวิ (type="ออก"+whtAmt>0)
  categories:{in:[...],out:[...]},                              // หมวดเงินเข้า/ออกแบบกำหนดเอง — dropdown หมวดทุกจุดอ่านจากนี่ · ลบไม่ได้ถ้ามี money ใช้อยู่
  docs[{id,type,number,customerId,orderId,items:[{name,qty,price}],amount,date,status,note,sourceDocId,vatRate,vatAmt,baseAmt,whtType,whtRate,whtAmt,transferAmt}],
  // type: "ใบเสนอราคา"|"ใบแจ้งหนี้"|"ใบเสร็จ" · number = เลขรัน snapshot (nextDocNumber) · sourceDocId = เอกสารต้นทางตอนแปลง/รับชำระ
  // vatRate/vatAmt/baseAmt = snapshot VAT (ติ๊ก "รวม VAT 7%") — base=round(amount/1.07,2), vat=amount-base
  // wht* = snapshot หัก ณ ที่จ่าย (เฉพาะใบแจ้งหนี้+ลูกค้านิติบุคคล, SoT อัตราใน WHT_TYPES) — whtAmt=ฐาน×rate%, transferAmt=amount-whtAmt (ยอดโอนจริง)
  docCounters,                                                  // { QT:{"2569":3}, IV:{...}, RC:{...} } — เดินหน้าอย่างเดียว
  staff[{id,name,nickname,role,dept,phone,payType,salary,dailyRate,startDate,note,shiftId,address,idCard,bankName,bankAccount,
         payItems:[{id,name,kind,amount,taxable}],leaveQuotaOverride:{},terminatedAt,terminationReason,terminationDate,severanceSnapshot}],
  // payType: "รายเดือน"(salary) | "รายวัน"(dailyRate) · idCard/address/bank* = 🔒 เครื่องเดียวเท่านั้น (PDPA)
  // payItems = แพคเกจเงินเพิ่ม/หักประจำ ไหลเข้างวดเงินเดือนอัตโนมัติ · taxable=true→รวมฐานปกส./ภาษี, false→บวก net ตรง ไม่กระทบฐาน
  // terminatedAt≠null = พ้นสภาพ (ไม่เข้างวดใหม่/ไม่เช็คอิน แต่ประวัติอยู่) · severanceSnapshot = ผลคำนวณ ม.118 ตอนเลิกจ้าง (แช่แข็ง)
  shifts[{id,name,start,end}],                                  // seed "กะปกติ" 09:00-18:00 · staff.shiftId ว่าง = ใช้ workStart กลาง
  holidays[{date,name}],                                        // วันหยุดบริษัท — ไม่นับสาย
  timelogs[{id,staffId,date,in,out}],
  otlogs[{id,staffId,date,hours,rate,multiplier,baseRate,note}], // rate=อัตราจริงที่ใช้คำนวณ (hours×rate) · multiplier/baseRate=metadata ช่วยกรอกเท่านั้น
  workStart,                                                     // "09:00" default — fallback กะกลางเมื่อพนักงานไม่ได้ตั้ง shiftId
  leaves[{id,staffId,type,status,dateFrom,dateTo,days,note}],    // status: "ขอ"|"อนุมัติ"|"ไม่อนุมัติ" — หักโควตาเฉพาะอนุมัติ (เก่าไม่มี status = ถือว่าอนุมัติ)
  leaveTypes[string],                                            // default ["ลากิจ","ลาป่วย","ลาพักร้อน"] เพิ่ม/ลบเองได้
  leaveQuota{[type]:days},                                       // default ต่อประเภท — override รายคนได้ที่ staff.leaveQuotaOverride
  monthCloses[{period,snapshot:{รายได้,จ่าย,VAT,WHT,เงินเดือน},checklist,closedAt,reopened}], // ปิดเดือน (แท็บบัญชี) — แก้ย้อนหลัง=mark reopened ไม่บล็อก
  payrolls[{id,period,ssoRate,ssoCap,ssoFloor,ssoSalaryCap,
    rows:[{staffId,name,payType,dailyRate,presentDays,salary,otHours,otAmt,packageItems,addTaxable,addNonTaxable,packageDeduct,gross,ssoAmt,taxAmt,otherDeduct,net}],
    status,paidAt}]
  // rows = snapshot ทั้งก้อนตอนสร้างงวด — แก้ทะเบียนพนักงาน/ลงเวลา/otlog/payItems ทีหลังไม่กระทบงวดเดิม
  // gross = salary+otAmt+addTaxable (ฐานคำนวณปกส./ภาษี) · ssoAmt = clamp[ssoFloor,ssoSalaryCap]×ssoRate% ครอบ ssoCap (บาท/เดือน)
  // taxAmt = ภาษีหัก ณ ที่จ่ายขั้นบันไดจริง annualize จาก gross (auto-fill แก้มือได้) · net = salary+otAmt+addTaxable+addNonTaxable-ssoAmt-taxAmt-otherDeduct-packageDeduct
  vendors[{id,name,phone,taxId,address,note}],                    // v5 จัดซื้อ — ผู้ขาย
  pos[{id,number,vendorId,date,items:[{productId,name,qty,price}],status,receivedAt,note}],
  // number = 'PO-2569-xxx' เดินผ่าน docCounters (prefix 'PO' แยกจากเอกสารขาย) · status: 'ร่าง'|'สั่งแล้ว'|'รับแล้ว'|'ยกเลิก' (ไหลทางเดียว ห้ามลบ)
  // items[].productId = null ได้ ("ไม่ระบุสินค้า" — พิมพ์ชื่อเองก็สั่งได้ แต่รับของแล้วไม่ตัด/ไม่เพิ่มสต๊อก)
  lastBackupAt,                                                   // v5 ISO string — set ทุกครั้งที่ backupData() ถูกเรียก ใช้คำนวณแถบเตือนสำรอง (เกิน 7 วัน)
  demoCleared                                                     // v5 boolean — true หลังกด "เริ่มใช้จริง" กันทุก seed*() IIFE ไม่ให้ยัดข้อมูลเดโม่กลับมาตอน array ว่างพอดี
}
```
FK: `moves.productId/orders.items[].productId → products.id` · `orders.customerId/docs.customerId → customers.id` · `docs.orderId → orders.id` · `leaves.staffId/timelogs.staffId/otlogs.staffId/payrolls.rows[].staffId/staff.shiftId → staff.id/shifts.id` · `pos.vendorId → vendors.id` · `pos.items[].productId → products.id` · `moves.refId/money.refId → pos.id` (เมื่อ `refType==='po'`)

**โมดูลกระดูกสันหลัง (มีในแอปตั้งแต่แรก):**
🏠 แดชบอร์ด · 📦 สินค้า · 🔄 การเคลื่อนไหว · 👤 ลูกค้า · 🛒 ออเดอร์ · 💰 การเงิน · 🤖 AI เลขา (สรุปประจำวันเป็นภาษาคน — demo คำนวณฝั่งเครื่อง, ของจริงต่อ Claude API ได้)

**ฝ่ายธุรกิจ (v3 — เต็มระบบ HR+ภาษีไทยของจริง สูตรจาก homeoffice payroll.js/tax.js/severance.js):**
📄 เอกสารการค้า (QT→IV→RC เลขรันอัตโนมัติ + หัก ณ ที่จ่ายบนใบแจ้งหนี้ + QR PromptPay) · 🧾 บัญชี (ลูกหนี้/เจ้าหนี้/P&L/ภ.พ.30/ภ.ง.ด.3-53/ปิดเดือน/ส่งออก CSV นักบัญชี) · 👥 พนักงาน (ประวัติเต็ม+แพคเกจเงินเพิ่ม-หัก+พ้นสภาพ/ค่าชดเชย ม.118) · 🕐 ลงเวลา & ลา (กะ+วันหยุด+Kiosk+โควตาต่อคน+สถานะขอ/อนุมัติ) · 💵 เงินเดือน (SSO clamp เต็ม + PIT ขั้นบันไดจริง + snapshot ต่องวด + export CSV ธนาคาร/ภงด1/ปกส.)

**v4 — เชื่อมทุกโมดูลเป็น workflow เดียว + ใบกำกับภาษีเต็มรูป:**
- **หน้ารายละเอียดรายตัว** (customer/product/order/document) — กลไก `showDetailPage(title, subtitle, bodyHtml, opts)` ทำนองเดียวกับ `showFormPage` แต่อ่านอย่างเดียว (ไม่มี savePress/mfoot) ใช้ `opts.backFn`/`opts.actions`/`opts.wide` — เปิดด้วย `openCustomerDetail(id)` / `openProductDetail(id)` / `openOrderDetail(id)` / `openDocDetail(id)`
- **คลิกทะลุทุกตาราง** — ชื่อลูกค้า/สินค้า/พนักงาน/เลขเอกสาร/ออเดอร์ ทุกจุดในแอปเป็นปุ่ม `.lnk` เปิดหน้า detail ที่เกี่ยวข้อง
- **ออเดอร์มีไทม์ไลน์แสดงผล** `ORDER_STAGES=['ใหม่','กำลังทำ','ส่งแล้ว','ปิด']` ผ่าน `orders.workStage` + `advanceOrderStage(id)` (ไหลทางเดียว) — **แยกจาก `status`/`stockDeducted` เดิมโดยเจตนา** (ตัวนั้นยังคุมตัดสต๊อกเหมือนเดิมทุกตัวอักษร ห้ามผูกรวมกัน) · มอบหมายผ่าน `setOrderAssignee(id)`
- **โซ่เอกสาร** — `docChain(id)` เดินย้อน `sourceDocId` หา root แล้วเดินหน้าอีกที ใช้ทำ breadcrumb ในหน้า `openDocDetail`
- **แดชบอร์ด drill** — การ์ดลูกหนี้ค้าง/เอกสารร่างค้าง/พนักงานลาวันนี้/ออเดอร์ค้างส่ง คลิกได้ทั้งหมด → `openArDrill()`/`openDraftDocsDrill()`/`openLeaveTodayDrill()`/`openPendingOrdersDrill(assigneeFilter)` **ต้องนับด้วยเงื่อนไขเดียวกับตัวเลขบนการ์ดเป๊ะ** (กันตัวเลขไม่ตรงกัน) · การ์ดใหม่ "งานค้างรายคน" group ออเดอร์ไม่ปิดตาม `assigneeId`
- **ใบกำกับภาษีเต็มรูป (ม.86/4)** — `bizInfo.branch` โชว์คู่เลขภาษีผู้ขาย · ด่าน `taxInvoiceProblems(customerId)` เช็ค taxId+address ก่อนออก (เฉพาะจด VAT + เอกสารมี `vatRate` + ไม่ใช่ QT) ไม่ครบ → `showTaxGateBlock(d)` พาไปแก้ลูกค้าแล้วกลับมาทำต่อได้ · `printDoc(id)` พิมพ์ต้นฉบับ+สำเนา (เฉพาะใบเสร็จ) + ผู้ขาย/ผู้ซื้อ 2 ฝั่ง + `bahtText(amount)` (แปลงเลขเป็นตัวอักษรไทย เทสละเอียดใน verify-workflow.mjs) + เชิงอรรถมาตรา 78 + ฟอนต์ Sarabun

**v5 — พร้อมใช้จริง + ปิดวงจรจัดซื้อ (Procure-to-Pay):**
- **เริ่มใช้จริง** — ปุ่ม `🚀 เริ่มใช้จริง` (sidebar-foot) → `openGoLiveConfirm()` บอกชัดว่าจะลบอะไร → `doGoLive()` เรียก `backupData()` (auto-backup JSON เดโม่เดิม) ก่อนล้างทุก array ธุรกรรม + reset `docCounters` + ตั้ง `db.demoCleared=true` เสมอ (เก็บ `shifts`/`leaveQuota`/`workStart` ไว้) → **ทุก `seed*` IIFE การ์ดหน้าด่านด้วย `if(db.demoCleared) return;` ก่อนเช็ค length เดิม** (กันเดโม่ reseed ตอนโหลดหน้าครั้งถัดไปเมื่อ array ว่างพอดี) → wizard หน้าเต็ม `openGoLiveWizardStep(idx)` ตาม `GOLIVE_STEPS` (ชื่อ→ที่อยู่→ภาษี+สาขา→VAT→พร้อมเพย์→เวลาเข้างาน) เก็บพักไว้ที่ `goliveData` แล้ว commit ลง db ทีเดียวตอน `goliveWizardFinish()` · `renderDash()` เช็ค `db.demoCleared` + ทุก array หลักว่าง → โชว์ empty-state ชวนทำงานแรกแทนแดชบอร์ดปกติ
- **เตือนสำรองข้อมูล** — `db.lastBackupAt` set ทุกครั้งที่ `backupData()` ถูกเรียก (ทั้งกดเองและ auto-backup ใน `doGoLive()`) · `render()` แปะ `backupBannerHtml()` เหนือทุกแท็บเสมอ (ไม่ใช่แค่บาง view) — โชว์เมื่อมีข้อมูลจริง (`hasTxnData()`) และ (ไม่เคย backup หรือเกิน 7 วัน) เท่านั้น ไม่มี popup
- **ค้นหากลาง** — `searchResults(q)` (q<2 ตัวอักษร=คืน `[]`) ไล่ทุก collection (customers/products/staff/docs/orders/vendors/pos) รวม ≤8 ตัด `.slice(0,8)` · sidebar มี `#globalSearch` + `onGlobalSearchInput()` debounce 150ms เรียก `renderSearchDrop(q)` วาด `.search-item` (esc() กัน XSS ทุกจุด) · Enter/คลิกเรียก `fn` ของผลลัพธ์แล้ว `closeSearchDrop()`
- **มูลค่าสต๊อก** — `stockValueInfo()` = Σ `stock×cost` เฉพาะสินค้าที่มี `cost` (undefined/null/'' ข้าม + นับ `noCostCount`) โชว์การ์ดแดชบอร์ด+section ในบัญชี (`renderStockValueSection()`)
- **ตรวจนับสต๊อก** — `openStocktake()`→กรอกนับจริงต่อแถว (เว้นว่าง=skip)→`reviewStocktake()` สรุปผลต่าง→`confirmStocktake()` ยืนยันแล้วค่อยเรียก **`addMove(productId,'ปรับเพิ่ม'|'ปรับลด',qty,note,extra)` จุดเดียวเท่านั้น** (ห้าม set `p.stock` ตรง ๆ) — `addMove` v5 ขยายรองรับ `ปรับเพิ่ม`/`ปรับลด` + พารามิเตอร์ `extra` (object) เสริม field เข้า move ได้ (ใช้กับ `refType`/`refId` ตอนรับของ PO)
- **โมดูลจัดซื้อ** (`vendors`/`pos` ใน SSOT ด้านล่าง) — เมนู `🚚 จัดซื้อ` อยู่ในหมวด "คลังสินค้า" (`NAV_GROUPS`) มี 2 แท็บย่อย (`purchasesTab`): ใบสั่งซื้อ/ผู้ขาย · เลขที่ PO เดินผ่าน `nextPoNumber()` ใช้ `docCounters` ก้อนเดียวกับเอกสารขาย (prefix `PO` แยกต่างหาก กันชนกัน) · flow เดียวกับฝั่งขาย: ร่าง→`sendPo()`→สั่งแล้ว→`openPoReceive()`/`confirmPoReceive()`→รับแล้ว (ปรับ qty รับจริงต่อบรรทัดได้ ของมาไม่ครบก็ปิด PO ได้ตาม MVP) — รับของเรียก `addMove(...,'รับเข้า',...,{refType:'po',refId})` เฉพาะบรรทัดที่มี `productId` + `addMoneyRow('ออก',...,{unpaid:true,refType:'po',refId,category:'วัตถุดิบ',payeeName/payeeTaxId})` ยอดตาม**รับจริง**เท่านั้น (ไม่ใช่ยอดสั่ง) → โผล่เจ้าหนี้ในแท็บบัญชีทันที → `markBillPaid()` เดิมตัดยอดได้ (ไม่สนใจ refType) · `cancelPo()` ใช้ได้เฉพาะสถานะ ร่าง/สั่งแล้ว เปลี่ยน status อย่างเดียว **ไม่แตะ stock/เงิน** (ห้ามลบ PO) · แก้ไขได้เฉพาะสถานะร่าง (`openPoForm` เช็คให้)
  - ⭐ **จุดตัดสินใจ**: บิล AP ที่เกิดจาก PO (`money.refType==='po'`) เปิดให้กด "แก้" ได้ (ต่างจาก ref อื่นที่ล็อกเต็ม) เพราะไม่มี UI อื่นให้เติมหัก ณ ที่จ่าย/แก้โน้ตทีหลัง — แต่ยัง **ห้ามลบ** อยู่เหมือน ref อื่น (ปุ่มลบไม่โผล่) — `printWht50(id)` เดิมใช้ได้ทันทีเพราะเช็คแค่ `type==='ออก' && whtAmt` ไม่สนใจ refType
  - `createPoFromLowStock()` — ปุ่มลัดจากการ์ด "ของใกล้หมด" (แดชบอร์ด+แท็บสินค้า) prefill รายการ `stock<=lowAt` ทั้งหมด (qty แนะนำ = พอให้กลับไปสองเท่าของ lowAt, price = cost ปัจจุบัน) เข้า `openPoForm('','',items)` แก้ก่อนบันทึกจริงได้เสมอ
  - `vendorApBalance(vendorId)` นับจาก `money.unpaid && refType==='po'` ที่ผูก PO ของ vendor นั้น — ใช้ทั้งลิสต์ผู้ขายและหน้า `openVendorDetail`

**แดชบอร์ด + AI เลขา** = คำนวณจาก SSOT (ไม่เก็บแยก): ต้องตามวันนี้ · ใครค้างจ่าย · เงิน/กำไรเดือนนี้ · เอกสารร่างค้าง · ลูกหนี้ค้าง · พนักงานลาวันนี้ · **v5**: มูลค่าสต๊อก · PO ค้างรับ · แถบเตือนสำรองข้อมูล

**ส่วนขยายตามสายธุรกิจ (ต่อเองในเวิร์กชอป):**
- 🏭 **สินค้า** → `products[{id,name,unit,stock,lowAt,price}]` + `moves[{id,date,productId,type,qty,note}]` (การเคลื่อนไหว: รับเข้า/เบิกออก) · ตัดสต๊อกเมื่อปิดงาน · เตือนของใกล้หมด
- 🛎️ **บริการ** → เน้น `docs` (ออกใบเสนอราคา→ใบแจ้งหนี้→ใบเสร็จ) + ต้นทุนต่องาน (`jobs.cost` → คิดกำไร) + `costItems[{id,jobId,name,amount}]` รายการต้นทุนย่อย

---

## วิธีเพิ่มโมดูลใหม่ (สำคัญ — ทำตามแพตเทิร์นนี้ทุกครั้ง)
ทุกโมดูล (สต๊อก, POS, จัดซื้อ, HR, เอกสาร...) สร้างด้วยโครงเดียวกัน — เพิ่มเข้า **`erp.html`** เท่านั้น (ห้ามไปแก้หน้าโชว์เคส):
1. **เพิ่ม array ใหม่ใน SSOT** (เช่น `products: [...]`) — อย่าสร้างที่เก็บข้อมูลแยกไฟล์
2. **เพิ่มแท็บใหม่** ในแถบเมนู + ฟังก์ชัน `render<ชื่อ>()` วาดตาราง/การ์ด
3. **ฟอร์มเพิ่ม/แก้/ลบ** (CRUD) ใช้รูปแบบเดียวกับโมดูลที่มี
4. **ผูกเข้าแกนเดิมถ้าเกี่ยวกัน** (เช่น ออเดอร์ตัดสต๊อก → อ้าง `products.id`)
5. **โยงเข้าหน้า "งานวันนี้"** ถ้าโมดูลนั้นมีอะไรที่เจ้าของต้องเห็นทุกวัน (เช่น ของใกล้หมด)

> มี Claude Code skill ช่วย: พิมพ์ `/new-module <ชื่อ>` แล้ว Claude จะ scaffold ตามแพตเทิร์นนี้ให้ (ดู `skills/new-module/` ที่ root ของ Skills Lab Starter — ติดตั้งด้วย `install.sh` ถ้ายังไม่มี)

---

## กฎห้ามทำ (Don'ts)
- ❌ อย่าเก็บข้อมูลซ้ำหลายที่ — ทุกอย่างอยู่ใน SSOT ก้อนเดียว (ใน `erp.html`)
- ❌ อย่าเพิ่ม framework/library หนัก ๆ โดยไม่จำเป็น — รักษาความเป็น "ไฟล์เดียวเปิดได้เลย"
- ❌ อย่าใส่สี/ฟอนต์นอกระบบข้างบน
- ❌ อย่าลบข้อมูลผู้ใช้โดยไม่ถาม — มีปุ่ม export/backup เสมอ
- ❌ อย่าทำให้ซับซ้อนเกินงานจริงของเจ้าของ — เริ่มจากง่ายที่สุดที่ใช้ได้
- ❌ อย่าไปแก้ `index.html` (แลนดิ้งเพจการตลาด) ด้วยตรรกะ/สกิลของระบบหลังบ้าน — คนละหน้าที่กัน

## วิธีรัน
เปิดไฟล์ `erp.html` โดยตรง (ดับเบิลคลิก) — มีข้อมูลตัวอย่างให้เล่นทันที
ปุ่ม "สำรองข้อมูล" = ดาวน์โหลดไฟล์ข้อมูลของคุณ · "นำเข้า" = โหลดกลับ (ข้อมูลเป็นของคุณ พกไปไหนก็ได้)
