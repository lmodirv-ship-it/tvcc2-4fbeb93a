# دليل التركيب الكامل — TVCC

> هذا الدليل يشرح خطوة بخطوة كيفية تشغيل مشروع TVCC من ملف `tvcc-final.zip` على جهازك المحلي وعلى السيرفر (VPS).

---

## المتطلبات الأساسية

قبل البدء، تأكد من توفر التالي:

- **Node.js 20** أو أحدث
- **Bun 1.1+** (موصى به بشدة) أو npm 10+ / pnpm 9+
- **Git**
- **مشروع Supabase** (Lovable Cloud) — للحصول على مفاتيح API وقاعدة البيانات

---

## الجزء الأول: تشغيل المشروع على جهازك المحلي

### الخطوة 1: نسخ الملفات

#### على Windows (PowerShell):
```powershell
Expand-Archive -Path tvcc-final.zip -DestinationPath tvcc
cd tvcc
```

#### على Linux / macOS:
```bash
unzip tvcc-final.zip -d tvcc && cd tvcc
```

> أو يمكنك استخراج الملف من خلال مدير الملفات (File Explorer / Finder) إلى مجلد `tvcc`.

### الخطوة 2: تثبيت الحزم

```bash
bun install
```

> **إذا لم يكن Bun مثبتاً على جهازك:**
> ```bash
> curl -fsSL https://bun.sh/install | bash
> ```
>
> **بديل باستخدام npm:**
> ```bash
> npm install --legacy-peer-deps
> ```

### الخطوة 3: إعداد متغيرات البيئة

```bash
cp .env.example .env
```

افتح ملف `.env` بأي محرر نصوص واملأ القيم المطلوبة:

| المتغير | القيمة المطلوبة | من أين تحصل عليها |
|---|---|---|
| `VITE_SUPABASE_URL` | رابط Supabase | لوحة تحكم Supabase → Project Settings → API → URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | المفتاح العام | لوحة تحكم Supabase → Project Settings → API → `anon public` |
| `VITE_SUPABASE_PROJECT_ID` | معرف المشروع | لوحة تحكم Supabase → Project Settings → General → Reference ID |
| `SUPABASE_URL` | نفس VITE_SUPABASE_URL | انسخ نفس القيمة |
| `SUPABASE_PUBLISHABLE_KEY` | نفس VITE_SUPABASE_PUBLISHABLE_KEY | انسخ نفس القيمة |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح الخدمة | لوحة تحكم Supabase → Project Settings → API → `service_role` |
| `SUPABASE_DB_URL` | رابط قاعدة البيانات | لوحة تحكم Supabase → Project Settings → Database → Connection string |
| `NOTIFICATIONS_INGEST_SECRET` | سلسلة عشوائية | شغّل: `openssl rand -hex 32` |
| `LOVABLE_API_KEY` | (اختياري) | Lovable Cloud → AI Gateway |

> **تحذير:** لا تشارك مفتاح `SUPABASE_SERVICE_ROLE_KEY` مع أي أحد ولا ترفعه على GitHub.

### الخطوة 4: تطبيق migrations قاعدة البيانات (إذا كان المشروع جديد)

إذا كان مشروعك جديداً ولم يُضف إليه الجداول بعد، شغّل:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

> `<your-project-ref>` هو معرف مشروع Supabase (مثال: `eozbfhkaddrjdzsshlwr`).
>
> إذا كان مشروعك أنشئ عبر Lovable Cloud مباشرة، فالمigrations قد تكون مطبقة فعلاً ويمكنك تخطي هذه الخطوة.

### الخطوة 5: تشغيل المشروع محلياً

```bash
bun dev
```

انتظر حتى يظهر:
```
  ➜  Local:   http://localhost:5173/
```

افتح المتصفح على: **http://localhost:5173**

### الخطوة 6: اختبار البناء المحلي

للتأكد من أن البناء يعمل بدون أخطاء:

```bash
bun run build
```

إذا نجح، ستجد مجلد `.output/` تم إنشاؤه.

لمعاينة البناء:

```bash
bun run start
```

افتح المتصفح على: **http://localhost:3000**

---

## الجزء الثاني: نشر المشروع على السيرفر (VPS)

### الخطوة 1: تأجير سيرفر

- أنصح بـ **Ubuntu 22.04 LTS**
- مواصفات لا تقل عن: **1 CPU / 2 GB RAM / 20 GB SSD**
- احصل على IP السيرفر من مزود الخدمة (DigitalOcean, Hetzner, AWS, Contabo...)

### الخطوة 2: الاتصال بالسيرفر

```bash
ssh root@<your-server-ip>
```

> استبدل `<your-server-ip>` بعنوان IP السيرفر الحقيقي.

### الخطوة 3: تحديث النظام وتثبيت الأدوات الأساسية

```bash
apt update && apt upgrade -y
apt install -y curl git nginx ufw unzip
```

### الخطوة 4: تثبيت Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

تحقق:
```bash
node -v   # يجب أن يظهر v20.x.x
npm -v    # يجب أن يظهر 10.x.x
```

### الخطوة 5: تثبيت Bun و PM2

```bash
npm install -g pm2 bun
```

### الخطوة 6: إعداد الجدار الناري (Firewall)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### الخطوة 7: رفع ملف ZIP إلى السيرفر

من **جهازك المحلي** (لا تغلق Terminal/PowerShell):

```bash
scp tvcc-final.zip root@<your-server-ip>:/var/www/
```

ثم عد إلى Terminal السيرفر:

```bash
cd /var/www
unzip tvcc-final.zip -d tvcc
cd tvcc
```

### الخطوة 8: تثبيت الحزم على السيرفر

```bash
bun install
```

أو إذا لم يعمل Bun:
```bash
npm install --legacy-peer-deps
```

### الخطوة 9: إعداد متغيرات البيئة على السيرفر

```bash
cp .env.example .env
nano .env
```

املأ نفس القيم التي استخدمتها محلياً.

- **Ctrl+O** ثم Enter للحفظ
- **Ctrl+X** للخروج

### الخطوة 10: بناء المشروع

```bash
bun run build
```

> يجب أن يكتمل بدون أخطاء وتظهر رسالة تشبه:
> ```
> .output/server/index.mjs     200.34 kB │ gzip: 45.21 kB
> ```

### الخطوة 11: تشغيل التطبيق باستخدام PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

تحقق من الحالة:
```bash
pm2 status
```

يجب أن ترى `tvcc` بـ `online`.

### الخطوة 12: إعداد Nginx (Reverse Proxy)

أنشئ ملف إعداد Nginx:

```bash
nano /etc/nginx/sites-available/tvcc
```

ألصق التالي (استبدل `tvcc.example.com` بنطاقك):

```nginx
server {
    listen 80;
    server_name tvcc.example.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

فعّل الموقع:

```bash
ln -s /etc/nginx/sites-available/tvcc /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### الخطوة 13: ربط النطاق (Domain)

في لوحة تحكم مزود DNS (Cloudflare, Namecheap, GoDaddy...):

أضف سجل **A**:

| Type | Name | Value |
|---|---|---|
| A | tvcc | `<your-server-ip>` |

انتظر 5-15 دقيقة حتى ينتشر (propagation).

تحقق:
```bash
dig tvcc.example.com
```

### الخطوة 14: تركيب SSL Certificate (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tvcc.example.com --redirect --agree-tos -m your-email@example.com
```

> سيسألك Certbot عما إذا كنت تريد إعادة توجيه HTTP إلى HTTPS — اختر **Yes** (2).

تحقق:
```bash
curl -I https://tvcc.example.com
```

### الخطوة 15: إعداد Supabase Auth

في لوحة تحكم Supabase:

1. اذهب إلى **Authentication → URL Configuration**
2. أضف نطاقك إلى **Redirect URLs**:
   - `https://tvcc.example.com/auth/callback`
   - `https://tvcc.example.com`

3. في **Authentication → Providers → Google**:
   - تأكد من تفعيل Google Sign-In
   - أضف Client ID و Client Secret إذا لم تكن مضافة

### الخطوة 16: التحقق النهائي

افتح المتصفح على `https://tvcc.example.com`:

- [ ] الصفحة `/auth` تعمل وتظهر نموذج تسجيل الدخول
- [ ] تسجيل الدخول بالبريد + كلمة المرور يعمل
- [ ] تسجيل الدخول بـ Google يعمل
- [ ] لوحة التحكم `/dashboard` تُحمّل بدون أخطاء في Console
- [ ] `/websites` تعمل ويظهر CRUD
- [ ] `/notifications` تعمل وتظهر الجرس
- [ ] `/monitoring` تعرض بيانات حقيقية (Ping)
- [ ] `/ssl` تعرض شهادات SSL
- [ ] لا توجد صفحات مكسورة أو فارغة

---

## الجزء الثالث: أوامر PM2 الشائعة

```bash
pm2 status              # عرض حالة التطبيقات
pm2 logs tvcc           # عرض سجلات TVCC
pm2 logs tvcc --lines 50 # آخر 50 سطر
pm2 restart tvcc        # إعادة تشغيل
pm2 stop tvcc           # إيقاف مؤقت
pm2 delete tvcc         # حذف من PM2
pm2 monit               # مراقبة حية
```

---

## الجزء الرابع: تحديث التطبيق

عندما يكون لديك نسخة جديدة من tvcc-final.zip:

```bash
cd /var/www/tvcc
pm2 stop tvcc
# ارفع ZIP جديد أو اسحب Git
unzip -o tvcc-final.zip -d .
bun install
bun run build
pm2 restart tvcc
```

---

## الجزء الخامس: استكشاف الأخطاء الشائعة

### المشكلة 1: `bun: command not found`
```bash
# الحل
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### المشكلة 2: `npm install` يفشل بسبب peer dependencies
```bash
npm install --legacy-peer-deps
```

### المشكلة 3: خطأ في البناء TypeScript
```bash
bun run typecheck
```
اقرأ الخطأ وصحّح الملف المذكور.

### المشكلة 4: التطبيق يعمل على localhost:3000 لكن لا يفتح من النطاق
- تأكد من أن Nginx يعمل: `systemctl status nginx`
- تأكد من أن `proxy_pass` يشير إلى `127.0.0.1:3000`
- تأكد من فتح المنفذ 80 و 443 في الجدار الناري: `ufw status`

### المشكلة 5: Supabase — `relation does not exist`
- لم يتم تطبيق migrations
- شغّل: `npx supabase db push`
- أو انسخ SQL من `supabase/migrations/` وشغّل يدوياً في Supabase SQL Editor

### المشكلة 6: Google OAuth لا يعمل
- تأكد من إضافة نطاقك في Supabase Auth → URL Configuration
- تأكد من تفعيل Google Provider في Supabase
- تأكد من أن Client ID/Secret صحيحة

### المشكلة 7: PM2 لا يبدأ مع إعادة التشغيل
```bash
pm2 startup systemd
pm2 save
```

---

## ملخص سريع (Cheat Sheet)

| المهمة | الأمر |
|---|---|
| تشغيل محلي | `bun dev` |
| بناء إنتاج | `bun run build` |
| تشغيل إنتاج | `bun run start` |
| تثبيت حزم | `bun install` |
| رفع ZIP | `scp tvcc.zip root@IP:/var/www/` |
| تشغيل PM2 | `pm2 start ecosystem.config.cjs` |
| إعادة تشغيل | `pm2 restart tvcc` |
| سجلات | `pm2 logs tvcc` |
| تحديث Nginx | `nginx -t && systemctl reload nginx` |
| SSL جديد | `certbot --nginx -d domain.com` |

---

**إذا واجهت أي مشكلة غير مذكورة هنا، أرسل رسالة تتضمن:**
1. خطأ النص الكامل (Full error message)
2. الأمر الذي شغّلته
3. نظام التشغيل (Windows/macOS/Linux)
