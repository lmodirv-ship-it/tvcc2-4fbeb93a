# تجهيز أرضية نظام معرّف المجموعة (HN Group ID) في TVCC

الخطة التي أرسلتها تُنفَّذ في **HN Service Hub**. دور TVCC هنا هو **مركز المجموعة ومالك اللائحة**: يستقبل إشارات الهويات، يخزّنها، ويعرضها في لوحة التحكم.

## ما سيراه المستخدم

1. صفحة جديدة **هويات المجموعة** في لوحة التحكم (`/group-ids`):
   - جدول: الرمز (`H000001`)، اسم الخدمة، رقم الخدمة، الموقع/الرابط، الحالة، آخر إشارة، مصدر الإشارة.
   - بحث وفلترة حسب الحالة، وسجل الإشارات لكل هوية.
   - بطاقة إعدادات تعرض عنوان نقطة الاستقبال في TVCC ومفتاح التوقيع مع زر توليد ونسخ.
2. عند ضغط زر "اتصال" في أي موقع، تصل الإشارة إلى TVCC وتظهر الهوية فورًا في الجدول بحالة "متصل".
3. إذا وصلت هوية غير معروفة، تُسجَّل تلقائيًا كسجل جديد (اكتشاف تلقائي) بحالة "مُكتشفة".

## التفاصيل التقنية

### قاعدة البيانات (migration جديدة)

- `public.hn_group_identities`: `id`, `code` (unique, `^[A-Z][0-9]{6}$`), `service_number` int,
  `service_name`, `site_url`, `origin`, `status` (`discovered|connected|revoked`),
  `first_seen_at`, `last_signal_at`, `signal_count`, `hub_source`, `metadata` jsonb,
  `created_at`, `updated_at`.
- `public.hn_group_identity_signals`: `id`, `identity_id` FK → hn_group_identities,
  `code`, `origin`, `ip_hash`, `user_agent`, `signature_valid` bool, `payload` jsonb, `created_at`.
- GRANT: `SELECT` لـ `authenticated`، `ALL` لـ `service_role`، لا شيء لـ `anon`.
- RLS مفعّل: قراءة للمستخدمين المسجّلين، كتابة/تعديل للأدمن فقط عبر `has_role(auth.uid(),'admin')`.
  الكتابة من نقطة الاستقبال تتم بـ service role.

### نقطة الاستقبال العامة

`src/routes/api/public/hn/announce.ts` — `POST` + `OPTIONS` (CORS):
- يستقبل `{ code, service_name, service_number, site_url, origin, hub }`.
- يتحقق من صيغة الرمز، ومن توقيع HMAC في ترويسة `x-hn-signature` بمفتاح `HN_HUB_VERIFICATION_SALT`
  (مقارنة زمنية آمنة). التوقيع غير صالح ⇒ تُسجَّل الإشارة مع `signature_valid=false` وتُرفض بحالة 401.
- حد معدل: إشارة واحدة لكل رمز كل 10 ثوانٍ.
- upsert للهوية، تحديث `status='connected'` و`last_signal_at` و`signal_count`، وإدراج سجل الإشارة.
- الرد: `{ ok: true, code, status, tvcc: "acknowledged" }` — هذا ما تنتظره خطة الـ Hub.

`src/routes/api/public/hn/identity.$code.ts` — `GET` عام للتحقق: يعيد الرمز واسم الخدمة والموقع والحالة فقط.

### الخادم والواجهة

- `src/lib/group-identity.functions.ts`: `listGroupIdentities`, `listIdentitySignals`,
  `revokeIdentity`, `setIdentityStatus` — كلها محمية بـ `requireSupabaseAuth` وتتحقق من دور admin للكتابة.
- `src/routes/_authenticated/group-ids.tsx`: الجدول + التفاصيل + سجل الإشارات، بمكوّنات shadcn الحالية
  وتوكنات التصميم فقط (بدون ألوان مباشرة)، مع `head()` خاص بالصفحة.
- إضافة العنصر في `src/components/layout/AppSidebar.tsx` ضمن قسم الإدارة، مع مفاتيح ترجمة في `ar/fr/en`.

### ملاحظات

- المفتاح `HN_HUB_VERIFICATION_SALT` يُضاف كسر للمشروع؛ إن لم يكن مضبوطًا تُقبل الإشارات وتُسجَّل
  بحالة `signature_valid=false` مع تنبيه في الواجهة.
- العنوان الذي يضعه الـ Hub في `TVCC_API_URL` هو `https://tvcc.hnpay.live`.
