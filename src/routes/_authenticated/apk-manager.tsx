import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Smartphone, Upload, Save, Download, History, Package, CheckCircle2,
  AlertCircle, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/apk-manager")({
  component: ApkManagerPage,
  head: () => ({ meta: [{ title: "APK Manager — TVCC" }] }),
});

function ApkManagerPage() {
  const qc = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [form, setForm] = useState({
    version_name: "",
    version_code: "",
    apk_url: "",
    aab_url: "",
    notes: "",
    enabled: true,
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const { data: websites, isLoading: loadingSites } = useQuery({
    queryKey: ["websites-apk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("websites")
        .select("id, name, domain, site_id, frontend_domain, android_enabled, android_latest_version, android_version_code, android_apk_url, android_aab_url, android_status, android_updated_at")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const site = useMemo(
    () => websites?.find((w) => w.id === selectedSite),
    [websites, selectedSite],
  );

  const { data: releases } = useQuery({
    queryKey: ["android-releases", selectedSite],
    enabled: !!selectedSite,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_android_releases")
        .select("*")
        .eq("website_id", selectedSite)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cloudPath = site?.site_id
    ? `/var/hn-cloud/websites/${site.site_id}/app/android/`
    : "";

  const sitesWithApk = websites?.filter((w) => w.android_enabled).length || 0;

  const setVal = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onPickSite = (id: string) => {
    setSelectedSite(id);
    const w = websites?.find((x) => x.id === id);
    setForm({
      version_name: w?.android_latest_version || "",
      version_code: w?.android_version_code?.toString() || "",
      apk_url: w?.android_apk_url || "",
      aab_url: w?.android_aab_url || "",
      notes: "",
      enabled: w?.android_enabled ?? true,
      status: w?.android_status || "active",
    });
  };

  const save = async () => {
    if (!site) return toast.error("اختر موقعاً أولاً");
    if (!form.version_name || !form.version_code) {
      return toast.error("رقم الإصدار و version code مطلوبان");
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("غير مصادق");

      const code = Number(form.version_code);

      // 1) update website android fields
      const { error: e1 } = await supabase
        .from("websites")
        .update({
          android_enabled: form.enabled,
          android_latest_version: form.version_name,
          android_version_code: code,
          android_apk_url: form.apk_url || null,
          android_aab_url: form.aab_url || null,
          android_status: form.status,
          android_updated_at: new Date().toISOString(),
        })
        .eq("id", site.id);
      if (e1) throw e1;

      // 2) unmark previous current
      await supabase
        .from("website_android_releases")
        .update({ is_current: false })
        .eq("website_id", site.id);

      // 3) insert new release
      const { error: e2 } = await supabase.from("website_android_releases").insert({
        owner_id: uid,
        website_id: site.id,
        version_name: form.version_name,
        version_code: code,
        apk_url: form.apk_url || null,
        aab_url: form.aab_url || null,
        notes: form.notes || null,
        is_current: true,
      });
      if (e2) throw e2;

      toast.success("تم حفظ الإصدار");
      qc.invalidateQueries({ queryKey: ["websites-apk"] });
      qc.invalidateQueries({ queryKey: ["android-releases", site.id] });
    } catch (err: any) {
      toast.error(err.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
        <span>/</span>
        <span className="text-foreground">APK Manager</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-primary" /> مدير تطبيقات Android
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة ملفات APK / AAB والإصدارات لكل موقع — التخزين الفعلي على HN-Cloud
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card className="ring-1 ring-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{sitesWithApk}</p>
                <p className="text-xs text-muted-foreground">مواقع لديها تطبيق</p>
              </div>
            </CardContent>
          </Card>
          <Card className="ring-1 ring-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{websites?.length || 0}</p>
                <p className="text-xs text-muted-foreground">إجمالي المواقع</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Architecture note */}
      <Card className="ring-1 ring-warning/30 bg-warning/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">معمارية التخزين</p>
            <p className="text-muted-foreground">
              TVCC يدير البيانات الوصفية وروابط التنزيل. الملفات الفعلية (APK/AAB/أيقونات/لقطات)
              تُرفع على HN-Cloud في المسار:{" "}
              <code className="bg-background px-1.5 py-0.5 rounded text-xs" dir="ltr">
                /var/hn-cloud/websites/{`{site_id}`}/app/android/
              </code>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-2 ring-1 ring-border bg-card/60">
          <CardContent className="p-6 space-y-5">
            <div>
              <Label>الموقع المرتبط *</Label>
              <Select value={selectedSite} onValueChange={onPickSite} disabled={loadingSites}>
                <SelectTrigger className="mt-1 bg-secondary/40">
                  <SelectValue placeholder={loadingSites ? "جاري التحميل..." : "اختر موقعاً"} />
                </SelectTrigger>
                <SelectContent>
                  {websites?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} — {w.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {site && cloudPath && (
                <p className="text-[11px] text-muted-foreground mt-2" dir="ltr">
                  HN-Cloud path: <code className="bg-background px-1 rounded">{cloudPath}</code>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>رقم الإصدار (version name) *</Label>
                <Input
                  dir="ltr"
                  placeholder="1.0.0"
                  className="mt-1 bg-secondary/40"
                  value={form.version_name}
                  onChange={(e) => setVal("version_name", e.target.value)}
                />
              </div>
              <div>
                <Label>Version Code *</Label>
                <Input
                  type="number"
                  dir="ltr"
                  placeholder="1"
                  className="mt-1 bg-secondary/40"
                  value={form.version_code}
                  onChange={(e) => setVal("version_code", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> رابط APK (HN-Cloud)
              </Label>
              <Input
                dir="ltr"
                placeholder="https://hn-cloud.example.com/files/{site_id}/app/android/apk/app-v1.0.0.apk"
                className="mt-1 bg-secondary/40 font-mono text-xs"
                value={form.apk_url}
                onChange={(e) => setVal("apk_url", e.target.value)}
              />
            </div>

            <div>
              <Label className="flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> رابط AAB (HN-Cloud)
              </Label>
              <Input
                dir="ltr"
                placeholder="https://hn-cloud.example.com/files/{site_id}/app/android/aab/app-v1.0.0.aab"
                className="mt-1 bg-secondary/40 font-mono text-xs"
                value={form.aab_url}
                onChange={(e) => setVal("aab_url", e.target.value)}
              />
            </div>

            <div>
              <Label>ملاحظات الإصدار</Label>
              <Textarea
                rows={3}
                className="mt-1 bg-secondary/40"
                placeholder="ما الجديد في هذا الإصدار..."
                value={form.notes}
                onChange={(e) => setVal("notes", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>حالة التطبيق</Label>
                <Select value={form.status} onValueChange={(v) => setVal("status", v)}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="beta">تجريبي</SelectItem>
                    <SelectItem value="maintenance">صيانة</SelectItem>
                    <SelectItem value="inactive">معطّل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between w-full rounded-md border border-border/40 p-3 bg-secondary/30">
                  <Switch checked={form.enabled} onCheckedChange={(c) => setVal("enabled", c)} />
                  <Label className="text-sm">تفعيل تطبيق Android لهذا الموقع</Label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <Button
                className="bg-primary"
                onClick={save}
                disabled={!selectedSite || saving}
              >
                {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                حفظ الإصدار
              </Button>
              {form.apk_url && (
                <Button variant="outline" asChild>
                  <a href={form.apk_url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                    <Download className="w-4 h-4" /> تنزيل آخر APK
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current status + releases */}
        <div className="space-y-4">
          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> الحالة الحالية
              </h3>
              {!site ? (
                <p className="text-sm text-muted-foreground">اختر موقعاً لعرض الحالة</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <Row label="site_id" value={<code dir="ltr" className="text-xs">{site.site_id || "—"}</code>} />
                  <Row label="frontend_domain" value={<span dir="ltr" className="text-xs">{site.frontend_domain || site.domain}</span>} />
                  <Row label="مفعّل" value={site.android_enabled ? <Badge className="bg-success/20 text-success border-success/40">نعم</Badge> : <Badge variant="outline">لا</Badge>} />
                  <Row label="آخر إصدار" value={site.android_latest_version || "—"} />
                  <Row label="version code" value={site.android_version_code ?? "—"} />
                  <Row label="الحالة" value={site.android_status || "—"} />
                  {site.android_apk_url && (
                    <a
                      href={site.android_apk_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                      dir="ltr"
                    >
                      <ExternalLink className="w-3 h-3" /> latest.apk
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> سجل الإصدارات
              </h3>
              {!selectedSite ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : !releases || releases.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا يوجد إصدارات بعد</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right text-xs">الإصدار</TableHead>
                      <TableHead className="text-right text-xs">Code</TableHead>
                      <TableHead className="text-right text-xs">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {releases.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">
                          {r.version_name}
                          {r.is_current && (
                            <Badge className="mr-1 bg-primary/20 text-primary border-primary/40 text-[10px]">الحالي</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs" dir="ltr">{r.version_code}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("ar")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
