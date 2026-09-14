import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Settings as SettingsIcon, Save, Bell, Globe, Shield, Mail, KeyRound, Loader2, Database, Users, Layers, UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, type AppRole } from "@/lib/permissions";
import { PagesRegistryTable } from "@/components/settings/PagesRegistryTable";
import {
  getPlatformSettings, savePlatformSettings, getBrandSettings, saveBrandSettings,
} from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "إعدادات المنصة — TVCC" },
      { name: "description", content: "مركز إدارة منصة TVCC: الهوية، الاتصال، الإشعارات، الأدوار، قواعد البيانات، وسجل الصفحات." },
      { property: "og:title", content: "إعدادات المنصة — TVCC" },
      { property: "og:description", content: "إدارة كل صفحات ومكونات منصة TVCC من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SettingsPage() {
  const { can, primaryRoleLabel } = usePermissions();
  const canManage = can("settings.manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
          <SettingsIcon className="w-6 h-6 text-white" />
        </span>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground text-sm">مركز إدارة المنصة — كل شيء يُحفظ في قاعدة البيانات</p>
        </div>
        <Badge variant="outline">{primaryRoleLabel}</Badge>
      </div>

      <Tabs defaultValue="pages" dir="rtl">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="pages"><Layers className="w-3.5 h-3.5 ml-1.5" />الصفحات والوحدات</TabsTrigger>
          <TabsTrigger value="platform"><Globe className="w-3.5 h-3.5 ml-1.5" />المنصة</TabsTrigger>
          <TabsTrigger value="contact"><Mail className="w-3.5 h-3.5 ml-1.5" />الاتصال</TabsTrigger>
          <TabsTrigger value="account"><KeyRound className="w-3.5 h-3.5 ml-1.5" />حسابي</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-3.5 h-3.5 ml-1.5" />الإشعارات</TabsTrigger>
          <TabsTrigger value="roles"><UserCog className="w-3.5 h-3.5 ml-1.5" />الأدوار</TabsTrigger>
          <TabsTrigger value="databases"><Database className="w-3.5 h-3.5 ml-1.5" />قواعد البيانات</TabsTrigger>
          <TabsTrigger value="network"><Shield className="w-3.5 h-3.5 ml-1.5" />الشبكة والربط</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <PagesRegistryTable canEdit={canManage} />
        </TabsContent>

        <TabsContent value="platform" className="mt-4">
          <PlatformTab canEdit={canManage} />
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <ContactTab canEdit={canManage} />
        </TabsContent>

        <TabsContent value="account" className="mt-4 space-y-6">
          <AccountTab />
          <PasswordCard />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>

        <TabsContent value="databases" className="mt-4">
          <DatabasesTab canEdit={canManage} />
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <NetworkTab canEdit={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- المنصة ---------- */
function PlatformTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(getBrandSettings);
  const save = useServerFn(saveBrandSettings);
  const { data } = useQuery({ queryKey: ["brand-settings"], queryFn: () => load() });
  const [form, setForm] = useState<{ name: string; tagline: string; logo_url: string; favicon_url: string }>({
    name: "TVCC", tagline: "", logo_url: "", favicon_url: "",
  });

  useEffect(() => {
    if (data) setForm({
      name: (data as any).name ?? "TVCC",
      tagline: (data as any).tagline ?? "",
      logo_url: (data as any).logo_url ?? "",
      favicon_url: (data as any).favicon_url ?? "",
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => { await save({ data: form }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brand-settings"] }); toast.success("تم حفظ هوية المنصة"); },
    onError: (e: any) => toast.error(e?.message || "تعذر الحفظ"),
  });

  return (
    <SectionCard title="هوية المنصة" icon={Globe} canEdit={canEdit} onSave={() => mutation.mutate()} saving={mutation.isPending}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="اسم المنصة" value={form.name} disabled={!canEdit} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="الشعار النصي" value={form.tagline} disabled={!canEdit} onChange={(v) => setForm({ ...form, tagline: v })} />
        <Field label="رابط الشعار" value={form.logo_url} disabled={!canEdit} onChange={(v) => setForm({ ...form, logo_url: v })} />
        <Field label="رابط الأيقونة" value={form.favicon_url} disabled={!canEdit} onChange={(v) => setForm({ ...form, favicon_url: v })} />
      </div>
    </SectionCard>
  );
}

/* ---------- الاتصال ---------- */
function ContactTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(getPlatformSettings);
  const save = useServerFn(savePlatformSettings);
  const { data } = useQuery({ queryKey: ["platform-settings"], queryFn: () => load() });
  const [form, setForm] = useState({ support_email: "", phone: "", whatsapp: "", address: "", default_language: "ar" });

  useEffect(() => {
    if (data) setForm({
      support_email: data.support_email ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      address: data.address ?? "",
      default_language: data.default_language ?? "ar",
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => { await save({ data: form }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-settings"] }); toast.success("تم حفظ معلومات الاتصال"); },
    onError: (e: any) => toast.error(e?.message || "تعذر الحفظ"),
  });

  return (
    <SectionCard title="معلومات الاتصال" icon={Mail} canEdit={canEdit} onSave={() => mutation.mutate()} saving={mutation.isPending}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="بريد الدعم" value={form.support_email} disabled={!canEdit} onChange={(v) => setForm({ ...form, support_email: v })} />
        <Field label="الهاتف" value={form.phone} disabled={!canEdit} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="واتساب" value={form.whatsapp} disabled={!canEdit} onChange={(v) => setForm({ ...form, whatsapp: v })} />
        <Field label="العنوان" value={form.address} disabled={!canEdit} onChange={(v) => setForm({ ...form, address: v })} />
        <div className="space-y-2">
          <Label>اللغة الافتراضية</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.default_language}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, default_language: e.target.value })}
          >
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    </SectionCard>
  );
}

/* ---------- حسابي ---------- */
function AccountTab() {
  const [prefs, setPrefs] = useState<{ theme: string; language: string; sidebar_collapsed: boolean }>({
    theme: "default", language: "ar", sidebar_collapsed: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await (supabase as any).from("user_preferences").select("*").eq("user_id", auth.user.id).maybeSingle();
      if (data) setPrefs({
        theme: data.theme ?? "default",
        language: data.language ?? "ar",
        sidebar_collapsed: !!data.sidebar_collapsed,
      });
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); return; }
    const { error } = await (supabase as any)
      .from("user_preferences")
      .upsert({ user_id: auth.user.id, ...prefs }, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    localStorage.setItem("tvcc-theme", prefs.theme);
    document.documentElement.setAttribute("data-theme", prefs.theme);
    toast.success("تم حفظ تفضيلاتك");
  };

  return (
    <SectionCard title="تفضيلاتي" icon={SettingsIcon} canEdit onSave={save} saving={busy}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="الثيم" value={prefs.theme} onChange={(v) => setPrefs({ ...prefs, theme: v })} />
        <div className="space-y-2">
          <Label>لغة الواجهة</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={prefs.language}
            onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
          >
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label>طي الشريط الجانبي افتراضياً</Label>
        <Switch checked={prefs.sidebar_collapsed} onCheckedChange={(v) => setPrefs({ ...prefs, sidebar_collapsed: v })} />
      </div>
    </SectionCard>
  );
}

/* ---------- الإشعارات ---------- */
function NotificationsTab() {
  const { data, refetch } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("notification_preferences").select("*").order("event_type");
      return data ?? [];
    },
  });

  const toggle = async (id: string, field: string, value: boolean) => {
    const { error } = await (supabase as any).from("notification_preferences").update({ [field]: value }).eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />تفضيلات الإشعارات</CardTitle>
        <Button asChild variant="outline" size="sm"><Link to="/settings/notifications">القنوات المتقدمة</Link></Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الحدث</TableHead>
              <TableHead>داخل التطبيق</TableHead>
              <TableHead>بريد</TableHead>
              <TableHead>تيليغرام</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.event_type}</TableCell>
                <TableCell><Switch checked={!!p.in_app} onCheckedChange={(v) => toggle(p.id, "in_app", v)} /></TableCell>
                <TableCell><Switch checked={!!p.email} onCheckedChange={(v) => toggle(p.id, "email", v)} /></TableCell>
                <TableCell><Switch checked={!!p.telegram} onCheckedChange={(v) => toggle(p.id, "telegram", v)} /></TableCell>
              </TableRow>
            ))}
            {(!data || data.length === 0) && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">لا توجد تفضيلات محفوظة بعد.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------- الأدوار ---------- */
function RolesTab() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />الأدوار والصلاحيات</CardTitle>
        <Button asChild variant="outline" size="sm"><Link to="/users">إدارة الأعضاء</Link></Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الصلاحية</TableHead>
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                <TableHead key={r}>{ROLE_LABELS[r]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSIONS.map((p) => (
              <TableRow key={p.key}>
                <TableCell className="font-medium">{p.label}</TableCell>
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                  <TableCell key={r}>
                    {ROLE_PERMISSIONS[r].includes(p.key) ? <Badge>نعم</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------- قواعد البيانات ---------- */
function DatabasesTab({ canEdit }: { canEdit: boolean }) {
  const { data } = useQuery({
    queryKey: ["settings-databases"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("databases").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4 text-primary" />قواعد البيانات المسجّلة</CardTitle>
        <Button asChild variant="outline" size="sm"><Link to="/connect">مركز الربط والمزامنة</Link></Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>المضيف</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>آخر تحديث</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell><Badge variant="secondary">{d.engine ?? d.type ?? "—"}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{d.host ?? "—"}</TableCell>
                <TableCell>{d.status ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.updated_at ? new Date(d.updated_at).toLocaleDateString("ar") : "—"}
                </TableCell>
              </TableRow>
            ))}
            {(!data || data.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">لا توجد قواعد بيانات مسجّلة.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {!canEdit && <p className="text-xs text-muted-foreground mt-3">عرض فقط — التعديل يحتاج صلاحية مدير.</p>}
      </CardContent>
    </Card>
  );
}

/* ---------- الشبكة ---------- */
function NetworkTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(getPlatformSettings);
  const save = useServerFn(savePlatformSettings);
  const { data } = useQuery({ queryKey: ["platform-settings"], queryFn: () => load() });
  const [form, setForm] = useState({ official_domain: "", maintenance_mode: false });

  useEffect(() => {
    if (data) setForm({ official_domain: data.official_domain ?? "", maintenance_mode: !!data.maintenance_mode });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => { await save({ data: form }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-settings"] }); toast.success("تم حفظ إعدادات الشبكة"); },
    onError: (e: any) => toast.error(e?.message || "تعذر الحفظ"),
  });

  const dns = (data?.dns_records ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <SectionCard title="الشبكة والنطاق" icon={Shield} canEdit={canEdit} onSave={() => mutation.mutate()} saving={mutation.isPending}>
        <Field label="النطاق الرسمي" value={form.official_domain} disabled={!canEdit} onChange={(v) => setForm({ ...form, official_domain: v })} />
        <div className="flex items-center justify-between">
          <Label>وضع الصيانة</Label>
          <Switch checked={form.maintenance_mode} disabled={!canEdit} onCheckedChange={(v) => setForm({ ...form, maintenance_mode: v })} />
        </div>
      </SectionCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />سجلات DNS للربط الموحد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs space-y-1">
            <div><span className="text-primary">Type:</span> CNAME</div>
            <div><span className="text-primary">Host:</span> {dns["cname_host"] ?? "_tvcc"}</div>
            <div><span className="text-primary">Value:</span> {dns["cname_value"] ?? "network.tvcc.ma"}</div>
          </div>
          <p className="text-center text-xs text-muted-foreground">— أو —</p>
          <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs space-y-1">
            <div><span className="text-primary">Type:</span> TXT</div>
            <div><span className="text-primary">Host:</span> {dns["txt_host"] ?? "_tvcc"}</div>
            <div><span className="text-primary">Value:</span> {dns["txt_value"] ?? "tvcc-network=enabled"}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            بمجرد اكتشاف السجل، يصبح الموقع متصلاً تلقائياً بكل خدمات TVCC: قواعد البيانات، التخزين، النسخ الاحتياطي، ونظام المستخدمين الموحد.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- عناصر مشتركة ---------- */
function SectionCard({
  title, icon: Icon, children, canEdit, onSave, saving,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  canEdit: boolean;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {children}
        {canEdit ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1.5" /> : <Save className="w-3.5 h-3.5 ml-1.5" />}
              حفظ
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">عرض فقط — لا تملك صلاحية التعديل.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
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
        <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />كلمة السر</CardTitle>
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
