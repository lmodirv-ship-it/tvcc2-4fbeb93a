# دليل إنشاء نسخة الهاتف (Android Studio) — TVCC

هذا الدليل يشرح كيفية تحويل منصة TVCC إلى تطبيق أندرويد باستخدام **Capacitor** وفتحه في **Android Studio**.

---

## المتطلبات

- Node.js 20+ و Bun
- **Android Studio** (Hedgehog أو أحدث) + Android SDK 34
- **JDK 17** (يأتي مدمجاً مع Android Studio)
- المشروع يعمل محلياً بنجاح (`bun dev`)

---

## الطريقة 1 (الموصى بها): تطبيق يتصل بالسيرفر مباشرة

المنصة تعتمد على SSR (TanStack Start)، لذلك أفضل طريقة هي أن يفتح التطبيق نسخة الويب المنشورة.

### الخطوة 1: تثبيت Capacitor

```bash
bun add @capacitor/core @capacitor/android
bun add -d @capacitor/cli
```

### الخطوة 2: التهيئة

```bash
bunx cap init TVCC live.hnpay.tvcc --web-dir=public
```

### الخطوة 3: إنشاء ملف `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'live.hnpay.tvcc',
  appName: 'TVCC',
  webDir: 'public',
  server: {
    // رابط المنصة المنشورة (أو IP جهازك أثناء التطوير)
    url: 'https://tvcc.hnpay.live',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
```

> أثناء التطوير المحلي استبدل الرابط بـ `http://192.168.1.X:5173` (IP حاسوبك في نفس الشبكة) وضع `cleartext: true`.

### الخطوة 4: إضافة منصة أندرويد

```bash
bunx cap add android
bunx cap sync android
```

### الخطوة 5: فتح المشروع في Android Studio

```bash
bunx cap open android
```

ثم من Android Studio:
1. انتظر انتهاء **Gradle Sync**.
2. اختر جهازاً أو محاكياً من الأعلى.
3. اضغط **Run ▶**.

---

## الطريقة 2: تطبيق WebView بسيط (بدون Capacitor)

إذا أردت مشروعاً خفيفاً جداً:

1. Android Studio → **New Project → Empty Views Activity** → اسم `TVCC`، لغة Kotlin.
2. في `app/src/main/res/layout/activity_main.xml`:

```xml
<WebView
    android:id="@+id/webview"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

3. في `MainActivity.kt`:

```kotlin
val web = findViewById<WebView>(R.id.webview)
web.settings.javaScriptEnabled = true
web.settings.domStorageEnabled = true
web.webViewClient = WebViewClient()
web.loadUrl("https://tvcc.hnpay.live")
```

4. في `AndroidManifest.xml` أضف قبل وسم `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## إعدادات مهمة

### تسجيل الدخول عبر Google داخل التطبيق
أضف رابط إعادة التوجيه في إعدادات المصادقة بالخلفية:
- `https://tvcc.hnpay.live/auth/callback`
- `live.hnpay.tvcc://auth/callback` (إذا استخدمت Deep Link)

### أيقونة التطبيق
Android Studio → **Right click على `res` → New → Image Asset** → ارفع شعار TVCC.

---

## بناء ملف APK / AAB

من Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)** ← ملف تجريبي
- **Build → Generate Signed Bundle / APK → Android App Bundle** ← للنشر على Google Play

مكان الملف الناتج:
```
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/bundle/release/app-release.aab
```

### ربطه بالمنصة
ارفع الملف على HN-Cloud، ثم افتح صفحة **APK Manager** في TVCC وأدخل:
- رقم الإصدار (مثال `1.0.0`)
- Version Code (مثال `1`)
- رابط APK / AAB

---

## أوامر سريعة

| المهمة | الأمر |
|---|---|
| مزامنة التغييرات | `bunx cap sync android` |
| فتح Android Studio | `bunx cap open android` |
| تشغيل مباشرة | `bunx cap run android` |
| تنظيف Gradle | `cd android && ./gradlew clean` |

---

## حل المشاكل

| المشكلة | الحل |
|---|---|
| شاشة بيضاء | تحقق من `server.url` وأن الجهاز يصل للرابط |
| `net::ERR_CLEARTEXT_NOT_PERMITTED` | ضع `cleartext: true` مؤقتاً أثناء التطوير المحلي |
| فشل Gradle Sync | Android Studio → File → Invalidate Caches / Restart |
| JDK غير صحيح | Settings → Build Tools → Gradle → Gradle JDK = 17 |
