## خطة إصلاح TVCC (بناءً على تقرير الفحص)

سأعالج المشاكل المرصودة في TVCC حسب الأولوية، لرفع الجاهزية من 58% إلى ما يقارب 90%.

---

### المرحلة 1 — إصلاحات حرجة (Blockers)

**1. حل تعارض حزم npm (Nitro × Lovable config)**
- تثبيت `@lovable.dev/vite-tanstack-config` على نسخة محددة (`2.1.1` بدون `^`) متوافقة مع `nitro 3.0.260429-beta` الحالي.
- إعادة توليد `package-lock.json` نظيف ومتسق مع `bun.lock`.
- اعتماد Bun كمدير حزم رسمي (موجود `bun.lock`) وحذف التعارض.

**2. إصلاح جدول `ssl_certificates` المفقود**
- إنشاء migration ينشئ الجدول `public.ssl_certificates` مع:
  - الحقول: domain, issuer, valid_from, valid_to, status, auto_renew, website_id
  - GRANT للـ authenticated/service_role
  - RLS scoped to `owner_id = auth.uid()`
- تحديث `src/integrations/supabase/types.ts` بعد التطبيق.
- إزالة أي `as any` من صفحة `/ssl`.

**3. تأمين `.env`**
- إضافة `.env` و `.env.local` و `.env.*.local` إلى `.gitignore`.
- التحقق ألا يحتوي `.env` على قيم حقيقية مسربة.

**4. إضافة سكربت إنتاج موحد**
في `package.json`:
```json
"start": "node .output/server/index.mjs",
"typecheck": "tsc --noEmit"
```

**5. تنظيف الحزمة المصدرية**
- حذف `.tanstack/`, `.wrangler/`, `tsconfig.tsbuildinfo` من الأرشيف وإضافتها إلى `.gitignore`.

---

### المرحلة 2 — إصلاحات بنيوية

**6. توحيد اسم المشروع**
- تغيير `name` في `package.json` من `tanstack_start_ts` إلى `tvcc`.

**7. ضبط `tsconfig.json`**
- إضافة `"node"` إلى `types`: `["vite/client", "node"]` للسماح بـ `process.env`, `Buffer`, `crypto`.

**8. ضبط Nitro preset للـ VPS**
- التأكد من أن `vite.config.ts` يستخدم `node-server` preset لا Cloudflare، لتشغيل صحيح على VPS بـ Node 20 + PM2.

**9. تأمين endpoint الإشعارات**
- التحقق من أن `/api/public/notifications/ingest` يستخدم `timingSafeEqual` ويرفض الطلبات بدون توقيع.
- توثيق صيغة HMAC الموحدة (`sha256=<hex>`).

---

### المرحلة 3 — استبدال المحاكاة

**10. صفحة `/monitoring`**
- استبدال `Math.random()` بـ health checks حقيقية تُكتب في جدول `site_health_checks`.

**11. التكاملات غير المستخدمة**
- إزالة المتغيرات غير المستخدمة من `.env.example` (LOVABLE_WORKSPACE_*, HN_*_API_TOKEN إن لم تُستخدم) أو وضعها تحت قسم `# Future integrations` بوضوح.

**12. مراجعة auth guard**
- التأكد أن `_authenticated` يستخدم layout server-gated وليس فقط client-side redirect.

---

### المرحلة 4 — تسليم نهائي

**13. ملف PM2 ecosystem**
- إنشاء `ecosystem.config.cjs` جاهز للنشر:
```js
module.exports = { apps: [{ name: 'tvcc', script: '.output/server/index.mjs', env: { NODE_ENV: 'production', PORT: 3000 }}]}
```

**14. تحديث التوثيق**
- `INSTALLATION.md`: توضيح Bun كمدير حزم رسمي.
- `DEPLOYMENT.md`: تأكيد مسار `.output/server/index.mjs` وأمر PM2 مع ecosystem.
- `FINAL_REPORT.md`: تحديث قائمة الإصلاحات المنجزة وحالة الجاهزية الجديدة.

**15. إعادة توليد `tvcc.zip` نظيف**
- مع استبعاد `node_modules`, `.output`, `.env`, `.tanstack`, `.wrangler`, `tsconfig.tsbuildinfo`, `.git`.

---

### تقنياً — ترتيب التنفيذ

1. migration لـ `ssl_certificates` (يجب الموافقة عليها أولاً، فبعدها يتحدث types.ts).
2. إصلاحات الحزم + `.gitignore` + `package.json` + `tsconfig.json` بشكل متوازٍ.
3. إصلاحات الكود (monitoring, ssl page, auth guard, ingest endpoint).
4. ملفات النشر (ecosystem, توثيق).
5. ZIP نهائي.

### النتيجة المتوقعة
- جاهزية TVCC ترتفع من 58% إلى ~88-92%.
- `bun install && bun run build && bun run start` يعمل بدون أخطاء.
- لا جداول مفقودة، لا محاكاة في monitoring، لا أسرار مكشوفة.
- ZIP جاهز للرفع على VPS مع PM2 + Nginx + SSL.

بعد TVCC ننتقل إلى HN-Cloud ثم HN-DB بنفس المنهجية.
