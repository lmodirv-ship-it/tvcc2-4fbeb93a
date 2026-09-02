import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Globe, HardDrive, Database, RefreshCw, Rocket, Star, Plus, Trash2,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  listPublishTargets, upsertPublishTarget, runPublish, publishAll,
  setCanonicalTarget, toggleTarget, deletePublishTarget,
} from "@/lib/publish-sync.functions";

export const Route = createFileRoute("/_authenticated/publish-sync")({
  component: PublishSyncPage,
  head: () => ({
    meta: [
      { title: "توحيد النشر والمزامنة — TVCC" },
      { name: "description", content: "نشر موحّد لنطاقات TVCC والعقدة المحلية ومزامنة قواعد البيانات من مكان واحد." },
      { property: "og:title", content: "توحيد النشر والمزامنة — TVCC" },
      { property: "og:description", content: "إدارة وجهات النشر ومزامنة البيانات بين النطاقات والشبكة المحلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Target = {
  id: string;
  owner_id: string;
  label: string;
  kind: "domain" | "local_node" | "local_db";
  url: string;
  server_id: string | null;
  service_name: string | null;
  port: number | null;
  is_canonical: boolean;
  is_active: boolean;
  health_url: string | null;
  last_publish_at: string | null;
  last_status: string | null;
  last_version: string | null;
};

const KIND_META: Record<Target["kind"], { label: string; icon: typeof Globe }> = {
  domain: { label: "نطاق عام", icon: Globe },
  local_node: { label: "عقدة محلية", icon: HardDrive },
  local_db: { label: "قاعدة بيانات محلية", icon: Database },
};

function StatusBadge({ status }: { status: string | null }) {
  if (status === "success")
    return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> ناجح</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> فشل</Badge>;
  if (status === "pending" || status === "running")
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> قيد التنفيذ</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">لم يُنشر بعد</Badge>;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

function PublishSyncPage() {
  const qc = useQueryClient();
  const list = useServerFn(listPublishTargets);
  const save = useServerFn(upsertPublishTarget);
  const publish = useServerFn(runPublish);
  const publishEverything = useServerFn(publishAll);
  const canonical = useServerFn(setCanonicalTarget);
  const toggle = useServerFn(toggleTarget);
  const remove = useServerFn(deletePublishTarget);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "", kind: "domain" as Target["kind"], url: "", serverId: "",
    serviceName: "", port: "", healthUrl: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["publish-targets"],
    queryFn: () => list({ data: {} as never }),
    refetchInterval: 20000,
  });

  const targets = (data?.targets ?? []) as Target[];
  const runs = data?.runs ?? [];
  const servers = data?.servers ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["publish-targets"] });

  const doPublish = async (id: string) => {
    setBusy(id);
    try {
      await publish({ data: { targetId: id } });
      toast.success("تم إرسال أمر النشر");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل النشر");
    } finally {
      setBusy(null);
    }
  };

  const doPublishAll = async () => {
    setBusy("all");
    try {
      await publishEverything({ data: {} as never });
      toast.success("تم تشغيل النشر لكل الوجهات النشطة");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل النشر الجماعي");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    try {
      await save({
        data: {
          label: form.label,
          kind: form.kind,
          url: form.url,
          serverId: form.serverId || null,
          serviceName: form.serviceName || null,
          port: form.port ? Number(form.port) : null,
          healthUrl: form.healthUrl || null,
        },
      });
      toast.success("تم حفظ الوجهة");
      setOpen(false);
      setForm({ label: "", kind: "domain", url: "", serverId: "", serviceName: "", port: "", healthUrl: "" });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">توحيد النشر والمزامنة</h1>
          <p className="text-sm text-muted-foreground">
            نفس المنصة ونفس البيانات على كل النطاقات والعقد المحلية.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw className="w-4 h-4" /> تحديث
          </Button>
          <Button onClick={doPublishAll} disabled={busy === "all"} className="gap-2">
            <Rocket className="w-4 h-4" /> نشر للجميع
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="gap-2"><Plus className="w-4 h-4" /> وجهة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة وجهة نشر</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>الاسم</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>النوع</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Target["kind"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain">نطاق عام</SelectItem>
                      <SelectItem value="local_node">عقدة محلية</SelectItem>
                      <SelectItem value="local_db">قاعدة بيانات محلية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>العنوان</Label>
                  <Input dir="ltr" placeholder="https://example.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                {form.kind !== "domain" && (
                  <>
                    <div className="space-y-1">
                      <Label>السيرفر</Label>
                      <Select value={form.serverId} onValueChange={(v) => setForm({ ...form, serverId: v })}>
                        <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
                        <SelectContent>
                          {servers.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name || s.hostname}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>اسم الخدمة</Label>
                        <Input dir="ltr" value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>المنفذ</Label>
                        <Input dir="ltr" inputMode="numeric" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label>رابط فحص الصحة (اختياري)</Label>
                  <Input dir="ltr" value={form.healthUrl} onChange={(e) => setForm({ ...form, healthUrl: e.target.value })} />
                </div>
                <Button onClick={submit} className="w-full">حفظ</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</CardContent></Card>}
        {targets.map((t) => {
          const Meta = KIND_META[t.kind] ?? KIND_META.domain;
          const Icon = Meta.icon;
          return (
            <Card key={t.id} className={t.is_canonical ? "border-primary/50" : undefined}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    {t.label}
                  </span>
                  {t.is_canonical && (
                    <Badge className="gap-1 bg-primary/15 text-primary border-primary/30">
                      <Star className="w-3 h-3" /> رسمي
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p dir="ltr" className="truncate font-mono text-xs text-muted-foreground">{t.url}</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{Meta.label}</span>
                  <StatusBadge status={t.last_status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>آخر نشر: {fmt(t.last_publish_at)}</span>
                  {t.last_version && <span dir="ltr">v{t.last_version}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={async (v) => { await toggle({ data: { id: t.id, active: v } }); refresh(); }}
                    />
                    <span className="text-xs text-muted-foreground">نشِط</span>
                  </div>
                  <div className="flex gap-1">
                    {!t.is_canonical && t.kind === "domain" && (
                      <Button size="icon" variant="ghost" title="اجعله النطاق الرسمي"
                        onClick={async () => { await canonical({ data: { id: t.id } }); refresh(); }}>
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="حذف"
                      onClick={async () => { await remove({ data: { id: t.id } }); refresh(); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" className="gap-1" disabled={busy === t.id} onClick={() => doPublish(t.id)}>
                      <Rocket className="w-3.5 h-3.5" /> نشر الآن
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">سجل عمليات النشر</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">لا توجد عمليات بعد.</p>}
          {runs.map((r: any) => {
            const t = targets.find((x) => x.id === r.target_id);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                <span className="font-medium">{t?.label ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                <StatusBadge status={r.status} />
                <span dir="ltr" className="w-full font-mono text-xs text-muted-foreground">
                  {r.error || r.output || ""}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
