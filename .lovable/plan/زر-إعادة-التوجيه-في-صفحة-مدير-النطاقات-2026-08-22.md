# زر «إعادة التوجيه» في صفحة مدير النطاقات

إضافة زر أخضر «إعادة التوجيه» أعلى صفحة `/domains`. عند الضغط عليه تُفتح بطاقة فيها خانتان:

- **من**: نطاق أو منفذ (مثال: `old.example.com` أو `8080`)
- **إلى**: نطاق أو منفذ (مثال: `new.example.com` أو `3000`)

مع اختيار السيرفر الذي سيُنفَّذ عليه التوجيه، وزر «معاينة» (Dry Run) ثم «تنفيذ».

## المنطق حسب نوع الخانتين

| من | إلى | ما ينفَّذ |
|---|---|---|
| نطاق | نطاق | بلوك Nginx بإعادة توجيه دائمة 301 من الأول إلى الثاني (مع الحفاظ على المسار) |
| نطاق | منفذ | بلوك Nginx reverse proxy للنطاق نحو `127.0.0.1:<port>` (يعيد استخدام `buildProxyConf` الموجود) |
| منفذ | منفذ | جسر TCP عبر أمر الوكيل `port_forward` (socat) الموجود أصلاً |
| منفذ | نطاق | جسر عبر بروكسي: يُطلب تحديد نطاق مصدر — أو يُرفض مع رسالة توضيحية |

الاكتشاف تلقائي: إذا كانت القيمة أرقاماً فقط (1‑65535) تُعامل كمنفذ، وإلا كنطاق (مع التحقق من صيغة النطاق).

## الواجهة

- زر «إعادة التوجيه» بجانب زر «إضافة دومين» في `src/routes/_authenticated/domains.tsx`.
- بطاقة تحتوي: خانة «من»، خانة «إلى»، قائمة السيرفرات، شارة تُظهر نوع العملية المكتشَف، زر معاينة يعرض محتوى ملف Nginx أو الأمر قبل التنفيذ، وزر تنفيذ.
- جدول أسفل الصفحة بكل عمليات التوجيه المسجّلة: من ← إلى، النوع، السيرفر، الحالة، تاريخ الإنشاء، زر فحص، وزر حذف (يزيل ملف Nginx أو وحدة socat).

## تفاصيل تقنية

- جدول جديد `public.domain_redirects`: `id, owner_id, server_id, source (text), source_kind (domain|port), target (text), target_kind, mode (redirect_301|proxy|tcp_bridge), status, last_checked_at, created_at` — مع RLS مقيّدة بـ `can_manage(owner_id)` و GRANTs للأدوار `authenticated` و`service_role`.
- ملف جديد `src/lib/redirects.server.ts`: مولّد بلوك 301، وإعادة استخدام `buildProxyConf` / `proxyConfPath` / `isSafeDomain` من `mesh.server.ts`، وتصنيف الإدخال (منفذ أم نطاق).
- ملف جديد `src/lib/redirects.functions.ts`: `listRedirects` و`saveRedirect` (مع `dryRun`) و`checkRedirect` و`deleteRedirect` — كلها `createServerFn` مع `requireSupabaseAuth`، وتُجدول أوامر الوكيل الموجودة فقط: `write_config` + `nginx_test` + `nginx_reload` للنطاقات، و`port_forward` للمنافذ، و`port_check` للفحص. لا حاجة لأوامر جديدة في الوكيل.
- كل عملية تُسجَّل في `operation_log` كبقية عمليات السيرفر.
