# การ deploy ขึ้นเซิร์ฟเวอร์ (VPS)

พุชโค้ดขึ้น branch `main` → GitHub Actions จะ SSH เข้า VPS แล้วสร้าง + รีสตาร์ตให้เองอัตโนมัติ
(ไฟล์งาน: `.github/workflows/deploy.yml`)

---

## 1. ใส่กุญแจ 3 ตัวใน GitHub (ทำครั้งเดียว)

ไปที่ repo บน GitHub → **Settings** → **Secrets and variables** → **Actions** → ปุ่ม **New repository secret**
แล้วเพิ่มทีละตัวตามนี้:

| ชื่อ           | ใส่อะไร                                 | ตัวอย่าง                                          |
| -------------- | --------------------------------------- | ------------------------------------------------- |
| `VPS_HOST`     | ไอพีหรือโดเมนของเซิร์ฟเวอร์             | `203.0.113.10`                                    |
| `VPS_USERNAME` | ชื่อผู้ใช้ที่ล็อกอิน SSH                | `root`                                            |
| `VPS_SSH_KEY`  | **กุญแจส่วนตัว** (private key) ทั้งไฟล์ | ตั้งแต่บรรทัด `-----BEGIN ...` ถึง `-----END ...` |

**วิธีทำกุญแจ** (รันบนเครื่องตัวเอง):

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/jamaree_deploy
ssh-copy-id -i ~/.ssh/jamaree_deploy.pub root@<ไอพี VPS>
cat ~/.ssh/jamaree_deploy          # ← ก๊อปทั้งหมดไปใส่ VPS_SSH_KEY
```

> ⚠️ ตัวที่ลงท้าย `.pub` เอาไปไว้บนเซิร์ฟเวอร์ · ตัวที่**ไม่มี** `.pub` เอาไปใส่ GitHub Secret เท่านั้น ห้ามส่งให้ใคร

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

---

## 5. เวลามีปัญหา (รันบน VPS)

```bash
cd /root/jamaree-gas-admin/jamaree-web
docker compose ps                 # ดูว่าคอนเทนเนอร์ยังอยู่ไหม
docker compose logs -f --tail 50  # ดู log
docker compose --env-file .env.local up -d --build   # สั่งสร้างใหม่ด้วยมือ
```

---

## 6. ยังค้างอยู่ (ควรทำต่อ)

- [ ] ทำ **https** (โดเมน + Let's Encrypt) — ตอนนี้เปิดผ่าน `http://ไอพี` เบราว์เซอร์จะปิดความสามารถบางอย่าง
- [ ] รัน `jamaree-web/supabase/schema.sql` ใน Supabase SQL Editor ให้เป็นเวอร์ชันล่าสุด
- [ ] สร้างผู้ใช้ที่ Supabase → Authentication → Users (ติ๊ก **Auto Confirm User**)
