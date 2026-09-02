import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldCheck, Server, Globe, FlaskConical, Save, Play, Lock, Flame, Trash2, ArrowRight,
} from "lucide-react";
import {
  getDomainSettings, saveDomainSettings, applyDomainNginx, issueDomainSsl,
  applyFirewallRule, deleteFirewallRule,
} from "@/lib/domain-settings.functions";

export const Route = createFileRoute("/_authenticated/domain-settings/$domain")({
  component: DomainSettingsPage,
  head: () => ({
    meta: [
      { title: "إعدادات النطاق — TVCC" },
      { name: "description", content: "إعدادات Nginx وشهادات SSL وقواعد الجدار الناري لكل نطاق." },
    ],
  }),
});

const DEFAULTS = {
  upstream_host: "127.0.0.1",
  backend_port: 3000,
  force_https: true,
  http2: true,
  websockets: true,
  redirect_www: true,
  security_headers: true,
  client_max_body_mb: 25,
  proxy_read_timeout: 60,
  extra_directives: "",
  ssl_mode: "letsencrypt",
  server_id: "",
  website_id: null as string | null,
};

function DomainSettingsPage() {
  const { domain } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getDomainSettings);
  const save = useServerFn(saveDomainSettings);
  const apply = useServerFn(applyDomainNginx);
  const ssl = useServerFn(issueDomainSsl);
  const fw = useServerFn(applyFirewallRule);
  const rmRule = useServerFn(deleteFirewallRule);

  const { data } = useQuery({
    queryKey: ["domain-settings", domain],
    queryFn: () => load({ data: { domain } }),
    refetchInterval: 20000,
  });

  const [form, setForm] = useState<Record<string, any>>(DEFAULTS);
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [fwPort, setFwPort] = useState("443");
  const [fwProto, setFwProto] = useState("tcp");
  const [fwSrc, setFwSrc] = useState("any");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.settings) setForm({ ...DEFAULTS, ...data.settings });
  }, [data?.settings]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const doSave = async () => {
    setBusy(true);
    try {
      const patch = {
        server_id: form.server_id || null,
        website_id: data?.website?.id ?? form.website_id ?? null,
        upstream_host: form.upstream_host,
        backend_port: Number(form.backend_port) || null,
        force_https: !!form.force_https,
        http2: !!form.http2,
        websockets: !!form.websockets,
        redirect_www: !!form.redirect_www,
        security_headers: !!form.security_headers,
        client_max_body_mb: Number(form.client_max_body_mb) || 25,
        proxy_read_timeout: Number(form.proxy_read_timeout) || 60,
        extra_directives: form.extra_directives || null,
        ssl_mode: form.ssl_mode,
        nginx_template: form.nginx_template || null,
      };
      await save({ data: { domain, patch } });
      toast.success("تم حفظ إعدادات النطاق");
      qc.invalidateQueries({ queryKey: ["domain-settings", domain] });
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const doApply = async (dryRun: boolean) => {
    try {
      await apply({ data: { domain, dryRun } });
      toast.success(dryRun ? "تم إرسال المحاكاة" : "تم إرسال أمر التطبيق للسيرفر");
      qc.invalidateQueries({ queryKey: ["domain-settings", domain] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل التطبيق");
    }
  };

  const doSsl = async (mode: "letsencrypt" | "manual") => {
    try {
      await ssl({ data: { domain, mode, certPem, keyPem } });
      toast.success(mode === "letsencrypt" ? "تم طلب إصدار شهادة Let's Encrypt" : "تم إرسال الشهادة اليدوية");
      qc.invalidateQueries({ queryKey: ["domain-settings", domain] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل إصدار الشهادة");
    }
  };

  const doFw = async (action: "allow" | "deny") => {
    if (!form.server_id) return toast.error("حدّد السيرفر أولاً");
    try {
      await fw({
        data: {
          serverId: form.server_id, port: Number(fwPort), action,
          protocol: fwProto, sourceCidr: fwSrc, domain,
        },
      });
      toast.success(action === "allow" ? `تم طلب فتح المنفذ ${fwPort}` : `تم طلب إغلاق المنفذ ${fwPort}`);
      qc.invalidateQueries({ queryKey: ["domain-settings", domain] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل تطبيق القاعدة");
    }
  };

  const preview = data?.preview ?? "";

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Globe className="h-6 w-6 text-primary" /> إعدادات النطاق: {domain}
          </h1>
          <p className="text-sm text-muted-foreground">قواعد Nginx، شهادات SSL، والجدار الناري.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/domains">
              <ArrowRight className="ml-1 h-4 w-4" /> النطاقات
            </Link>
          </Button>
          <Button onClick={doSave} disabled={busy}>
            <Save className="ml-1 h-4 w-4" /> حفظ
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">الحالة: {data?.settings?.status ?? "غير مُعدّ"}</Badge>
        <Badge variant="outline">SSL: {data?.settings?.ssl_mode ?? "—"}</Badge>
        {data?.settings?.last_applied_at && (
          <Badge variant="secondary">آخر تطبيق: {new Date(data.settings.last_applied_at).toLocaleString("ar")}</Badge>
        )}
      </div>

      <Tabs defaultValue="nginx" dir="rtl">
        <TabsList>
          <TabsTrigger value="nginx"><Server className="ml-1 h-4 w-4" /> Nginx</TabsTrigger>
          <TabsTrigger value="ssl"><Lock className="ml-1 h-4 w-4" /> SSL</TabsTrigger>
          <TabsTrigger value="firewall"><Flame className="ml-1 h-4 w-4" /> الجدار الناري</TabsTrigger>
          <TabsTrigger value="log"><FlaskConical className="ml-1 h-4 w-4" /> السجل</TabsTrigger>
        </TabsList>

        <TabsContent value="nginx" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">الخادم والوجهة</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>السيرفر المستضيف</Label>
                <Select value={form.server_id || ""} onValueChange={(v) => set("server_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر سيرفر" /></SelectTrigger>
                  <SelectContent>
                    {(data?.servers ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.public_ip ?? s.hostname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>عنوان الخدمة الخلفية</Label>
                <Input value={form.upstream_host} onChange={(e) => set("upstream_host", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>منفذ الخدمة</Label>
                <Input type="number" value={form.backend_port ?? ""} onChange={(e) => set("backend_port", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>حجم الرفع الأقصى (MB)</Label>
                <Input type="number" value={form.client_max_body_mb} onChange={(e) => set("client_max_body_mb", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>مهلة القراءة (ثانية)</Label>
                <Input type="number" value={form.proxy_read_timeout} onChange={(e) => set("proxy_read_timeout", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>وضع SSL</Label>
                <Select value={form.ssl_mode} onValueChange={(v) => set("ssl_mode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">بدون</SelectItem>
                    <SelectItem value="letsencrypt">Let's Encrypt</SelectItem>
                    <SelectItem value="manual">شهادة يدوية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">خيارات</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                ["force_https", "إجبار HTTPS"],
                ["http2", "تفعيل HTTP/2"],
                ["websockets", "دعم WebSockets"],
                ["redirect_www", "تضمين www"],
                ["security_headers", "ترويسات الأمان"],
              ].map(([k, label]) => (
                <div key={k} className="flex items-center justify-between rounded-md border p-3">
                  <Label>{label}</Label>
                  <Switch checked={!!form[k as string]} onCheckedChange={(v) => set(k as string, v)} />
                </div>
              ))}
              <div className="space-y-1 md:col-span-2">
                <Label>توجيهات إضافية</Label>
                <Textarea rows={3} value={form.extra_directives ?? ""} onChange={(e) => set("extra_directives", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">معاينة ملف Nginx</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => doApply(true)}>
                  <FlaskConical className="ml-1 h-4 w-4" /> محاكاة
                </Button>
                <Button size="sm" onClick={() => doApply(false)}>
                  <Play className="ml-1 h-4 w-4" /> تطبيق على السيرفر
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre dir="ltr" className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{preview || "احفظ الإعدادات لتوليد الملف"}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ssl" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">شهادة SSL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => doSsl("letsencrypt")}>
                  <ShieldCheck className="ml-1 h-4 w-4" /> إصدار Let's Encrypt
                </Button>
                <Badge variant="outline">المُصدر: {data?.settings?.ssl_issuer ?? "—"}</Badge>
                {data?.settings?.ssl_expires_at && (
                  <Badge variant="secondary">ينتهي: {new Date(data.settings.ssl_expires_at).toLocaleDateString("ar")}</Badge>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>fullchain.pem</Label>
                  <Textarea dir="ltr" rows={6} value={certPem} onChange={(e) => setCertPem(e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" />
                </div>
                <div className="space-y-1">
                  <Label>privkey.pem</Label>
                  <Textarea dir="ltr" rows={6} value={keyPem} onChange={(e) => setKeyPem(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" />
                </div>
              </div>
              <Button variant="outline" onClick={() => doSsl("manual")}>
                <Lock className="ml-1 h-4 w-4" /> تركيب الشهادة اليدوية
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firewall" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">فتح/إغلاق منفذ</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>المنفذ</Label>
                <Input type="number" value={fwPort} onChange={(e) => setFwPort(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>البروتوكول</Label>
                <Select value={fwProto} onValueChange={setFwProto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>المصدر</Label>
                <Input value={fwSrc} onChange={(e) => setFwSrc(e.target.value)} placeholder="any أو 192.168.1.0/24" />
              </div>
              <div className="flex items-end gap-2">
                <Button className="flex-1" onClick={() => doFw("allow")}>فتح</Button>
                <Button className="flex-1" variant="destructive" onClick={() => doFw("deny")}>إغلاق</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">القواعد الحالية</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.rules ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد قواعد.</p>}
              {(data?.rules ?? []).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{r.action} {r.port}/{r.protocol} من {r.source_cidr}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.status}</Badge>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      await rmRule({ data: { id: r.id } });
                      qc.invalidateQueries({ queryKey: ["domain-settings", domain] });
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardHeader><CardTitle className="text-base">آخر العمليات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.commands ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد عمليات بعد.</p>}
              {(data?.commands ?? []).map((c: any) => (
                <div key={c.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{c.action}{c.dry_run ? " (محاكاة)" : ""}</span>
                    <Badge variant={c.status === "done" ? "secondary" : "outline"}>{c.status}</Badge>
                  </div>
                  {c.output && <pre dir="ltr" className="mt-1 max-h-40 overflow-auto text-xs text-muted-foreground">{c.output}</pre>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
