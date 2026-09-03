# دليل التشغيل الشامل — TVCC

أربعة مسارات: **محلياً** · **على سيرفر VPS** · **نسخة الحاسوب (Desktop)** · **APK حقيقي عبر Android Studio**.

---

## 1) التشغيل المحلي (على حاسوبك)

### المتطلبات
- Node.js 20+ و **Bun** (`curl -fsSL https://bun.sh/install | bash`)
- Git

### الخطوات
```bash
git clone <رابط-المستودع> tvcc && cd tvcc
bun install
cp .env.example .env      # ثم عبّئ القيم
bun dev                   # http://localhost:8080
```

### متغيرات البيئة الأساسية (`.env`)
```
VITE_SUPABASE_URL=https://<مشروعك>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_PROJECT_ID=<project-id>
# أسرار الخادم فقط (بدون VITE_)
SUPABASE_SERVICE_ROLE_KEY=...
VAULT_FALLBACK_KEY=<مفتاح عشوائي 32 حرفاً>
HN_HUB_VERIFICATION_SALT=<سر عشوائي>
```

### قاعدة بيانات محلية (اختياري)
لتشغيل Supabase محلياً على `http://192.168.100.66:8000`:
```bash
supabase start                     # أو تشغيل حاويات self-hosted
supabase db push                   # يطبّق كل ملفات supabase/migrations
```
كل الجداول (127 جدولاً) تُعاد بناؤها من ملفات الترحيل الموجودة في `supabase/migrations/`.

### التحقق
```bash
bun run typecheck && bun run build && bun run start
```

---

## 2) التشغيل على سيرفر VPS (أوبنتو 22/24)

### تجهيز الخادم
```bash
sudo apt update && sudo apt install -y curl git nginx ufw
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### نشر المنصة
```bash
sudo mkdir -p /var/www/tvcc && sudo chown -R $USER /var/www/tvcc
cd /var/www/tvcc
git clone <رابط-المستودع> . || unzip ~/tvcc-full-vps.zip -d .
bun install
cp .env.example .env && nano .env     # عبّئ الأسرار
bun run build
```

### خدمة systemd
`/etc/systemd/system/tvcc.service`:
```ini
[Unit]
Description=TVCC Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/tvcc
EnvironmentFile=/var/www/tvcc/.env
ExecStart=/root/.bun/bin/bun run start
Restart=always
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now tvcc
sudo systemctl status tvcc
```

### Nginx + SSL
`/etc/nginx/sites-available/tvcc`:
```nginx
server {
  server_name tvcc.hnpay.live;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/tvcc /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tvcc.hnpay.live
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH && sudo ufw enable
```

### وكيل TVCC Agent (اختياري لإدارة السيرفر من اللوحة)
من صفحة **الخوادم → إضافة خادم** انسخ أمر التثبيت وشغّله على السيرفر؛ الوكيل الحالي **v3.8.0** يرسل نبضات كل 60 ثانية ويدعم التخزين التلقائي والنسخ الاحتياطي والمزامنة.

### التحديث لاحقاً
```bash
cd /var/www/tvcc && git pull && bun install && bun run build && sudo systemctl restart tvcc
```

---

## 3) نسخة الحاسوب (Desktop – Tauri)

نافذة مستقلة خفيفة (~5–10 MB) بدل Electron. التفاصيل الكاملة في `DESKTOP_APP_AR.md`.

### المتطلبات
- Rust: `curl https://sh.rustup.rs -sSf | sh`
- ويندوز: Visual Studio C++ Build Tools + WebView2
- لينكس: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev`
- ماك: Xcode Command Line Tools

### البناء
```bash
cd desktop-app
bun install
bun run tauri dev        # تجربة
bun run tauri build      # إنتاج
```

### الناتج
| النظام | الملف |
|---|---|
| ويندوز | `src-tauri/target/release/bundle/msi/*.msi` و `nsis/*-setup.exe` |
| لينكس | `bundle/deb/*.deb` و `bundle/appimage/*.AppImage` |
| ماك | `bundle/dmg/*.dmg` |

> البناء لكل نظام يتم **على نفس النظام** (ويندوز يُبنى على ويندوز). لبناء `.exe` من غير ويندوز استخدم GitHub Actions مع `windows-latest`.

عنوان المنصة داخل التطبيق يُضبط في `desktop-app/src-tauri/tauri.conf.json` (أو صفحة `/app-link` داخل المنصة لربط أي نطاق).

---

## 4) APK حقيقي عبر Android Studio (Capacitor)

الشرح المفصّل في `ANDROID_STUDIO_AR.md`. الملخص التنفيذي:

### المتطلبات
- Android Studio (Hedgehog+) + Android SDK 34 + JDK 17

### التهيئة (مرة واحدة)
```bash
bun add @capacitor/core @capacitor/android
bun add -d @capacitor/cli
bunx cap init TVCC live.hnpay.tvcc --web-dir=public
```

`capacitor.config.ts`:
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'live.hnpay.tvcc',
  appName: 'TVCC',
  webDir: 'public',
  server: {
    url: 'https://tvcc.hnpay.live',   // المنصة تعمل بـ SSR فيفتح التطبيق النسخة المنشورة
    cleartext: false,
    androidScheme: 'https',
  },
};
export default config;
```

### إضافة منصة أندرويد وفتح المشروع
```bash
bunx cap add android
bunx cap sync android
bunx cap open android      # يفتح Android Studio
```

### بناء APK للتجربة
داخل Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
الناتج: `android/app/build/outputs/apk/debug/app-debug.apk`

أو من الطرفية:
```bash
cd android && ./gradlew assembleDebug
```

### APK موقّع للنشر (إنتاج)
1. إنشاء مفتاح التوقيع:
```bash
keytool -genkey -v -keystore tvcc.keystore -alias tvcc \
  -keyalg RSA -keysize 2048 -validity 10000
```
2. `android/key.properties`:
```
storePassword=<كلمة السر>
keyPassword=<كلمة السر>
keyAlias=tvcc
storeFile=../../tvcc.keystore
```
3. في Android Studio: **Build → Generate Signed Bundle / APK → APK → release**
الناتج: `android/app/build/outputs/apk/release/app-release.apk`
لمتجر Google Play استخدم **Android App Bundle (.aab)** بدل APK.

### تحديث التطبيق بعد أي تغيير في المنصة
لأن التطبيق يفتح نسخة السيرفر، التحديث يظهر مباشرة بعد نشر المنصة — لا يلزم إعادة بناء APK إلا عند تغيير الأيقونة أو الاسم أو الإضافات الأصلية:
```bash
bun run build && bunx cap sync android
```

### الأيقونة والاسم
- الأيقونات: `android/app/src/main/res/mipmap-*/`
- الاسم: `android/app/src/main/res/values/strings.xml`

---

## مشاكل شائعة

| المشكلة | الحل |
|---|---|
| صفحة بيضاء في التطبيق | تأكد أن `server.url` يعمل عبر HTTPS ومن صلاحية الشهادة |
| `502 Bad Gateway` على Nginx | الخدمة متوقفة: `sudo systemctl status tvcc` وتحقق من `PORT=3000` |
| فشل البناء بسبب Rust | `rustup update` ثم أعد `bun run tauri build` |
| Gradle يفشل بسبب JDK | اضبط JDK 17 من: File → Settings → Build Tools → Gradle |
| الجداول ناقصة بعد النشر | `supabase db push` لتطبيق كل ملفات `supabase/migrations` |
