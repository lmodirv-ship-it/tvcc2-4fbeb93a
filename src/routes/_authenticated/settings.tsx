import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Save, X, Pencil, Bell, Globe, Shield, Mail, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "الإعدادات — TVCC" }] }),
});

function SettingsPage() {
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Platform settings
  const [platformName, setPlatformName] = useState("TVCC");
  const [language, setLanguage] = useState("ar");
  const [darkMode, setDarkMode] = useState(true);

  // Contact settings
  const [email, setEmail] = useState("admin@tvcc.ma");
  const [phone, setPhone] = useState("+212 5XX-XXXXXX");

  // Notification settings
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [siteDownAlerts, setSiteDownAlerts] = useState(true);
  const [backupAlerts, setBackupAlerts] = useState(false);

  const handleSave = (section: string) => {
    setEditingSection(null);
  };

  const handleCancel = () => {
    setEditingSection(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
          <SettingsIcon className="w-6 h-6 text-white" />
        </span>
        <div>
          <h1 className="text-3xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground text-sm">إعدادات المنصة والشبكة والربط الموحد</p>
        </div>
      </div>

      {/* Platform Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            إعدادات المنصة
          </CardTitle>
          {editingSection !== "platform" && (
            <Button variant="outline" size="sm" onClick={() => setEditingSection("platform")}>
              <Pencil className="w-3.5 h-3.5 ml-1.5" />
              تغيير
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المنصة</Label>
              {editingSection === "platform" ? (
                <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
              ) : (
                <p className="text-muted-foreground">{platformName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>اللغة الافتراضية</Label>
              {editingSection === "platform" ? (
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="ar">العربية</option>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              ) : (
                <p className="text-muted-foreground">{language === "ar" ? "العربية" : language === "fr" ? "Français" : "English"}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">الوضع الداكن</Label>
            {editingSection === "platform" ? (
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            ) : (
              <span className="text-muted-foreground">{darkMode ? "مفعل" : "معطل"}</span>
            )}
          </div>
          {editingSection === "platform" && (
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="w-3.5 h-3.5 ml-1.5" />
                إلغاء
              </Button>
              <Button size="sm" onClick={() => handleSave("platform")}>
                <Save className="w-3.5 h-3.5 ml-1.5" />
                حفظ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <PasswordCard />

      {/* Contact Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            معلومات الاتصال
          </CardTitle>
          {editingSection !== "contact" && (
            <Button variant="outline" size="sm" onClick={() => setEditingSection("contact")}>
              <Pencil className="w-3.5 h-3.5 ml-1.5" />
              تغيير
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              {editingSection === "contact" ? (
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              ) : (
                <p className="text-muted-foreground">{email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              {editingSection === "contact" ? (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              ) : (
                <p className="text-muted-foreground">{phone}</p>
              )}
            </div>
          </div>
          {editingSection === "contact" && (
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="w-3.5 h-3.5 ml-1.5" />
                إلغاء
              </Button>
              <Button size="sm" onClick={() => handleSave("contact")}>
                <Save className="w-3.5 h-3.5 ml-1.5" />
                حفظ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            الإشعارات
          </CardTitle>
          {editingSection !== "notifications" && (
            <Button variant="outline" size="sm" onClick={() => setEditingSection("notifications")}>
              <Pencil className="w-3.5 h-3.5 ml-1.5" />
              تغيير
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">إشعارات البريد</p>
                <p className="text-xs text-muted-foreground">استلام إشعارات على البريد الإلكتروني</p>
              </div>
              {editingSection === "notifications" ? (
                <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
              ) : (
                <span className="text-muted-foreground">{emailAlerts ? "مفعل" : "معطل"}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تنبيه انقطاع المواقع</p>
                <p className="text-xs text-muted-foreground">إشعار فوري عند انقطاع موقع</p>
              </div>
              {editingSection === "notifications" ? (
                <Switch checked={siteDownAlerts} onCheckedChange={setSiteDownAlerts} />
              ) : (
                <span className="text-muted-foreground">{siteDownAlerts ? "مفعل" : "معطل"}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تنبيهات النسخ الاحتياطي</p>
                <p className="text-xs text-muted-foreground">إشعار بنتيجة عمليات النسخ الاحتياطي</p>
              </div>
              {editingSection === "notifications" ? (
                <Switch checked={backupAlerts} onCheckedChange={setBackupAlerts} />
              ) : (
                <span className="text-muted-foreground">{backupAlerts ? "مفعل" : "معطل"}</span>
              )}
            </div>
          </div>
          {editingSection === "notifications" && (
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="w-3.5 h-3.5 ml-1.5" />
                إلغاء
              </Button>
              <Button size="sm" onClick={() => handleSave("notifications")}>
                <Save className="w-3.5 h-3.5 ml-1.5" />
                حفظ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            إعدادات DNS Zone للربط الموحد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            لربط أي موقع بشبكة TVCC، أضف أحد السجلات التالية إلى DNS Zone الخاص بالموقع:
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs space-y-1">
            <div><span className="text-primary">Type:</span> CNAME</div>
            <div><span className="text-primary">Host:</span> _tvcc</div>
            <div><span className="text-primary">Value:</span> network.tvcc.ma</div>
          </div>
          <p className="text-center text-xs text-muted-foreground">— أو —</p>
          <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs space-y-1">
            <div><span className="text-primary">Type:</span> TXT</div>
            <div><span className="text-primary">Host:</span> _tvcc</div>
            <div><span className="text-primary">Value:</span> tvcc-network=enabled</div>
          </div>
          <p className="text-xs text-muted-foreground">
            بمجرد اكتشاف السجل، يصبح الموقع متصلاً تلقائياً بكل خدمات TVCC: قواعد البيانات، التخزين، النسخ الاحتياطي، ونظام المستخدمين الموحد.
          </p>

          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-warning" />
              <h3 className="text-sm font-semibold text-warning">ملاحظة عند نقل الموقع إلى استضافة جديدة</h3>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pr-5">
              <li>عند تغيير الاستضافة، عادةً يتم تحديث سجلات <span className="font-mono text-foreground">A</span> و <span className="font-mono text-foreground">NS</span> فقط — وليس سجل <span className="font-mono text-foreground">_tvcc</span>.</li>
              <li>إذا انتقلت إلى مزود DNS مختلف (Cloudflare، Route53…)، يجب إعادة إضافة سجل <span className="font-mono text-foreground">_tvcc</span> في DNS Zone الجديد بنفس القيم أعلاه.</li>
              <li>بعد التغيير، اضغط زر <span className="text-foreground font-medium">"تحقق"</span> في صفحة المواقع لإعادة التأكد من الاتصال.</li>
              <li>سجل <span className="font-mono text-foreground">_tvcc</span> مستقل عن عنوان IP الخاص بالاستضافة، لذا يبقى صالحاً حتى لو تغير الـ IP.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordCard() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 8) return toast.error("كلمة السر يجب أن تكون 8 أحرف على الأقل");
    if (pw !== confirm) return toast.error("كلمتا السر غير متطابقتين");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    setConfirm("");
    toast.success("تم تغيير كلمة السر");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          كلمة السر
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>كلمة السر الجديدة</Label>
            <Input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>تأكيد كلمة السر</Label>
            <Input type="password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1.5" /> : <Save className="w-3.5 h-3.5 ml-1.5" />}
            حفظ كلمة السر
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          المالك أو المدير يمكنه تغيير كلمة سر أي عضو من صفحة «المستخدمون والفريق».
        </p>
      </CardContent>
    </Card>
  );
}
