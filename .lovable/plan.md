# إضافة نطاقات رسمية للمنصة

إنشاء جدول `public.official_domains` وتسجيل النطاقات الرسمية الثلاثة للمنصة.

## النطاقات

- `tvcc.hnpay.live` — النطاق الأساسي (primary)
- `hn-groupe.org` — نطاق رسمي بديل
- `www.hn-groupe.org` — نسخة www

## التنفيذ

1. **Migration**: إنشاء `public.official_domains` بأعمدة: `id`, `domain`, `is_primary`, `is_active`, `purpose`, `public_url`, `created_at`, `updated_at`.
2. **صلاحيات**: GRANT + RLS؛ قراءة عامة للجميع، وكتابة/تعديل/حذف للمدير فقط.
3. **إدخال البيانات**: إضافة النطاقات الثلاثة في نفس الـ migration.
4. **واجهة**: إضافة بطاقة «النطاقات الرسمية» في صفحة الإعدادات `/settings` تعرض الجدول وتسمح للمدير بتفعيل/تعطيل النطاق.
