# خطة بناء منصة TVCC — مركز إدارة المواقع

## ملخص
بناء منصة SaaS مركزية (RTL / عربي) لإدارة عدة مواقع من لوحة واحدة. المنصة تتضمن: مصادقة + أدوار، إدارة مواقع مع نظام ربط/تحقق، قواعد بيانات، تخزين، عملاء، اشتراكات، مستخدمين موحدين، إجراءات جماعية، وزر "تصدير HTML ثابت".

---

## المرحلة 1: البنية التحتية والتصميم

### 1.1 تفعيل Lovable Cloud
- تفعيل Supabase / Lovable Cloud للمصادقة والقاعدة
- التأكد من attachSupabaseAuth في start.ts

### 1.2 نظام الألوان والتصميم (RTL)
- تحديث `src/styles.css`: نظام ألوان احترافي داكن (Dark Admin) باستخدام oklch
- ألوان رئيسية: زرقاء-بنفسجية غامقة للوحة الإدارة
- إضافة متغيرات خاصة: --status-online, --status-offline, --status-warning
- تعيين `dir="rtl"` و `lang="ar"` في `__root.tsx`

### 1.3 مكونات التخطيط
- `AppSidebar`: شريط جانبي قابل للطي مع أيقونات Lucide، قائمة متدرجة
- `AppHeader`: شريط علوي مع بحث، إشعارات، قائمة المستخدم
- `DashboardLayout`: تخطيط رئيسي يجمع Sidebar + Header + Outlet
- إضافة خيار "تصدير HTML" في Sidebar

---

## المرحلة 2: قاعدة البيانات والمصادقة

### 2.1 الجداول (Migrations)

| الجدول | الغرض |
|--------|-------|
| `websites` | المواقع المُدارة (الاسم، الدومين، الحالة، كود التحقق، آخر ping) |
| `databases` | قواعد بيانات مرتبطة بموقع (اسم، نوع، host مخفي، مستخدم) |
| `storages` | مساحات تخزين مرتبطة (اسم، نوع، حجم، موقع) |
| `clients` | العملاء (الاسم، البريد، الهاتف، الموقع) |
| `subscriptions` | الاشتراكات (العميل، الموقع، الخطة، السعر، الحالة، التاريخ) |
| `site_users` | المستخدمون الموحدون (معرف فريد، بريد، اسم، كلمة مرور مشفرة) |
| `site_user_access` | صلاحيات المستخدم على المواقع |
| `activity_log` | سجل العمليات (النوع، المستخدم، التفاصيل، التاريخ) |
| `user_roles` | أدوار المستخدمين (admin, editor, viewer) |

### 2.2 RLS + Security
- تفعيل RLS على كل جداول `public`
- جداول `GRANT` لـ authenticated + service_role
- دالة `has_role()` من نوع security definer
- سياسات: المالك يرى كل شيء، المحرر يُعدّل، المشاهد يقرأ فقط

### 2.3 المصادقة
- صفحات `/auth/login` و `/auth/register`
- حماية `_authenticated` layout (redirect إلى /auth)
- Hook `useAuth` للجلسة

---

## المرحلة 3: الصفحات والوظائف الرئيسية

### 3.1 Dashboard (`/dashboard`)
- بطاقات إحصائيات: عدد المواقع، المستخدمين، العملاء، الاشتراكات
- جدول آخر المواقع + حالتها
- رسم بياني للاشتراكات (Recharts)
- آخر 5 عمليات في السجل

### 3.2 إدارة المواقع (`/websites`)
- جدول متقدم: اسم، دومين، حالة (online/offline/warning)، كود التحقق
- زر "تحقق" يستدعي API الموقع ويقرأ `<meta name="tvcc-verify">`
- نموذج إضافة/تعديل موقع
- إجراءات جماعية: تفعيل/تعطيل، حذف (مع رسالة تأكيد AlertDialog)
- تصفية وبحث

### 3.3 قواعد البيانات (`/databases`)
- جدول: الاسم، الموقع المرتبط، النوع، الحالة
- النموذج يخفي كلمة المرور بعد الحفظ (لا تُعرض أبداً)
- ربط تلقائي بموقع

### 3.4 التخزين (`/storage`)
- جدول: الاسم، الموقع، النوع، الحجم المستخدم
- إحصائيات سريعة

### 3.5 العملاء (`/clients`)
- جدول CRUD كامل
- ربط كل عميل بموقع/مواقع
- تصفية حسب الموقع

### 3.6 الاشتراكات (`/subscriptions`)
- جدول: العميل، الموقع، الخطة، السعر، الحالة
- إحصائيات الإيرادات

### 3.7 المستخدمون الموحدون (`/users`)
- جدول: المعرف، الاسم، البريد، المواقع المصرّح له
- نموذج منح/إلغاء صلاحية الوصول لموقع

### 3.8 سجل العمليات (`/activity`)
- جدول زمني: النوع، المستخدم، التفاصيل، التاريخ
- تصفية حسب النوع

---

## المرحلة 4: الوظائف الخادمية (Server Functions)

لكل صفحة: `createServerFn` مع Zod validation + `requireSupabaseAuth`
- `websites.functions.ts`: list, create, update, delete, verify, bulkUpdate, bulkDelete
- `databases.functions.ts`: list, create, update, delete (password never returned)
- `storages.functions.ts`: list, create, update, delete
- `clients.functions.ts`: list, create, update, delete
- `subscriptions.functions.ts`: list, create, update, delete, stats
- `siteUsers.functions.ts`: list, create, update, delete, grantAccess, revokeAccess
- `activity.functions.ts`: list, log
- `export.functions.ts`: exportStaticHtml (يقرأ من DB ويُنشئ ملف HTML واحد)

---

## المرحلة 5: ميزة تصدير HTML الثابت

زر في Sidebar: "تصدير واجهة HTML"
- `exportStaticHtml(scope)`:
  - scope = 'dashboard' | 'websites' | 'clients' | 'subscriptions' | 'all'
  - يقرأ البيانات من DB (بدون كلمات مرور، بدون كود تحقق)
  - يُنشئ ملف HTML واحد بـ CSS مدمج (inline) من tokens التصميم
  - لا يتطلب login، لا يحتوي على CRUD أو bulk actions
  - يتضمن: البطاقات، الجداول، ألوان الحالة، تبديل sidebar فقط
  - يُرسل كـ Blob للتنزيل: `tvcc-export-YYYY-MM-DD.html`

---

## المرحلة 6: تحسينات وتأمين

- Toast notifications (Sonner) لكل عملية نجاح/فشل
- تأكيدات AlertDialog قبل كل حذف/تعديل جماعي
- Skeleton loaders للجداول
- Responsive: Sidebar يتحول إلى Drawer على الجوال
- Pagination للجداول الكبيرة
- Search + Filter لكل جدول

---

## التقسيم التقني

```text
src/
  routes/
    __root.tsx              (RTL shell, QueryClient)
    _authenticated.tsx      (حماية الصفحات)
    _authenticated/
      dashboard.tsx
      websites.tsx
      databases.tsx
      storage.tsx
      clients.tsx
      subscriptions.tsx
      users.tsx
      activity.tsx
      settings.tsx
    auth/
      login.tsx
      register.tsx
    api/
      public/
        verify.ts           (endpoint عام للمواقع)
  lib/
    websites.functions.ts
    databases.functions.ts
    storages.functions.ts
    clients.functions.ts
    subscriptions.functions.ts
    siteUsers.functions.ts
    activity.functions.ts
    export.functions.ts
    auth.functions.ts
  components/
    layout/
      AppSidebar.tsx
      AppHeader.tsx
      DashboardLayout.tsx
    data-table/
      DataTable.tsx
      BulkActions.tsx
      FilterBar.tsx
    export/
      HtmlExportBuilder.ts  (منطق بناء HTML)
  integrations/
    supabase/               (عند تفعيل Cloud)
```

---

## ما بعد MVP (Phase 2)
- SSO بين المواقع (OAuth/Token)
- Ping فعلي للمواقع (fetch cron)
- نسخ احتياطي حقيقي
- PDF Export
- Webhooks

## Notes
- كل الكود المصدري React+TypeScript
- عند النشر (Publish) يُترجم تلقائياً إلى HTML/CSS/JS
- تصدير HTML ثابت متاح كملف منفصل بدون Backend
- لا يُعرض كلمات مرور DB أو أكواد التحقق في أي واجهة بعد الحفظ
