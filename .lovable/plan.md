# إضافة نطاقات رسمية للمنصة

إنشاء جدول `public.official_domains` لتسجيل النطاقات الرسمية التابعة للمنصة، مع إدخال النطاقات الثلاثة التي حدّدها المستخدم.

## النطاقات المطلوبة

- `tvcc.hnpay.live` — النطاق الأساسي للمنصة (primary = true)
- `hn-groupe.org` — نطاق رسمي بديل (primary = false)
- `www.hn-groupe.org` — نسخة www (primary = false)

## ما سيتم بناؤه

### 1. جدول `public.official_domains`

الأعمدة:

- `id` uuid primary key
- `domain` text — اسم النطاق الفريد (مثلاً tvcc.hnpay.live)
- `is_primary` boolean — هل هو النطاق الأساسي للمنصة
- `is_active` boolean — هل النطاق مفعّل حالياً
- `purpose` text — وصف مختصر (مثلاً "البوابة العامة للمنصة")
- `public_url` text — عنوان HTTPS الكامل
- `created_at` / `updated_at` timestamp

مع GRANT و RLS و trigger `touch_updated_at`.

### 2. ترحيل (migration) واحد

- إنشاء الجدول.
- منح `SELECT` لـ `authenticated` (لقراءة من الإعدادات) و `SELECT` لـ `anon` (للعرض العام) لأنها بيانات عامة عن المنصة.
- تفعيل RLS.
- سياسة: قراءة عامة للجميع، وكتابة/تعديل/حذف فقط للمدير (`system_owner` / `admin`).
- إدخال الصفوف الثلاثة.

### 3. دالة خادم و endpoint عام

- `src/lib/official-domains.functions.ts`: `listOfficialDomains()` (GET عام) لإرجاع النطاقات النشطة.
- `src/routes/api/public/official-domains.ts`: endpoint JSON يعرض النطاق الرسمية للمنصة (مفيد للربط الخارجي والـ PWA).

### 4. تحديث الواجهة

- في `src/routes/_authenticated/settings.tsx` أو `src/routes/_authenticated/domains.tsx`: إضافة بطاقة "النطاقات الرسمية" تعرض الجدول وإمكانية تفعيل/تعطيل النطاق (للمدير فقط).
- تحديث `src/routes/index.tsx` أو `src/components/layout/PublicNav.tsx` لعرض النطاق الرسمية في التذييل أو إعدادات الاتصال.

### 5. الأثر المتوقع

- النطاقات الثلاثة تظهر في قاعدة البيانات كـ "رسمية".
- يمكن للمدير تعديلها أو إضافة نطاقات رسمية جديدة.
- PWA والتطبيقات الخارجية يمكنها الاستعلام عن `/api/public/official-domains` لمعرفة النطاقات المعتمدة.

## ملاحظات أمنية

- لا يتم تسجيل أي أسرار في هذا الجدول؛ النطاقات معلومات عامة فقط.
- سياسة الكتابة مقصورة على `system_owner` / `admin` عبر `can_manage` أو `has_role`.
