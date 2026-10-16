# ABA Academy — Windows kompyuterda o'z serverini o'rnatish (roadmap)

Bu yo'riqnoma kompyuterni yaxshi bilmaydigan odam uchun yozilgan. Har bir qadamni tartib bilan bajaring, hech birini tashlab ketmang. Buyruqlar **PowerShell** oynasida yoziladi (Start → "PowerShell" deb yozing → o'ng tugma → *Run as administrator*).

Natija: sayt (`abaacademy.vercel.app`) o'zgarmaydi, lekin uning "miyasi" (backend) va barcha ma'lumotlar (PostgreSQL) sizning Windows kompyuteringizda ishlaydi. Render va Supabase kerak bo'lmay qoladi.

```
Telefon / brauzer → abaacademy.vercel.app → Cloudflare Tunnel → Windows PC
                                                                 ├── Backend (port 8000)
                                                                 └── PostgreSQL (port 5432)
```

---

## 0-bosqich. Boshlashdan oldin tayyorlab qo'ying

| Nima | Nega kerak | Qayerdan |
|---|---|---|
| Doim yoniq Windows 10/11 kompyuter | Server shu | — |
| Domen (masalan `abaacademy.org`) | Telefonlar kompyuterga internet orqali kirishi uchun | cloudflare.com → Domain Registration (~$10/yil) |
| Cloudflare akkaunti (bepul) | Tunnel uchun | cloudflare.com |
| Supabase'ga kirish | Eski ma'lumotni ko'chirish uchun | supabase.com |
| Vercel'ga kirish | Saytni yangi backend'ga ulash uchun | vercel.com |
| Telegram bot tokeni | Davomat postlari uchun | BotFather |
| Google Drive (Desktop ilovasi) | Backup'lar bulutga ketishi uchun | google.com/drive/download |

Bir varaqqa yozib qo'ying (keyin kerak bo'ladi):

- `postgres` paroli (2-bosqichda o'zingiz o'ylab topasiz)
- `aba` foydalanuvchi paroli (2-bosqich)
- Supabase connection string (5-bosqich)
- Domen nomi

---

## 1-bosqich. Kompyuterni tayyorlash (15 daqiqa)

1. **Uyqu rejimini o'chiring:** Settings → System → Power & sleep → Sleep: *Never* (ikkala ustunda).
2. **Avtomatik kirish shart emas** — service'lar login'siz ishlaydi.
3. **Papka yarating:** `C:\abaacademy` (C diskda, boshqa joyda emas).
4. **Git o'rnating:** https://git-scm.com/download/win → Next, Next… (hech narsani o'zgartirmang).
5. **Python 3.12 o'rnating:** https://www.python.org/downloads/windows/ → "Windows installer (64-bit)". O'rnatish oynasida **"Add python.exe to PATH" katagini albatta belgilang**, keyin *Install Now*.
6. PowerShell'ni yopib, qayta oching va tekshiring:

```powershell
python --version
git --version
```

Ikkalasi versiya raqamini chiqarsa, davom eting.

---

## 2-bosqich. PostgreSQL o'rnatish (15 daqiqa)

1. https://www.postgresql.org/download/windows/ → "Download the installer" → PostgreSQL **16**, Windows x86-64.
2. O'rnatish oynasida:
   - Components: hammasi belgilangan bo'lsin (Stack Builder'ni olib tashlasangiz ham bo'ladi).
   - Password: `postgres` foydalanuvchisi uchun kuchli parol o'ylab toping va **varaqqa yozing**.
   - Port: `5432` (o'zgartirmang).
   - Locale: Default.
3. O'rnatish tugagach, PowerShell'da baza va foydalanuvchi yarating (`PAROL_ABA` o'rniga o'zingiz o'ylab topgan ikkinchi parolni yozing, varaqqa yozib qo'ying):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER aba WITH PASSWORD 'PAROL_ABA';"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE abaacademy OWNER aba;"
```

Har safar `postgres` parolini so'raydi — 2-bandda yozgan parolni kiriting.

4. Parolni fayl orqali saqlang, shunda backup skripti parol so'ramaydi. Notepad'da quyidagi matnni yozing (parolni o'zingiznikiga almashtiring):

```
localhost:5432:abaacademy:aba:PAROL_ABA
```

Faylni shu nom bilan saqlang: `C:\Users\SIZNING_ISMINGIZ\AppData\Roaming\postgresql\pgpass.conf` (papka yo'q bo'lsa yarating. Saqlashda "Save as type: All files" ni tanlang, aks holda `.txt` qo'shilib qoladi).

5. Tekshiring — parol so'ramasdan `1` chiqishi kerak:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U aba -d abaacademy -c "SELECT 1;"
```

---

## 3-bosqich. Loyihani yuklab olish (10 daqiqa)

```powershell
cd C:\
git clone https://github.com/GITHUB_FOYDALANUVCHI/abaacademy.git abaacademy
cd C:\abaacademy\backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

`GITHUB_FOYDALANUVCHI` o'rniga repozitoriy egasining GitHub nomini yozing (brauzerda GitHub'ni ochib, manzil qatoridan ko'chiring). Repozitoriy private bo'lsa, GitHub login so'raydi.

---

## 4-bosqich. Sozlamalar fayli `.env` (10 daqiqa)

`C:\abaacademy\backend\.env` nomli fayl yarating (Notepad, "All files"). Ichiga:

```
APP_ENV=production
DATABASE_URL=postgresql://aba:PAROL_ABA@localhost:5432/abaacademy
JWT_SECRET=BU_YERGA_KAMIDA_40_TA_TASODIFIY_HARF_VA_RAQAM
JWT_TTL_SECONDS=43200
ACADEMY_TIMEZONE=America/New_York
FRONTEND_URLS=https://abaacademy.vercel.app
SEED_DEMO_DATA=false
TELEGRAM_BOT_TOKEN=BOT_TOKENI
TELEGRAM_ACADEMY_NAME=Al-Bukhari Academy
DB_POOL_MAX=5
STAFF_ACCOUNTS_JSON=
```

- `JWT_SECRET` — klaviaturada tasodifiy 40–60 belgi uring. Bu sessiyalarni himoya qiladi; hech kimga bermang.
- `STAFF_ACCOUNTS_JSON` — Render'dagi **Environment** bo'limidan `STAFF_ACCOUNTS_JSON` qiymatini to'liq nusxalab, `=` dan keyin bitta qatorga qo'ying. Bu 8 ta xodim akkaunti. (Ma'lumot 5-bosqichda Supabase'dan ko'chirilsa, akkauntlar ham ko'chadi va bu qiymat faqat "tekshiruv" uchun kerak bo'ladi — baribir qo'ying.)
- Agar `PAROL_ABA` ichida `@`, `:` yoki `/` belgisi bo'lsa, boshqa parol tanlang — URL ichida muammo chiqaradi.

---

## 5-bosqich. Ma'lumotni Supabase'dan ko'chirish (20 daqiqa)

### 5.1. Avval lokal bazada jadvallarni yaratib oling

Backend birinchi marta ishga tushganda jadvallarni o'zi yaratadi:

```powershell
cd C:\abaacademy\backend
.\scripts\start-api.bat
```

Oynada `Application startup complete` chiqsa — bo'ldi. **Ctrl+C** bilan to'xtating.

Agar `Missing staff accounts` xatosi chiqsa — 4-bosqichdagi `STAFF_ACCOUNTS_JSON` noto'g'ri nusxalangan.

### 5.2. Supabase'dan nusxa oling

Supabase → loyiha → **Project Settings → Database → Connection string → URI** (Session mode, port 5432). `[YOUR-PASSWORD]` o'rniga Supabase baza parolini qo'ying. Keyin:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" "SUPABASE_URI_SHU_YERGA" --data-only --schema=public --no-owner --no-privileges -Fc -f C:\abaacademy\supabase-data.dump
```

Fayl `C:\abaacademy\supabase-data.dump` paydo bo'lishi kerak.

### 5.3. Lokal bazaga yuklang

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -h localhost -U postgres -d abaacademy --data-only --no-owner --no-privileges --disable-triggers -t students -t applications -t class_groups -t staff_users -t auth_accounts -t meetings -t attendance_records -t tuition_records -t assessment_records -t audit_log -t billing_plans -t invoices -t payments -t finance_requests -t finance_migrations -t app_settings -t group_telegram -t telegram_class_posts C:\abaacademy\supabase-data.dump
```

`postgres` parolini so'raydi. Oxirida "warning" so'zli 1–2 qator chiqsa, e'tibor bermang; "ERROR" chiqsa, to'xtab yordam so'rang.

### 5.4. Tekshiring

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U aba -d abaacademy -c "SELECT count(*) AS students FROM students; SELECT count(*) AS payments FROM payments;"
```

Raqamlar Supabase'dagi bilan bir xil bo'lishi kerak.

---

## 6-bosqich. Backend'ni sinab ko'rish (5 daqiqa)

```powershell
cd C:\abaacademy\backend
.\scripts\start-api.bat
```

Boshqa PowerShell oynasida:

```powershell
curl http://127.0.0.1:8000/health
```

`{"status":"ok","database":"connected"...}` chiqsa — backend va baza ishlayapti. Birinchi oynada Ctrl+C.

Testlarni ham bir marta ishlating (1 daqiqa):

```powershell
cd C:\abaacademy\backend
.venv\Scripts\python -m unittest discover -s tests
```

Oxirida `OK` chiqishi kerak.

---

## 7-bosqich. Backend'ni Windows service qilish (10 daqiqa)

Service — kompyuter qayta yonganda backend o'zi ishga tushadi degani.

1. https://nssm.cc/download → zip'ni oching → `win64\nssm.exe` faylini `C:\abaacademy\nssm.exe` ga nusxalang.
2. PowerShell (administrator):

```powershell
C:\abaacademy\nssm.exe install aba-api "C:\abaacademy\backend\scripts\start-api.bat"
C:\abaacademy\nssm.exe set aba-api AppDirectory C:\abaacademy\backend
C:\abaacademy\nssm.exe set aba-api AppStdout C:\abaacademy\logs\api.log
C:\abaacademy\nssm.exe set aba-api AppStderr C:\abaacademy\logs\api.log
C:\abaacademy\nssm.exe set aba-api AppRotateFiles 1
C:\abaacademy\nssm.exe set aba-api AppRotateBytes 10000000
C:\abaacademy\nssm.exe set aba-api DependOnService postgresql-x64-16
C:\abaacademy\nssm.exe start aba-api
```

(`C:\abaacademy\logs` papkasini oldindan yarating.)

3. Tekshiring: `curl http://127.0.0.1:8000/health` yana `ok` qaytarsin. Kompyuterni qayta yoqib, 1 daqiqadan keyin yana tekshiring.

---

## 8-bosqich. Cloudflare Tunnel — internetga chiqarish (20 daqiqa)

1. Cloudflare'da domeningiz qo'shilgan bo'lsin (Registrar'dan olsangiz, o'zi qo'shilgan).
2. Cloudflare → **Zero Trust** → Networks → **Tunnels** → *Create a tunnel* → Cloudflared → nom: `abaacademy`.
3. Keyingi sahifada **Windows 64-bit** tanlang. U sizga bitta uzun buyruq ko'rsatadi (`cloudflared.exe service install eyJ...`). Avval cloudflared'ni o'rnating:
   - https://github.com/cloudflare/cloudflared/releases → `cloudflared-windows-amd64.msi` → o'rnating.
   - Keyin Cloudflare ko'rsatgan buyruqni PowerShell (administrator)'ga nusxalab bajaring. Bu uni service qiladi.
4. Cloudflare sahifasida **Public Hostname** qo'shing:
   - Subdomain: `api`, Domain: sizning domeningiz → `api.abaacademy.org`
   - Service: Type `HTTP`, URL `localhost:8000`
   - Save.
5. Brauzerda `https://api.abaacademy.org/health` oching — `ok` chiqishi kerak. Bu endi butun dunyodan ishlaydi.

Port ochish, router sozlash, static IP — hech biri kerak emas.

---

## 9-bosqich. Saytni yangi backend'ga ulash (5 daqiqa)

1. `C:\abaacademy\backend\.env` da `FRONTEND_URLS=https://abaacademy.vercel.app` turganiga ishonch hosil qiling.
2. Vercel → loyiha → Settings → **Environment Variables** → `VITE_API_BASE_URL` ni toping (yo'q bo'lsa yarating) → qiymat: `https://api.abaacademy.org` → Save.
3. Vercel → Deployments → oxirgi deploy → **Redeploy**.
4. 2 daqiqadan keyin `abaacademy.vercel.app` ni ochib login qiling. Yuqorida "Live DB" yozuvi chiqsa — hammasi ulandi.

Shu paytdan boshlab Render va Supabase ishlatilmaydi. Ularni darhol o'chirmang — 1 hafta hammasi yaxshi ishlasa, keyin o'chirasiz.

---

## 10-bosqich. Backup — majburiy (10 daqiqa)

Kompyuter diski buzilsa, faqat backup qutqaradi.

1. Google Drive Desktop o'rnating va kiring. `C:\abaacademy\backups` papkasini Drive'ga sinxronlanadigan qiling (Drive → Preferences → My Computer → Add folder).
2. Backup skriptini sinang:

```powershell
C:\abaacademy\backend\scripts\backup.bat
```

`C:\abaacademy\backups` ichida `abaacademy-SANA.dump` fayli paydo bo'lsin.

3. Har kecha avtomatik: Start → **Task Scheduler** → Create Basic Task:
   - Name: `ABA backup`
   - Trigger: Daily, 02:00
   - Action: Start a program → Program: `C:\abaacademy\backend\scripts\backup.bat`
   - Finish. Keyin vazifani o'ng tugma → Properties → "Run whether user is logged on or not" → OK (Windows parolini so'raydi).

Backup'dan tiklash (kerak bo'lganda):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -h localhost -U postgres -d abaacademy --clean --if-exists --no-owner C:\abaacademy\backups\abaacademy-SANA.dump
```

---

## 11-bosqich. Telegram davomat guruhlari (5 daqiqa)

Saytga `admin@` bilan kiring → Groups & Placement → har bir guruhga Telegram chat ID kiriting → Save → **Send test message**. Chat ID'lar eski skriptdagi ro'yxatda.

---

## Har oy qilinadigan ishlar

- `C:\abaacademy\backups\backup.log` ni oching — oxirgi qatorlar `Backup OK` bo'lsin.
- Google Drive'da backup fayllari ko'rinayotganini tekshiring.
- Windows update'dan keyin `https://api.abaacademy.org/health` ni ochib ko'ring.

## Kod yangilanganda

```powershell
cd C:\abaacademy
git pull
cd backend
.venv\Scripts\pip install -r requirements.txt
C:\abaacademy\nssm.exe restart aba-api
```

Sayt (Vercel) GitHub'dan o'zi yangilanadi.

---

## Muammo chiqsa

| Belgisi | Sababi / yechimi |
|---|---|
| Saytda "Connection unavailable" | `https://api.DOMEN/health` ni oching. Ochilmasa: PC yoniqmi? `nssm status aba-api` va `nssm status cloudflared` → `SERVICE_RUNNING` bo'lsin. |
| `health` da `database` xatosi | PostgreSQL service to'xtagan: Services → postgresql-x64-16 → Start. |
| `Missing staff accounts` | `.env` dagi `STAFF_ACCOUNTS_JSON` noto'g'ri. |
| Backend ishga tushmayapti | `C:\abaacademy\logs\api.log` oxirini o'qing, xato matnini yuboring. |
| Telegram post ketmayapti | `.env` da token to'g'rimi? Bot guruhda a'zomi? Groups sahifasida "Send test message". |
| Login'da 429 | 15 daqiqa kuting — parol 8 marta xato kiritilgan. |

Loglar: `C:\abaacademy\logs\api.log`. Yordam so'raganda shu faylning oxirgi 30 qatorini yuboring.
