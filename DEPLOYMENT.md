# การ deploy ขึ้นเซิร์ฟเวอร์ (VPS)

พุชโค้ดขึ้น branch `main` → GitHub Actions จะ SSH เข้า VPS แล้วสร้าง + รีสตาร์ตให้เองอัตโนมัติ
(ไฟล์งาน: `.github/workflows/deploy.yml`)

---

## 1. ใส่กุญแจ 3–4 ตัวใน GitHub (ทำครั้งเดียว)

ไปที่ repo บน GitHub → **Settings** → **Secrets and variables** → **Actions** → ปุ่ม **New repository secret**
แล้วเพิ่มทีละตัวตามนี้:

| ชื่อ           | ใส่อะไร                                 | ตัวอย่าง                                          |
| -------------- | --------------------------------------- | ------------------------------------------------- |
| `VPS_HOST`     | ไอพีหรือโดเมนของเซิร์ฟเวอร์             | `203.0.113.10`                                    |
| `VPS_USERNAME` | ชื่อผู้ใช้ที่ล็อกอิน SSH                | `root`                                            |
| `VPS_SSH_KEY`  | **กุญแจส่วนตัว** (private key) ทั้งไฟล์ | ตั้งแต่บรรทัด `-----BEGIN ...` ถึง `-----END ...` |
| `VPS_PORT`     | **(ถ้ามี)** พอร์ต SSH ของเซิร์ฟเวอร์    | `22`, `2222`                                      |

**วิธีทำกุญแจ** (รันบนเครื่องตัวเอง):

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/jamaree_deploy
ssh-copy-id -i ~/.ssh/jamaree_deploy.pub root@<ไอพี VPS>
cat ~/.ssh/jamaree_deploy          # ← ก๊อปทั้งหมดไปใส่ VPS_SSH_KEY
```

> ⚠️ ตัวที่ลงท้าย `.pub` เอาไปไว้บนเซิร์ฟเวอร์ · ตัวที่**ไม่มี** `.pub` เอาไปใส่ GitHub Secret เท่านั้น ห้ามส่งให้ใคร
>
> ถ้า VPS ใช้พอร์ต SSH มาตรฐาน `22` จะไม่ต้องสร้าง `VPS_PORT` ก็ได้ แต่ถ้าเครื่องตั้งเป็นพอร์ตอื่น ต้องใส่ secret นี้ให้ตรง ไม่งั้น workflow จะ timeout ตั้งแต่ขั้นตอนเชื่อมต่อ
>
> รองรับชื่อเก่า `VPS_SSH_PORT` และ `SSH_PORT` ด้วย (ทั้ง Secret/Variable) เพื่อความเข้ากันได้ย้อนหลัง แต่แนะนำให้ใช้ `VPS_PORT` เป็นหลัก

---

## 2. เตรียมเครื่อง VPS (ทำครั้งเดียว)

```bash
cd /root
git clone <url ของ repo> jamaree-gas-admin
```

ถ้าวางโปรเจกต์ไว้ที่อื่น ต้องแก้บรรทัด `cd /root/jamaree-gas-admin` ใน `.github/workflows/deploy.yml` ให้ตรงกัน

---

## 3. ⚠️ ไฟล์คีย์ Supabase ต้องสร้างเองบนเซิร์ฟเวอร์

ไฟล์ `.env.local` **ไม่ขึ้น git** (เป็นความลับ) — `git pull` จึงไม่มีทางดึงมาให้
ต้องสร้างเองบน VPS **หนึ่งครั้ง** ที่ `/root/jamaree-gas-admin/jamaree-web/.env.local`:

```bash
cd /root/jamaree-gas-admin/jamaree-web
nano .env.local
```

เนื้อไฟล์ (ก๊อปค่าจาก Supabase → Project Settings → API):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi....
```

- ถ้าไฟล์นี้ไม่มี/ค่าว่าง → เว็บจะขึ้นแต่ **ต่อฐานข้อมูลไม่ได้** (ล็อกอินไม่ผ่าน)
- เปลี่ยนคีย์เมื่อไหร่ ต้องมาแก้ไฟล์นี้บน VPS แล้ว deploy ใหม่ทุกครั้ง (ค่าถูกฝังตอน build)

---

## 4. ใช้งานประจำวัน

```bash
git add -A
git commit -m "อธิบายสิ่งที่แก้"
git push origin main
```

ดูผลได้ที่แท็บ **Actions** บน GitHub · ถ้าไฟเขียว = ขึ้นเซิร์ฟเวอร์เรียบร้อย

**สั่ง deploy เองโดยไม่ต้องแก้โค้ด:** แท็บ Actions → `Deploy to VPS` → ปุ่ม **Run workflow**

- ถ้าจะลอง deploy ไปพอร์ตอื่นชั่วคราว ให้กรอกช่อง `vps_port` ตอนกด Run workflow ได้เลย โดยไม่ต้องแก้ secret ถาวร

---

## 5. เวลามีปัญหา (รันบน VPS)

```bash
cd /root/jamaree-gas-admin/jamaree-web
docker compose ps                 # ดูว่าคอนเทนเนอร์ยังอยู่ไหม
docker compose logs -f --tail 50  # ดู log
docker compose --env-file .env.local up -d --build   # สั่งสร้างใหม่ด้วยมือ
```

---

## 6. เปิด https ด้วยโดเมน DuckDNS + Let's Encrypt

ตัว `caddy` ใน `docker-compose.yml` จะขอและ**ต่ออายุใบรับรองให้เองทั้งหมด** — ไม่ต้องรัน certbot เอง

**1) จองชื่อที่ DuckDNS**

เข้า <https://www.duckdns.org> → ล็อกอิน → พิมพ์ชื่อที่อยาก (เช่น `jamaree`) → กด **add domain**
แล้วกรอกช่อง **current ip** เป็นไอพี VPS → กด **update ip**

**2) เปิดพอร์ต 443 ที่ไฟร์วอลล์**

```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

(ถ้าใช้ผู้ให้บริการคลาวด์ ต้องเปิด 80/443 ใน Security Group ของผู้ให้บริการด้วย)

**3) บอกโดเมนให้เซิร์ฟเวอร์รู้** — เติมบรรทัดนี้ใน `/root/jamaree-gas-admin/jamaree-web/.env.local`

```
DOMAIN=jamaree.duckdns.org
```

**4) สั่งขึ้นใหม่**

```bash
cd /root/jamaree-gas-admin/jamaree-web
docker compose --env-file .env.local up -d --build
docker compose logs -f caddy      # ควรเห็น "certificate obtained successfully"
```

เสร็จแล้วเข้า `https://jamaree.duckdns.org` ได้เลย (เข้าด้วย http จะเด้งเป็น https ให้เอง)

> ไม่ใส่ `DOMAIN` → ระบบเปิดแบบ http ผ่านไอพีเหมือนเดิม ไม่พัง
>
> ใบรับรองเก็บใน docker volume `caddy_data` — **ห้ามลบ** ไม่งั้นขอใหม่บ่อย ๆ จนชนโควตาของ Let's Encrypt (5 ใบ/สัปดาห์)
>
> ไอพี VPS เปลี่ยนเอง (ไม่ใช่ไอพีถาวร) → ใส่ `DUCKDNS_SUBDOMAINS` + `DUCKDNS_TOKEN` ใน `.env.local`
> แล้วสั่ง `docker compose --profile duckdns --env-file .env.local up -d` เพิ่มตัวอัปเดตไอพีให้ DuckDNS อัตโนมัติ

---

## 7. ยังค้างอยู่ (ควรทำต่อ)

- [ ] รัน `jamaree-web/supabase/schema.sql` ใน Supabase SQL Editor ให้เป็นเวอร์ชันล่าสุด
- [ ] ติดตั้งฟังก์ชัน `admin-users` (หน้า "ผู้ใช้งาน" เพิ่ม/ลบ/ตั้งรหัสผ่านบัญชีไม่ได้ถ้ายังไม่ติดตั้ง):
  ```bash
  cd jamaree-web
  npx supabase login
  npx supabase functions deploy admin-users
  ```
- [ ] สร้างผู้ใช้ที่ Supabase → Authentication → Users (ติ๊ก **Auto Confirm User**)
