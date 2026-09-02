# TVCC — سجل المراحل والحالة الحالية

آخر تحديث: 2 سبتمبر 2026
النطاق الرسمي: https://tvcc.hnpay.live · معاينة: `*.lovable.app`
التقنية: TanStack Start v1 + React 19 + Tailwind v4 + Lovable Cloud (Supabase)

---

## 0. حساب مدير المنصة الدائم (غير قابل للحذف أو التغيير)

| البند | القيمة |
|---|---|
| البريد | `lmodirv@gmail.com` |
| كلمة المرور | (محفوظة لدى المالك) |
| الصلاحيات | `admin` + `system_owner` |
| الحماية | مثبَّتة في قاعدة البيانات |

كيف ثُبِّتت الحماية:
- `public.is_permanent_owner_email()` تعرّف البريد كمالك دائم.
- `handle_new_user()` تمنح هذا الحساب `admin` + `system_owner` تلقائياً عند أول تسجيل دخول، وتنسب إليه كل المواقع غير المملوكة، وتنشئ مجموعة HN-DB.
- `trg_protect_permanent_owner_roles` يمنع أي حذف أو تعديل لصلاحياته (يرفع خطأ صريح).
- `trg_protect_permanent_owner_profile` يمنع حذف ملفه الشخصي.
- أي مستخدم جديد آخر يحصل على `viewer` فقط — لا صلاحيات إدارية تلقائية.

> ملاحظة تشغيلية: الحساب لم يُسجَّل بعد في نظام الدخول. أول تسجيل بهذا البريد وكلمة المرور من صفحة `/auth` سيُفعّل الصلاحيات تلقائياً ويربط المواقع الـ188.

---

## 1. المراحل المنجزة (بالترتيب الزمني)

| # | المرحلة | ما تم | الحالة |
|---|---|---|---|
| 1 | التأسيس | هيكل TanStack Start، الثيم Neon Enterprise، 3 لغات (عربي RTL افتراضي/فرنسي/إنجليزي) | ✅ |
| 2 | القاعدة والمصادقة | 57 جدولاً في Lovable Cloud مع RLS على `owner_id`، دخول بالبريد + Google | ✅ |
| 3 | إدارة المواقع | `/websites` CRUD كامل، `/groups`, `/templates`, `/clients`, `/subscriptions` | ✅ |
| 4 | المحرر الجماعي | 14 تبويباً تحت `/editor` (عام، تصميم، محتوى، SEO، أمان، سكربتات، DNS، مستخدمون، اشتراكات، ذكاء اصطناعي…) | ✅ واجهة + حفظ |
| 5 | المراقبة والوظائف | `/monitoring` بفحوصات HTTP حقيقية، `/jobs`, `/activity`, `/reports`, `/audit` | ✅ |
| 6 | الإشعارات | مركز إشعارات + تفضيلات + `POST /api/public/notifications/ingest` موقّع بـ HMAC | ✅ |
| 7 | النطاقات وSSL | `/domains`, `/ssl` مع جدول `ssl_certificates` | ⚠️ التحقق الفعلي من DNS ناقص |
| 8 | استيراد المواقع | 188 موقعاً مُدرجة في القاعدة (HN-DB + مواقعي) | ✅ |
| 9 | النشر | نشر على `tvcc.hnpay.live` + فحص صحة السحابة | ✅ |
| 10 | MCP | خادم MCP مع OAuth 2.1 وصفحة موافقة عربية و11 أداة | ✅ |
| 11 | HN.RLS | إصدار شهادة وتسجيل مشروع بعد التحقق من الملكية + `/certificates` | ⚠️ مربوط بالتحقق الناقص |
| 12 | إدارة السيرفرات | `servers`, heartbeat موقّع، مقاييس، أوامر، منافذ، وكيل shell | ✅ (2 سيرفر مسجّل) |
| 13 | العمليات المتقدمة | Dry Run، جدولة نسخ احتياطي، تنبيهات صحة، خزنة أسرار AES-256-GCM، إجراءات جماعية | ✅ |
| 14 | الذكاء الاصطناعي | مزوّدون + نماذج + محادثات + توجيه + `/ai-connect`, `/ai-models`, `/ai-tests`, `/ai-chat` | ⚠️ النماذج لا تردّ |
| 15 | النسخ الجانبية | ZIP محلي كامل مع القاعدة، دليل Android Studio، تطبيق سطح مكتب Tauri خفيف | ✅ |
| 16 | التقوية الأمنية | إلغاء منح admin التلقائي، حصر الصلاحيات، تثبيت المالك الدائم | ✅ |
| 17 | مزامنة Lovable | استيراد 50 مشروع/موقع من مساحات Lovable مع رموز IDXXXXX وربطها بـ TVCC وHN Service Hub | ✅ |

---

## 2. سجل البيانات الحالية (لقطة اليوم)

| الجدول | عدد السجلات |
|---|---|
| websites | 188 |
| website_group_members | 26 |
| operation_log | 20 |
| server_commands | 17 |
| site_health_checks | 8 |
| ai_models | 7 |
| databases | 4 |
| activity_log | 3 |
| servers / user_roles / ai_conversations / ai_messages | 2 لكل منها |
| site_groups / ai_providers / profiles / server_metrics / website_settings | 1 لكل منها |
| باقي الجداول (40 جدولاً) | فارغة — جاهزة للاستخدام |

المجموع: 57 جدولاً، كلها مع RLS مفعّل و GRANTs صحيحة.

---

## 3. المشاكل المعروفة (مسجّلة للمعالجة)

1. **نماذج الذكاء الاصطناعي لا تردّ** — كل النماذج مسجّلة على `http://127.0.0.1:11434`، والخادم السحابي لا يستطيع الوصول لعنوان داخل شبكتك. الحل: تشغيل النماذج المحلية من المتصفح (الملف `src/lib/ai-local.ts` جاهز) + تفعيل مزوّد Lovable AI السحابي كبديل يعمل دائماً.
2. **ربط DNS لا يُنفَّذ فعلياً** — `editor/dns` و`/websites` يحفظان القيم فقط. الحل: فحص DoH حقيقي + تحقق ملكية.
3. **أزرار «تحفظ فقط»** — عدد من الصفحات يحفظ الإعداد دون تنفيذ عملي.
4. **لا توجد حاويات تخزين** (0 buckets) — تُنشأ عند الحاجة (`avatars`, `site-assets`).

---

## 4. نقاط النهاية العامة الفعّالة

- `POST /api/public/notifications/ingest` (HMAC)
- `POST /api/public/servers.heartbeat` · `GET /api/public/servers.agent`
- `POST /api/public/core.ingest` · `POST /api/public/payments.ingest` · `POST /api/public/video.ingest`
- `POST /api/public/hn-rls.verify`
- `GET /api/public/site-config`
- `POST /api/public/backups/run-due` · `POST /api/public/servers/check-alerts` (للجدولة)
- `GET /.mcp/list-tools` · `POST /.mcp/invoke-tool/$tool`
