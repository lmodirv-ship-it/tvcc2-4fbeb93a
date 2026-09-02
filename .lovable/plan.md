# توحيد نشر البيانات عبر النطاقات والسيرفر المحلي

الهدف: أن تعرض `hn-groupe.org` و `www.hn-groupe.org` و `tvcc.hnpay.live` و النسخة المحلية على `192.168.100.6:3005` **نفس المنصة ونفس البيانات**، مع نشر موحّد ومزامنة تلقائية.

## ما سيحصل عليه المستخدم

1. **نطاق رسمي واحد**: `tvcc.hnpay.live` يبقى النطاق الرسمي (canonical). النطاقان `hn-groupe.org` و `www.hn-groupe.org` يعرضان نفس المحتوى مع وسم canonical صحيح في الـ SEO (بدون كسر الروابط الحالية).
2. **صفحة جديدة «توحيد النشر» (`/publish-sync`)** داخل لوحة التحكم:
   - جدول لكل وجهة نشر (النطاقات الثلاثة + العقدة المحلية) مع الحالة، آخر مزامنة، الإصدار المنشور، ونتيجة آخر فحص صحّة.
   - زر «نشر الآن» لكل وجهة وزر «نشر للجميع».
   - سجل عمليات النشر مع المخرجات.
3. **العقدة المحلية `192.168.100.6:3005`**: تُسجَّل كوجهة نشر كاملة (نفس تطبيق TVCC). عند أي نشر، يُرسل أمر للوكيل على السيرفر المحلي: سحب النسخة الجديدة → بناء → إعادة تشغيل الخدمة على المنفذ 3005 → تقرير النتيجة إلى المنصة.
4. **API موحّد للبيانات**: نقطة عامة واحدة تقرأ منها كل الوجهات نفس البيانات لحظياً، فلا تتفرّع النسخ.

## التفاصيل التقنية

### قاعدة البيانات (migration واحدة)

- `public.publish_targets`: `id, owner_id, label, kind (domain|local_node), url, server_id (nullable FK servers), service_name, port, is_canonical, is_active, last_publish_at, last_status, last_version, health_url, created_at, updated_at`.
- `public.publish_runs`: `id, owner_id, target_id FK, trigger (manual|auto|webhook), status (pending|running|success|failed), started_at, finished_at, command_id (nullable), output text, error text, created_at`.
- GRANT كالمعتاد (`authenticated` CRUD، `ALL` لـ `service_role`)، RLS مفعّل بسياسات `can_manage(owner_id)`، بدون `anon`.
- بذر أولي في نفس الـ migration: صفوف لـ `tvcc.hnpay.live` (canonical)، `hn-groupe.org`، `www.hn-groupe.org`، و `http://192.168.100.6:3005` (local_node).

### الخادم

- `src/lib/publish-sync.functions.ts` (محمي بـ `requireSupabaseAuth`):
  - `listPublishTargets` — الوجهات + آخر عمليات النشر.
  - `upsertPublishTarget` / `setCanonicalTarget` / `toggleTarget`.
  - `runPublish({ targetId })` — لوجهة نطاق: فحص صحّة عبر `health_url` وتسجيل النتيجة؛ لوجهة `local_node`: إدراج أمر في `server_commands` بنوع `site_publish` (سحب/رفع الحزمة، بناء، `systemctl restart`, فتح المنفذ 3005) وربط `publish_runs.command_id` به.
  - `publishAll` — تشغيل متسلسل لكل الوجهات النشطة.
- `src/routes/api/public/publish/status.ts` — `GET` عام يعيد الحالة الموحّدة (النطاق الرسمي، الإصدار، آخر مزامنة) بأعمدة آمنة فقط + CORS، تستهلكه العقدة المحلية والنطاقات المرآة.
- إضافة أمر `site_publish` إلى قائمة الأوامر المسموحة في `src/lib/server-commands.ts` وتنفيذه في `src/lib/agent-script.ts` (رفع إصدار الوكيل)، مع تقرير المخرجات إلى `publish_runs` عبر قناة النتائج الحالية.

### الواجهة والـ SEO

- `src/routes/_authenticated/publish-sync.tsx`: الجدول + أزرار النشر + سجل العمليات (مكوّنات shadcn وتوكنات التصميم فقط)، مع `head()` خاص.
- عنصر جديد في `AppSidebar.tsx` ضمن قسم الإدارة + مفاتيح ترجمة `ar/fr/en`.
- في `src/routes/__root.tsx` والصفحات العامة: وسم `<link rel="canonical">` يشير دائماً إلى النطاق الرسمي، و`og:url` موحّد، حتى لا تتنافس النطاقات الثلاثة في الفهرسة.

### ملاحظات

- العقدة المحلية داخل شبكة خاصة؛ التنفيذ يتم عبر الوكيل المثبّت على السيرفر (وليس اتصالاً مباشراً من السحابة)، وهذا يعمل مع البنية الحالية للأوامر.
- النطاقات الثلاثة تستخدم نفس قاعدة البيانات أصلاً، فالتوحيد هنا يضمن نفس الإصدار ونفس نقطة القراءة ونفس الهوية الرسمية.
