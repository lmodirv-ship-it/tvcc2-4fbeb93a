import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Wand2, Globe, Search, Loader2, AlertTriangle, History,
  Palette, Share2, BarChart3, Database as DbIcon, HardDrive,
  ToggleRight, Megaphone, Code2, Settings as SettingsIcon, FileText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/editor")({
  component: EditorPage,
  head: () => ({ meta: [{ title: "محرر التعديل الجماعي — TVCC" }] }),
});

type ChangeType =
  | "general" | "seo" | "logo" | "colors" | "social" | "analytics"
  | "database" | "storage" | "feature" | "announcement" | "head_script" | "footer_script";

const CHANGE_TYPES: { key: ChangeType; label: string; icon: any; settingKey: string }[] = [
  { key: "general", label: "تغيير إعدادات عامة", icon: SettingsIcon, settingKey: "general" },
  { key: "seo", label: "تغيير بيانات SEO", icon: Search, settingKey: "seo" },
  { key: "logo", label: "تغيير شعار الموقع", icon: FileText, settingKey: "logo" },
  { key: "colors", label: "تغيير ألوان الموقع", icon: Palette, settingKey: "colors" },
  { key: "social", label: "تغيير روابط التواصل", icon: Share2, settingKey: "social" },
  { key: "analytics", label: "تغيير كود التتبع Analytics", icon: BarChart3, settingKey: "analytics" },
  { key: "database", label: "تغيير إعدادات قاعدة البيانات", icon: DbIcon, settingKey: "database" },
  { key: "storage", label: "تغيير إعدادات التخزين", icon: HardDrive, settingKey: "storage" },
  { key: "feature", label: "تفعيل أو تعطيل ميزة", icon: ToggleRight, settingKey: "feature" },
  { key: "announcement", label: "تحديث رسالة أو إعلان", icon: Megaphone, settingKey: "announcement" },
  { key: "head_script", label: "إضافة سكريبت إلى Head", icon: Code2, settingKey: "head_script" },
  { key: "footer_script", label: "إضافة سكريبت إلى Footer", icon: Code2, settingKey: "footer_script" },
];

function EditorPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [changeType, setChangeType] = useState<ChangeType>("seo");
  const [values, setValues] = useState<Record<string, any>>({});
  const [applying, setApplying] = useState(false);

  const { data: websites } = useQuery({
    queryKey: ["websites"],
    queryFn: async () => (await supabase.from("websites").select("*").order("created_at", { ascending: false })).data || [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("id,full_name,website_id")).data || [],
  });
  const { data: subs } = useQuery({
    queryKey: ["subs-list"],
    queryFn: async () => (await supabase.from("subscriptions").select("website_id,plan_name,status")).data || [],
  });
  const { data: recent } = useQuery({
    queryKey: ["editor-activity"],
    queryFn: async () =>
      (await supabase.from("activity_log")
        .select("*")
        .eq("entity_type", "editor")
        .order("created_at", { ascending: false })
        .limit(8)).data || [],
  });

  const enriched = useMemo(() => {
    return (websites || []).map((w) => ({
      ...w,
      client: clients?.find((c) => c.website_id === w.id)?.full_name || "—",
      sub: subs?.find((s) => s.website_id === w.id)?.plan_name || "—",
    }));
  }, [websites, clients, subs]);

  const clientOptions = useMemo(
    () => Array.from(new Set((clients || []).map((c) => c.full_name).filter(Boolean))),
    [clients]
  );
  const subOptions = useMemo(
    () => Array.from(new Set((subs || []).map((s) => s.plan_name).filter(Boolean))),
    [subs]
  );

  const filtered = enriched.filter((w) => {
    const q = search.toLowerCase();
    const matchQ = !q || w.name.toLowerCase().includes(q) || w.domain.toLowerCase().includes(q);
    const matchC = clientFilter === "all" || w.client === clientFilter;
    const matchS = statusFilter === "all" || w.status === statusFilter;
    const matchB = subFilter === "all" || w.sub === subFilter;
    return matchQ && matchC && matchS && matchB;
  });

  const toggleAll = () => {
    if (filtered.every((w) => selected.has(w.id))) {
      const ns = new Set(selected);
      filtered.forEach((w) => ns.delete(w.id));
      setSelected(ns);
    } else {
      const ns = new Set(selected);
      filtered.forEach((w) => ns.add(w.id));
      setSelected(ns);
    }
  };
  const toggleOne = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const current = CHANGE_TYPES.find((c) => c.key === changeType)!;
  const selectedSites = enriched.filter((w) => selected.has(w.id));

  const setVal = (k: string, v: any) => setValues((prev) => ({ ...prev, [k]: v }));

  const apply = async () => {
    if (selected.size === 0) return toast.error("اختر موقعاً على الأقل");
    setApplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const rows = Array.from(selected).map((wid) => ({
        website_id: wid,
        owner_id: user.id,
        setting_key: current.settingKey,
        value: values,
      }));
      const { error } = await supabase
        .from("website_settings")
        .upsert(rows, { onConflict: "website_id,setting_key" });
      if (error) throw error;
      await supabase.from("activity_log").insert({
        owner_id: user.id,
        action: `bulk_${current.settingKey}`,
        entity_type: "editor",
        details: { change: current.label, sites: Array.from(selected), values },
      });
      toast.success(`تم تطبيق التغيير على ${selected.size} موقع`);
      setValues({});
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["editor-activity"] });
    } catch (e: any) {
      toast.error(e?.message || "فشل التطبيق");
    } finally {
      setApplying(false);
    }
  };

  const valuesReady = Object.values(values).some((v) => v !== "" && v !== undefined && v !== null);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المحرر — التعديل الجماعي</h1>
          <p className="text-muted-foreground text-sm mt-1">طبّق تغييراً موحّداً على عدة مواقع بضغطة زر</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-foreground font-medium">المحرر</span>
          <span>/</span>
          <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
          <span>/</span>
          <Wand2 className="w-4 h-4 text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sites selection */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> اختيار المواقع</h2>
              <Badge variant="secondary">{selected.size} محدّد</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="relative col-span-2 md:col-span-1">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 h-9" />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="العميل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل العملاء</SelectItem>
                  {clientOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="online">متصل</SelectItem>
                  <SelectItem value="offline">غير متصل</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subFilter} onValueChange={setSubFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="الاشتراك" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الاشتراكات</SelectItem>
                  {subOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto border border-border/40 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((w) => selected.has(w.id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-right">الموقع</TableHead>
                    <TableHead className="text-right">الدومين</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الاشتراك</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مواقع</TableCell></TableRow>
                  ) : filtered.map((w) => (
                    <TableRow key={w.id} className="border-border/40">
                      <TableCell><Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggleOne(w.id)} /></TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{w.domain}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          w.status === "online" ? "border-success/40 text-success" :
                          w.status === "offline" ? "border-warning/40 text-warning" : ""
                        }>{w.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{w.client}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.sub}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Change type + form + preview */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> نوع التغيير</h2>

            <Select value={changeType} onValueChange={(v) => { setChangeType(v as ChangeType); setValues({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANGE_TYPES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    <span className="flex items-center gap-2"><c.icon className="w-4 h-4" /> {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Separator />

            <ChangeForm type={changeType} values={values} setVal={setVal} />

            <Separator />

            {/* Preview */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4 text-warning" /> معاينة التغيير</div>
              <div className="text-muted-foreground text-xs">سيُطبَّق على <span className="text-foreground font-semibold">{selected.size}</span> موقع</div>
              {selectedSites.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedSites.slice(0, 6).map((s) => <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>)}
                  {selectedSites.length > 6 && <Badge variant="secondary" className="text-[10px]">+{selectedSites.length - 6}</Badge>}
                </div>
              )}
              <div className="text-xs"><span className="text-muted-foreground">النوع:</span> {current.label}</div>
              {valuesReady && (
                <pre className="text-[10px] bg-background/60 p-2 rounded overflow-auto max-h-32">{JSON.stringify(values, null, 2)}</pre>
              )}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={selected.size === 0 || !valuesReady || applying}>
                  {applying ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Wand2 className="w-4 h-4 ml-2" />}
                  Apply Changes
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد التطبيق الجماعي</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم تطبيق "{current.label}" على {selected.size} موقع. هذا الإجراء يُسجَّل في سجل العمليات.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={apply}>تأكيد التطبيق</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Recent editor actions */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Recent Editor Actions</h2>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">نوع التغيير</TableHead>
                <TableHead className="text-right">المواقع المتأثرة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!recent || recent.length === 0) ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">لا توجد عمليات بعد</TableCell></TableRow>
              ) : recent.map((r) => {
                const det = (r.details || {}) as any;
                const count = Array.isArray(det.sites) ? det.sites.length : 0;
                return (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="text-sm">Admin</TableCell>
                    <TableCell className="text-sm">{det.change || r.action}</TableCell>
                    <TableCell><Badge variant="secondary">{count} موقع</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChangeForm({
  type, values, setVal,
}: { type: ChangeType; values: Record<string, any>; setVal: (k: string, v: any) => void }) {
  const v = (k: string) => values[k] ?? "";

  if (type === "general") return (
    <div className="space-y-3">
      <Field label="اسم الموقع"><Input value={v("name")} onChange={(e) => setVal("name", e.target.value)} /></Field>
      <Field label="اللغة الافتراضية">
        <Select value={v("language") || "ar"} onValueChange={(x) => setVal("language", x)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ar">العربية</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="المنطقة الزمنية"><Input placeholder="Africa/Casablanca" value={v("timezone")} onChange={(e) => setVal("timezone", e.target.value)} /></Field>
    </div>
  );

  if (type === "seo") return (
    <div className="space-y-3">
      <Field label="Page title"><Input value={v("title")} onChange={(e) => setVal("title", e.target.value)} /></Field>
      <Field label="Meta description"><Textarea rows={3} value={v("description")} onChange={(e) => setVal("description", e.target.value)} /></Field>
      <Field label="Keywords"><Input placeholder="kw1, kw2" value={v("keywords")} onChange={(e) => setVal("keywords", e.target.value)} /></Field>
    </div>
  );

  if (type === "logo") return (
    <div className="space-y-3">
      <Field label="رابط الشعار (URL)"><Input placeholder="https://..." value={v("logo_url")} onChange={(e) => setVal("logo_url", e.target.value)} /></Field>
      <Field label="رابط الـ Favicon"><Input placeholder="https://..." value={v("favicon_url")} onChange={(e) => setVal("favicon_url", e.target.value)} /></Field>
    </div>
  );

  if (type === "colors") return (
    <div className="space-y-3">
      <ColorField label="Primary color" value={v("primary")} onChange={(x) => setVal("primary", x)} />
      <ColorField label="Secondary color" value={v("secondary")} onChange={(x) => setVal("secondary", x)} />
      <ColorField label="Background color" value={v("background")} onChange={(x) => setVal("background", x)} />
    </div>
  );

  if (type === "social") return (
    <div className="space-y-3">
      {["facebook", "instagram", "tiktok", "whatsapp", "youtube"].map((s) => (
        <Field key={s} label={s.charAt(0).toUpperCase() + s.slice(1)}>
          <Input placeholder="https://..." value={v(s)} onChange={(e) => setVal(s, e.target.value)} />
        </Field>
      ))}
    </div>
  );

  if (type === "analytics") return (
    <div className="space-y-3">
      <Field label="Google Analytics ID"><Input placeholder="G-XXXXXXXX" value={v("ga_id")} onChange={(e) => setVal("ga_id", e.target.value)} /></Field>
      <Field label="Meta Pixel ID"><Input value={v("pixel_id")} onChange={(e) => setVal("pixel_id", e.target.value)} /></Field>
    </div>
  );

  if (type === "database") return (
    <div className="space-y-3">
      <Field label="Host"><Input value={v("host")} onChange={(e) => setVal("host", e.target.value)} /></Field>
      <Field label="User"><Input value={v("user")} onChange={(e) => setVal("user", e.target.value)} /></Field>
      <Field label="حد الحجم (MB)"><Input type="number" value={v("size_mb")} onChange={(e) => setVal("size_mb", Number(e.target.value))} /></Field>
    </div>
  );

  if (type === "storage") return (
    <div className="space-y-3">
      <Field label="Region"><Input placeholder="eu-west-1" value={v("region")} onChange={(e) => setVal("region", e.target.value)} /></Field>
      <Field label="حد الحجم (GB)"><Input type="number" value={v("size_gb")} onChange={(e) => setVal("size_gb", Number(e.target.value))} /></Field>
    </div>
  );

  if (type === "feature") return (
    <div className="space-y-3">
      <Field label="اسم الميزة"><Input placeholder="dark_mode" value={v("feature_name")} onChange={(e) => setVal("feature_name", e.target.value)} /></Field>
      <div className="flex items-center justify-between rounded border border-border/40 p-3">
        <Label>تفعيل</Label>
        <Switch checked={!!values.enabled} onCheckedChange={(c) => setVal("enabled", c)} />
      </div>
    </div>
  );

  if (type === "announcement") return (
    <div className="space-y-3">
      <Field label="نص الإعلان"><Textarea rows={3} value={v("message")} onChange={(e) => setVal("message", e.target.value)} /></Field>
      <Field label="تاريخ البداية"><Input type="date" value={v("start_at")} onChange={(e) => setVal("start_at", e.target.value)} /></Field>
      <Field label="تاريخ النهاية"><Input type="date" value={v("end_at")} onChange={(e) => setVal("end_at", e.target.value)} /></Field>
      <div className="flex items-center justify-between rounded border border-border/40 p-3">
        <Label>مفعَّل</Label>
        <Switch checked={!!values.active} onCheckedChange={(c) => setVal("active", c)} />
      </div>
    </div>
  );

  if (type === "head_script" || type === "footer_script") return (
    <div className="space-y-3">
      <Field label="كود الـ Script">
        <Textarea rows={6} className="font-mono text-xs" placeholder="<script>...</script>" value={v("code")} onChange={(e) => setVal("code", e.target.value)} />
      </Field>
    </div>
  );

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || "#7c3aed"} onChange={(e) => onChange(e.target.value)} className="w-10 h-9 rounded border border-border bg-transparent" />
        <Input placeholder="#7c3aed" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
