
# تجهيز TVCC للربط مع HN-DB و HN-Cloud

الهدف: تحويل صفحتي `/databases` و `/storage` داخل TVCC من تخزين محلي إلى **عميل (client) يستهلك APIs خارجية** من HN-DB و HN-Cloud، مع شاشة Settings لإدارة الروابط والتوكنات.

## 1) أسرار جديدة (Secrets)

أطلب من المستخدم إضافة 4 أسرار عبر أداة الأسرار:
- `HN_DB_API_URL` (مثال: `https://hn-db.lovable.app`)
- `HN_DB_API_TOKEN`
- `HN_CLOUD_API_URL`
- `HN_CLOUD_API_TOKEN`

تُقرأ فقط داخل Server Functions عبر `process.env`. لا تُسرَّب للعميل.

## 2) صفحة Settings → Integrations

مسار جديد: `/_authenticated/settings.integrations.tsx`

- بطاقتان: HN-DB و HN-Cloud.
- كل بطاقة تعرض:
  - حالة الاتصال (Connected / Not configured / Error) عبر استدعاء `pingHnDb` / `pingHnCloud` (server fn).
  - زر "Test Connection".
  - رابط للأسرار (إرشاد للمستخدم لتعديلها من Project Settings).
- إذا الأسرار غير مضبوطة → رسالة واضحة + تعليمات.

## 3) Server Functions (عميل للـ APIs الخارجية)

ملف `src/lib/hn-db.functions.ts`:
- `pingHnDb` → GET `/api/public/v1/health`
- `listRemoteDatabases` → GET `/api/public/v1/databases`
- `createRemoteDatabase(input)` → POST `/api/public/v1/databases`
- `deleteRemoteDatabase(id)` → DELETE
- `listRemoteBackups(dbId)` → GET

ملف `src/lib/hn-cloud.functions.ts`:
- `pingHnCloud`
- `listRemoteSpaces`
- `createRemoteSpace`
- `listRemoteFiles(spaceId, path)`

كلها:
- محمية بـ `requireSupabaseAuth`.
- تستخدم `fetch` مع `Authorization: Bearer ${process.env.HN_*_API_TOKEN}`.
- تُرجع DTO عادي + معالجة فشل بشكل `{ data, error }` بدل throw.
- في حالة غياب الأسرار → ترجع `{ configured: false }` بدل crash.

## 4) تحديث صفحات TVCC الحالية

**`/databases`**:
- استبدال استعلام Supabase المحلي بـ `listRemoteDatabases` عبر `useQuery`.
- نموذج "إضافة قاعدة" يستدعي `createRemoteDatabase` (يرسل لـ HN-DB، لا يحفظ محلياً).
- شريط حالة أعلى الصفحة: "Connected to HN-DB" أو "Not configured — اذهب للإعدادات".
- جدول `databases` المحلي **يبقى موجوداً** كـ fallback/cache فقط ولا يُستخدم بشكل افتراضي.

**`/storage`**:
- نفس النمط مع `listRemoteSpaces`.

**`/databases/$id/backups`** (جديد، اختياري): يستدعي HN-DB + HN-Cloud لعرض النسخ الاحتياطية.

## 5) تحديث Sidebar

إضافة:
- "الإعدادات → Integrations"
- مؤشر صغير (نقطة خضراء/حمراء) بجوار "قواعد البيانات" و"التخزين" حسب حالة الاتصال (يقرأها من React Query cache).

## 6) ما لا يتغير الآن

- لا تعديل على جداول Supabase الحالية لـ TVCC (نتركها كـ fallback).
- لا حذف لصفحات `/databases` و`/storage` — فقط استبدال مصدر البيانات.
- لا بناء لـ HN-DB أو HN-Cloud هنا (يُبنيا في مشروعين منفصلين كما شُرح في الرسالة السابقة).
- الدفعة B من خطة TVCC السابقة (Monitoring / Deployment runner / Scope Selector) تُؤجَّل لجلسة لاحقة.

## 7) تسلسل التنفيذ في هذه الجلسة

1. طلب الأسرار الأربعة من المستخدم.
2. إنشاء `src/lib/hn-db.functions.ts` و `src/lib/hn-cloud.functions.ts`.
3. إنشاء `src/routes/_authenticated/settings.integrations.tsx`.
4. تحديث `/databases` و `/storage` لاستخدام الـ server fns الجديدة (مع شريط حالة + fallback).
5. تحديث `AppSidebar` (إضافة Integrations + مؤشرات حالة).

## تفاصيل تقنية مختصرة

- كل `fetch` يضع timeout 10s ويعالج 401/403/5xx برسالة عربية واضحة.
- لا يتم تخزين أي bearer في `localStorage`.
- DTO فقط (objects/arrays) من الـ server fns.
- استدعاء الـ server fns عبر `useServerFn` داخل `useQuery` (ليس في loader، لأن الأسرار قد لا تكون مضبوطة → لا نريد كسر SSR/prerender).

---

**اضغط "Implement plan" للبدء، وسأطلب الأسرار الأربعة كأول خطوة.**
