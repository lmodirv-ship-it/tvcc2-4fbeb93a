# خطة Phase 1 — TVCC: Change Once, Apply Everywhere

الهدف: تقليل التكرار عبر 50+ موقعاً. كل ميزة هنا تجتاز اختبار "هل تقلل التكرار؟".

## 1) قاعدة البيانات (Migration واحدة)

أربعة جداول جديدة + RLS + GRANTs:

- **site_groups** — `name, color, icon, description, owner_id`
- **website_group_members** — ربط `website_id` بـ `group_id` (many-to-many)
- **site_templates** — `name, template_type, default_settings (jsonb), owner_id`
- **website_template_links** — ربط `website_id` بـ `template_id`
- **site_health_checks** — `website_id, status, response_time_ms, http_status, ssl_valid, checked_at`
- **deployment_jobs** — `title, scope_type (site|group|template|all), scope_id, action_type, status (queued|running|success|failed), target_count, success_count, error_count, payload jsonb, started_at, completed_at`
- **deployment_job_targets** — `job_id, website_id, status, error_message`

كل جدول: RLS مفعّل + سياسة `owner_id = auth.uid()` + GRANTs لـ authenticated و service_role.

## 2) الواجهات الجديدة

```text
/groups          → قائمة المجموعات (إنشاء/تعديل/لون/أيقونة + ربط المواقع)
/templates       → قائمة القوالب (Store/News/Business) + محرر default_settings
/templates/$id   → تفاصيل قالب + المواقع المرتبطة + زر "تطبيق على الكل"
/monitoring      → شبكة بطاقات لكل موقع: Online/DB/Storage/SSL + ملخص علوي
/deployments     → سجل المهام مع progress bar وحالة كل موقع
```

تحديث Sidebar لإضافة هذه الأقسام الأربعة قبل "Editor".

## 3) منطق "Change Once" (Scope Selector)

في Editor وعند أي تعديل إعدادات: مُحدِّد نطاق:
- موقع واحد (الحالي)
- مجموعة (يطبّق على كل أعضائها)
- قالب (يطبّق على كل المواقع المرتبطة)
- الكل

عند الضغط "تطبيق" → ينشئ **Deployment Job** بدل التحديث المباشر:
- Job يظهر فوراً في `/deployments`
- ينفّذ خطوة بخطوة عبر `deployment_job_targets`
- كل موقع له حالة مستقلة (success/failed + رسالة الخطأ)
- قابل لإعادة المحاولة على الفاشل فقط

## 4) Monitoring (المرحلة الأولى: بيانات + UI)

- جدول `site_health_checks` جاهز
- صفحة `/monitoring`: تقرأ آخر فحص لكل موقع وتعرض ملخص (Online/Offline/Warning)
- زر "فحص الآن" يدوي يستدعي server function تجريبية (HEAD request للدومين)
- **لاحقاً Phase 1.5**: pg_cron كل 5 دقائق يستدعي `/api/public/hooks/health-check`

## 5) التنفيذ على دفعتين

**الدفعة A (هذه الجلسة):**
- Migration كاملة (الجداول السبعة + RLS + GRANTs)
- `/groups` صفحة كاملة CRUD + ربط المواقع
- `/templates` صفحة كاملة CRUD + محرر JSON للإعدادات الافتراضية + ربط المواقع
- تحديث Sidebar

**الدفعة B (بعد موافقتك على A):**
- `/monitoring` + server function للفحص اليدوي
- `/deployments` + منطق Job runner
- تكامل Editor مع Scope Selector

## تفاصيل تقنية

- كل الاستعلامات عبر `createServerFn` + `requireSupabaseAuth` (RLS تطبّق كالمستخدم)
- لا Edge Functions — كل المنطق داخل TanStack Start
- Job runner: server function تشتغل عند إنشاء Job، تمر على المواقع، تحدّث `deployment_job_targets`
- محرر default_settings: مبدئياً Monaco/textarea JSON، لاحقاً Form builder حسب template_type

## خارج النطاق الآن (يأتي لاحقاً)
- Command Center (`/command`) — Phase 1.5
- Client Portal / Billing / AI Assistant — Phase 2-4
- pg_cron الحقيقي للـ health checks — Phase 1.5

---

**هل أبدأ بالدفعة A؟** اضغط "Implement plan" للموافقة.
