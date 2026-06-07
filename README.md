# TVCC — مركز قيادة المواقع

منصة شخصية لإدارة جميع المشاريع والمواقع (الحالية والمستقبلية، خاصة تلك المبنية عبر Lovable) من لوحة واحدة.
تتكامل مع شقيقَيها **HN-DB** (إدارة قواعد البيانات) و **HN-Cloud** (تخزين الملفات و APK).

> ملاحظة: هذا مشروع شخصي — ليس SaaS عام. لا multi-tenant، لا عملاء خارجيون.

---

## 🧱 المكدّس التقني

- **Framework:** TanStack Start v1 (React 19 + Vite 7)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — Postgres + Auth + RLS
- **Server logic:** `createServerFn` + Server Routes
- **Target runtime:** Cloudflare Workers (nitro)

---

## 🚀 تشغيل محلي

```bash
# 1. تثبيت الحزم
npm install            # أو: bun install

# 2. إعداد البيئة
cp .env.example .env   # ثم املأ القيم

# 3. تشغيل التطوير
npm run dev            # http://localhost:8080
```

## 🏗️ Production Build

```bash
npm run build          # ينتج dist/
npm run preview        # معاينة محلياً
```

---

## 🌐 النشر على VPS

> الخادم يجب أن يدعم **Node 20+** (لتشغيل SSR worker bundle).

### 1. تجهيز الخادم
```bash
apt update && apt install -y nodejs npm nginx certbot python3-certbot-nginx
npm install -g pm2
```

### 2. رفع المشروع
```bash
git clone <repo>  ||  scp -r ./tvcc user@vps:/var/www/tvcc
cd /var/www/tvcc
npm ci
cp .env.example .env && nano .env      # ضع القيم الحقيقية
npm run build
```

### 3. تشغيل دائم مع PM2
```bash
pm2 start "node .output/server/index.mjs" --name tvcc
pm2 startup && pm2 save
```

### 4. Nginx Reverse Proxy
```nginx
server {
  server_name tvcc.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

### 5. SSL
```bash
certbot --nginx -d tvcc.example.com
```

---

## 📁 هيكلة المشروع

```
src/
├── routes/
│   ├── __root.tsx              # الـ shell الرئيسي
│   ├── index.tsx               # الصفحة الرئيسية
│   ├── auth.tsx                # تسجيل الدخول
│   ├── _authenticated/         # كل الصفحات المحمية
│   │   ├── dashboard.tsx
│   │   ├── websites.tsx
│   │   ├── groups.tsx
│   │   ├── templates.tsx
│   │   ├── editor.*.tsx        # 15 قسم للمحرر
│   │   ├── monitoring.tsx
│   │   ├── jobs.tsx
│   │   ├── integrations.tsx
│   │   ├── domains.tsx
│   │   ├── ssl.tsx
│   │   ├── notifications.tsx
│   │   ├── environment.tsx
│   │   ├── activity.tsx
│   │   ├── reports.tsx
│   │   ├── vault.tsx
│   │   ├── recovery.tsx
│   │   ├── apk-manager.tsx
│   │   ├── clients.tsx
│   │   ├── users.tsx
│   │   ├── subscriptions.tsx
│   │   ├── audit.tsx
│   │   └── settings.tsx
│   └── api/public/
│       └── site-config.ts      # API للواجهات الخارجية
├── components/                 # UI + layout + editor
├── integrations/supabase/      # عميل DB (مولّد تلقائياً)
├── lib/                        # helpers + server functions
└── styles.css                  # tokens + theme
```

---

## 🗃️ قاعدة البيانات (Lovable Cloud)

| الجدول | الغرض |
|---|---|
| `profiles`, `user_roles` | المستخدمون والصلاحيات |
| `websites` | المواقع + ربط HN-DB/HN-Cloud + APK |
| `site_groups`, `website_group_members` | تجميع المواقع |
| `site_templates`, `website_template_links` | قوالب جاهزة |
| `website_settings`, `website_env_vars` | الإعدادات لكل موقع |
| `site_users`, `site_user_access` | مستخدمو كل موقع |
| `clients`, `subscriptions` | العملاء والاشتراكات |
| `databases`, `storages` | تتبع موارد HN-DB و HN-Cloud |
| `domains` | مدير النطاقات + SSL |
| `vault_secrets` | خزنة الأسرار |
| `notifications`, `notification_channels` | التنبيهات |
| `recovery_points` | نقاط الاسترجاع |
| `website_android_releases` | إصدارات APK |
| `deployment_jobs`, `deployment_job_targets` | مهام النشر الجماعية |
| `site_health_checks` | مراقبة الحالة |
| `activity_log` | سجل العمليات |

كل الجداول محمية بـ **RLS** (`auth.uid() = owner_id`).

---

## 🔗 التكامل مع HN-DB و HN-Cloud

- **TVCC** → ينظم ويربط ويعرض (لا يخزن ملفات بنفسه).
- **HN-DB** → يدير قواعد البيانات (REST عبر `HN_DB_API_URL`).
- **HN-Cloud** → يخزن الملفات و APK ويوقّع webhook بـ `HN_CLOUD_WEBHOOK_SECRET`.
- نقطة التكامل المركزية: `GET /api/public/site-config?domain=...` ترجع إعدادات الموقع كاملة.

---

## 🧩 تكامل Lovable (مستقبلي)

الـ stub جاهز في `src/routes/_authenticated/integrations.tsx`. البنية مهيّأة لإضافة:
- Workspaces / Projects discovery
- Import / Sync / Fetch latest
- ZIP & Local uploads
- GitHub كمصدر ثانوي

بدون إعادة بناء النظام.

---

## ✅ قائمة الجاهزية للنشر

- [x] جميع الجداول لها RLS + GRANT
- [x] لا توجد بيانات وهمية / mock
- [x] Empty states في كل الصفحات
- [x] `.env.example` كامل
- [x] صفحة **System Audit** تعطي نسبة جاهزية حية
- [ ] `npm run build` ينجح محلياً (شغّله قبل النشر)
- [ ] DNS + SSL مهيّآن على الـ VPS

---

## 📜 الترخيص

خاص — استخدام شخصي فقط.
