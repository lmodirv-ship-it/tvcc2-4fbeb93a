import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plug, Database, HardDrive, Info, Link2, RefreshCw, Trash2,
  CheckCircle2, XCircle, Clock, Plus, Globe, KeyRound, Webhook, Code2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listIntegrations, saveIntegration, testIntegration, deleteIntegration,
} from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
  head: () => ({ meta: [{ title: "التكاملات — TVCC" }] }),
});

type Integration = {
  id: string;
  service_key: string;
  name: string;
  method: "url" | "api" | "token" | "webhook";
  url: string;
  webhook_url: string | null;
  status: "pending" | "connected" | "failed";
  last_checked_at: string | null;
  last_error: string | null;
};

const METHODS = [
  { value: "url", label: "رابط URL", icon: Globe },
  { value: "api", label: "API", icon: Code2 },
  { value: "token", label: "رمز Token", icon: KeyRound },
  { value: "webhook", label: "Webhook", icon: Webhook },
] as const;

function StatusBadge({ status }: { status: Integration["status"] }) {
  if (status === "connected")
    return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> متصل</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> فشل الاتصال</Badge>;
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> بانتظار الفحص</Badge>;
}

function ServiceCard({
  serviceKey, defaultName, description, icon: Icon, color, integration, onChanged,
}: {
  serviceKey: string;
  defaultName: string;
  description: string;
  icon: any;
  color: string;
  integration?: Integration;
  onChanged: () => void;
}) {
  const save = useServerFn(saveIntegration);
  const test = useServerFn(testIntegration);
  const remove = useServerFn(deleteIntegration);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: integration?.name ?? defaultName,
    method: (integration?.method ?? "url") as Integration["method"],
    url: integration?.url ?? "",
    token: "",
    webhookUrl: integration?.webhook_url ?? "",
  });

  const handleSave = async () => {
    if (!form.url) { toast.error("أدخل رابط الخدمة"); return; }
    setBusy(true);
    try {
      const r = await save({ data: { serviceKey, ...form } });
      if (r.connected) toast.success("تم الربط والاتصال ناجح ✓");
      else toast.warning(`تم الحفظ — حالة الاتصال: فشل (${r.error ?? "غير معروف"})`);
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!integration) return;
    setBusy(true);
    try {
      const r = await test({ data: { id: integration.id } });
      if (r.connected) toast.success("الاتصال ناجح ✓");
      else toast.error(`فشل الاتصال: ${r.error ?? ""}`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="ring-1 ring-border bg-card/60">
      <CardContent className="p-6 space-y-4" dir="rtl">
        <div className="flex items-start justify-between">
          <StatusBadge status={integration?.status ?? "pending"} />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h2 className="text-lg font-bold">{integration?.name ?? defaultName}</h2>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </div>

        {integration ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="ltr text-left truncate" dir="ltr">{integration.url}</p>
            <p>طريقة الربط: {METHODS.find((m) => m.value === integration.method)?.label}</p>
            {integration.last_checked_at && (
              <p>آخر فحص: {new Date(integration.last_checked_at).toLocaleString("ar")}</p>
            )}
            {integration.last_error && <p className="text-destructive">{integration.last_error}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">لم يتم الربط بعد — احفظ الرابط وسيبقى «بانتظار الفحص» حتى تصل حالة الاتصال.</p>
        )}

        <div className="flex gap-2 pt-2 border-t border-border/40">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 gap-1">
                <Link2 className="w-4 h-4" /> {integration ? "تعديل الربط" : "ربط"}
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>ربط {defaultName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>الاسم</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>طريقة الربط</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {METHODS.map((m) => (
                      <Button
                        key={m.value}
                        type="button"
                        variant={form.method === m.value ? "default" : "outline"}
                        size="sm"
                        className="gap-1"
                        onClick={() => setForm({ ...form, method: m.value })}
                      >
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>رابط الخدمة (URL)</Label>
                  <Input dir="ltr" placeholder="https://..." value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                {(form.method === "api" || form.method === "token") && (
                  <div>
                    <Label>رمز API / Token</Label>
                    <Input dir="ltr" type="password" placeholder="••••••••" value={form.token}
                      onChange={(e) => setForm({ ...form, token: e.target.value })} />
                  </div>
                )}
                {form.method === "webhook" && (
                  <div>
                    <Label>رابط Webhook</Label>
                    <Input dir="ltr" placeholder="https://.../webhook" value={form.webhookUrl}
                      onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} />
                  </div>
                )}
                <Button className="w-full" disabled={busy} onClick={handleSave}>
                  {busy ? "جارٍ الحفظ والفحص…" : "حفظ الربط وفحص الاتصال"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {integration && (
            <>
              <Button variant="outline" size="icon" title="اختبار الاتصال" disabled={busy} onClick={handleTest}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost" size="icon" title="حذف الربط" disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await remove({ data: { id: integration.id } });
                    toast.success("تم حذف الربط");
                    onChanged();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listIntegrations);
  const { data: integrations } = useQuery({
    queryKey: ["external-integrations"],
    queryFn: () => fetchList(),
  });
  const [customOpen, setCustomOpen] = useState(false);
  const save = useServerFn(saveIntegration);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState({ name: "", method: "url" as Integration["method"], url: "", token: "", webhookUrl: "" });

  const byKey = new Map((integrations as Integration[] | undefined)?.map((i) => [i.service_key, i]));
  const refresh = () => qc.invalidateQueries({ queryKey: ["external-integrations"] });
  const customIntegrations = (integrations as Integration[] | undefined)?.filter(
    (i) => i.service_key.startsWith("custom:")
  ) ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
        <span>/</span>
        <span className="text-foreground">التكاملات</span>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plug className="w-7 h-7 text-primary" /> التكاملات الخارجية
          </h1>
          <p className="text-muted-foreground mt-1">
            ربط TVCC بخدمات قواعد البيانات والتخزين المستقلة عبر URL / API / Token / Webhook
          </p>
        </div>
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-1"><Plus className="w-4 h-4" /> تكامل مخصص</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة تكامل مخصص</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>اسم الخدمة</Label>
                <Input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
              </div>
              <div>
                <Label>طريقة الربط</Label>
                <Select value={custom.method} onValueChange={(v) => setCustom({ ...custom, method: v as Integration["method"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رابط الخدمة (URL)</Label>
                <Input dir="ltr" placeholder="https://..." value={custom.url}
                  onChange={(e) => setCustom({ ...custom, url: e.target.value })} />
              </div>
              {(custom.method === "api" || custom.method === "token") && (
                <div>
                  <Label>رمز API / Token</Label>
                  <Input dir="ltr" type="password" value={custom.token}
                    onChange={(e) => setCustom({ ...custom, token: e.target.value })} />
                </div>
              )}
              {custom.method === "webhook" && (
                <div>
                  <Label>رابط Webhook</Label>
                  <Input dir="ltr" value={custom.webhookUrl}
                    onChange={(e) => setCustom({ ...custom, webhookUrl: e.target.value })} />
                </div>
              )}
              <Button
                className="w-full" disabled={busy || !custom.name || !custom.url}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const key = `custom:${custom.name.trim().toLowerCase().replace(/\s+/g, "-")}`;
                    const r = await save({ data: { serviceKey: key, ...custom } });
                    if (r.connected) toast.success("تم الربط والاتصال ناجح ✓");
                    else toast.warning("تم الحفظ — بانتظار وصول حالة الاتصال");
                    setCustomOpen(false);
                    setCustom({ name: "", method: "url", url: "", token: "", webhookUrl: "" });
                    refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "جارٍ الحفظ…" : "حفظ الربط"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="ring-1 ring-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">معمارية المنصة</p>
            <p className="text-muted-foreground">
              TVCC = مركز قيادة المواقع. إدارة قواعد البيانات تتم في <strong>HN-DB</strong>،
              وإدارة الملفات والتخزين في <strong>HN-Cloud</strong>. يُحفظ كل ربط في قاعدة البيانات
              بحالة «بانتظار الفحص» ثم تتحدّث إلى «متصل» أو «فشل» بعد فحص الرابط.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceCard
          serviceKey="hn-db"
          defaultName="HN-DB"
          description="مركز إدارة قواعد البيانات"
          icon={Database}
          color="bg-success/15 text-success"
          integration={byKey.get("hn-db")}
          onChanged={refresh}
        />
        <ServiceCard
          serviceKey="hn-cloud"
          defaultName="HN-Cloud"
          description="مركز التخزين والملفات والنسخ الاحتياطية"
          icon={HardDrive}
          color="bg-warning/15 text-warning"
          integration={byKey.get("hn-cloud")}
          onChanged={refresh}
        />
        {customIntegrations.map((i) => (
          <ServiceCard
            key={i.id}
            serviceKey={i.service_key}
            defaultName={i.name}
            description="تكامل مخصص"
            icon={Plug}
            color="bg-primary/15 text-primary"
            integration={i}
            onChanged={refresh}
          />
        ))}
      </div>
    </div>
  );
}
