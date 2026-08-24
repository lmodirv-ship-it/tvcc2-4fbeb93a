import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Download, ExternalLink, Loader2, CheckCircle2, XCircle, Smartphone, MonitorDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app-link")({
  component: AppLinkPage,
  head: () => ({
    meta: [
      { title: "ربط التطبيق بنطاقك — TVCC" },
      { name: "description", content: "اربط تطبيق TVCC (سطح المكتب أو PWA) بأي اسم نطاق تضيفه، ليفتح واجهة منصتك مباشرة على ذلك النطاق." },
      { property: "og:title", content: "ربط التطبيق بنطاقك — TVCC" },
      { property: "og:description", content: "اختر النطاق الذي يفتحه تطبيق TVCC على الحاسوب أو الهاتف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KEY = "tvcc_app_domain";
const DEFAULT_URL = "https://tvcc.hnpay.live";

function normalize(v: string) {
  const raw = String(v || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function AppLinkPage() {
  const [value, setValue] = useState(DEFAULT_URL);
  const [saved, setSaved] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(KEY);
    if (s) { setSaved(s); setValue(s); }
  }, []);

  const url = normalize(value);

  const check = async () => {
    setChecking(true); setReachable(null);
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      setReachable(true);
    } catch { setReachable(false); }
    finally { setChecking(false); }
  };

  const save = () => {
    if (!url) return;
    localStorage.setItem(KEY, url);
    setSaved(url);
    toast.success("تم ربط التطبيق بالنطاق");
  };

  const downloadConfig = () => {
    const blob = new Blob([JSON.stringify({ url, savedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tvcc-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6" dir="rtl">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Link2 className="w-7 h-7 text-primary" /> ربط التطبيق باسم نطاق
        </h1>
        <p className="text-muted-foreground">
          حدّد النطاق الذي يفتحه تطبيق TVCC (نسخة ويندوز أو PWA). النطاق الحالي المعتمد:{" "}
          <span dir="ltr" className="font-mono">{DEFAULT_URL}</span>
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>عنوان النطاق</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>النطاق أو الرابط</Label>
            <Input dir="ltr" className="font-mono" value={value} onChange={(e) => { setValue(e.target.value); setReachable(null); }} placeholder="tvcc.hnpay.live أو nawat.hn" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={check} disabled={!url || checking}>
              {checking ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null} فحص الاتصال
            </Button>
            <Button onClick={save} disabled={!url}>ربط وحفظ</Button>
            <Button variant="outline" onClick={downloadConfig} disabled={!url}>
              <Download className="w-4 h-4 ml-1" /> تنزيل ملف الإعداد
            </Button>
            <Button variant="secondary" asChild disabled={!url}>
              <a href={url || DEFAULT_URL} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 ml-1" /> فتح</a>
            </Button>
          </div>
          {reachable !== null && (
            <div className={`flex items-center gap-2 text-sm ${reachable ? "text-primary" : "text-destructive"}`}>
              {reachable ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {reachable ? "النطاق يستجيب" : "تعذّر الوصول إلى النطاق"}
            </div>
          )}
          {saved && (
            <div className="text-sm text-muted-foreground">
              مرتبط حالياً بـ <Badge variant="secondary" className="font-mono" dir="ltr">{saved}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MonitorDown className="w-5 h-5 text-primary" /> نسخة ويندوز (.exe)</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>عند أول تشغيل يسألك التطبيق عن النطاق، أو ضع الرابط في ملف الإعداد المُنزَّل بجانب البرنامج.</p>
            <p>حجم النسخة أقل من 10 ميغابايت لأنها تستعمل متصفح ويندوز المدمج (WebView2).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Smartphone className="w-5 h-5 text-primary" /> نسخة PWA</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>افتح المنصة في المتصفح ثم «إضافة إلى الشاشة الرئيسية» / «تثبيت التطبيق».</p>
            <p>الحجم أقل من 5 ميغابايت وتعمل بأيقونة مستقلة وبدون شريط المتصفح.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
