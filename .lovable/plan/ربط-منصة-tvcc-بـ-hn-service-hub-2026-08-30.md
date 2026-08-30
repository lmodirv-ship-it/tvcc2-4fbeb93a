# ربط منصة TVCC بـ HN Service Hub

الموقع الآخر (HN srv) يطلب منك أمرين فقط: **اسم الموقع** و **الرابط الأساسي (Base URL)**.

## الجواب الذي تكتبه هناك الآن

- الاسم: `TVCC`
- Base URL: `https://tvcc.hnpay.live`

## المشكلة الحالية

ملف بناء كتالوج الخدمات موجود في المنصة (`src/lib/hn-service.server.ts`) لكن **نقطة الاتصال العامة (API) لم تُنشأ**، لذلك لو أدخل HN Service Hub الرابط لن يجد أي بيانات ليقرأها.

## ما سأنفذه

1. إنشاء نقطة اتصال عامة: `/api/public/hn-service/catalog`
   - `GET` مع مفتاح `Authorization: Bearer <token>` (أو `?token=`) يُرجع قائمة كل المواقع مع خدماتها وتخصصها.
   - `OPTIONS` + رؤوس CORS حتى يستطيع HN Service Hub القراءة من متصفحه.
   - رفض الطلب بدون مفتاح صحيح (401).
2. توليد مفتاح الوصول من صفحة **التكاملات** بزر «توليد» (Token فقط، الرابط يبقى ثابتًا).
3. عرض بطاقة جاهزة في صفحة التكاملات تحتوي: الاسم، Base URL، رابط الكتالوج الكامل، والمفتاح — مع زر نسخ لكل واحد.

## تفاصيل تقنية

- ملف جديد: `src/routes/api/public/hn-service.catalog.ts` (مسار عام يتجاوز مصادقة الموقع، لذا التحقق من المفتاح يتم داخل المعالج).
- المفتاح يُخزن في جدول `external_integrations` تحت المفتاح `hn-service` ويُقارن بشكل ثابت الزمن.
- الاستجابة: `{ site, base_url, generated_at, services: [{ domain, name, status, specialization, services: [...] }] }`.
