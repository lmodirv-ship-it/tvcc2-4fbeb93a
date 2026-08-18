# نسخة الحاسوب الخفيفة — TVCC Desktop

تطبيق سطح مكتب خفيف جداً (Tauri) يفتح منصة TVCC في نافذة مستقلة بحجم تقريبي **5–10 MB** فقط
(مقابل ~120 MB لو استُخدم Electron)، لأنه يستعمل متصفح النظام المدمج بدل تضمين Chromium.

---

## المتطلبات

| الأداة | ملاحظات |
|---|---|
| Node.js 20+ أو Bun | لتشغيل أوامر Tauri CLI |
| Rust (rustup) | `curl https://sh.rustup.rs -sSf \| sh` — على ويندوز حمّل `rustup-init.exe` |
| ويندوز | Microsoft Visual Studio C++ Build Tools + WebView2 |
| لينكس | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev` |
| ماك | Xcode Command Line Tools |

---

## التشغيل

```bash
cd desktop-app
bun install          # أو npm install
bun run dev          # يفتح نافذة TVCC
```

## البناء (ملف تنفيذي)

```bash
bun run build
```

الناتج:

| النظام | المسار |
|---|---|
| Windows | `src-tauri/target/release/bundle/nsis/TVCC_1.0.0_x64-setup.exe` |
| macOS | `src-tauri/target/release/bundle/dmg/TVCC_1.0.0_x64.dmg` |
| Linux | `src-tauri/target/release/bundle/appimage/TVCC_1.0.0_amd64.AppImage` |

---

## تغيير الرابط

التطبيق يفتح `https://tvcc.hnpay.live` افتراضياً.

- **مؤقتاً:** شغّل بمتغير بيئة
  ```bash
  TVCC_URL=http://192.168.1.20:5173 bun run dev
  ```
- **بشكل دائم:** عدّل `APP_URL` في `desktop-app/src-tauri/src/main.rs`.

للشبكة المحلية شغّل المنصة أولاً بـ:
```bash
bun dev --host 0.0.0.0
```

---

## الأيقونة

ضع شعار PNG بحجم 1024×1024 ثم:
```bash
bunx @tauri-apps/cli icon ./logo.png
```
يولّد تلقائياً كل الأحجام داخل `src-tauri/icons/`.

---

## حل المشاكل

| المشكلة | الحل |
|---|---|
| نافذة بيضاء | تأكد أن الرابط يفتح في المتصفح العادي أولاً |
| `linker cc not found` (لينكس) | ثبّت `build-essential` |
| WebView2 مفقود (ويندوز 10 قديم) | حمّل WebView2 Runtime من مايكروسوفت |
| تسجيل دخول Google لا يعمل | أضف رابط المنصة في إعدادات المصادقة بالخلفية |
| بناء بطيء أول مرة | طبيعي — Rust يبني التبعيات مرة واحدة فقط |
