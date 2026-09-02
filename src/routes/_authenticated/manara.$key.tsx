import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LighthouseScene } from "@/components/manara/LighthouseScene";
import {
  ArrowRight, CheckCircle2, XCircle, Clock, RefreshCw, Globe, History,
  ShieldAlert, RotateCcw, Activity, Smartphone, Code,
} from "lucide-react";
import { toast } from "sonner";
import { getManaraProject, changeAddress, verifyAddress, publishAddress, rollbackAddress, healRouting } from "@/lib/manara.functions";

export const Route = createFileRoute("/_authenticated/manara/$key")({
  component: ManaraDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `منارة — ${params.key} — TVCC` },
      { name: "description", content: "تفاصيل التوجيه الحي للمشروع." },
      { property: "og:title", content: `منارة — ${params.key} — TVCC` },
      { property: "og:description", content: "تفاصيل التوجيه الحي للمشروع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "completed" || status === "active" || status === "online")
    return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> مكتمل</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> فشل</Badge>;
  if (status === "pending" || status === "publishing")
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> قيد النشر</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">معلق</Badge>;
}

function ManaraDetailPage() {
  const { key } = useParams({ from: "/_authenticated/manara/$key" });
  const qc = useQueryClient();
  const get = useServerFn(getManaraProject);
  const change = useServerFn(changeAddress);
  const verify = useServerFn(verifyAddress);
  const publish = useServerFn(publishAddress);
  const rollback = useServerFn(rollbackAddress);
  const heal = useServerFn(healRouting);

  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["manara", key],
    queryFn: () => get({ data: { key } }),
    refetchInterval: 300000,
  });

  const project = data?.project as any;
  const refresh = () => qc.invalidateQueries({ queryKey: ["manara", key] });

  const submitChange = async () => {
    if (!urlInput) return;
    setBusy("change");
    try {
      await change({ data: { key, url: urlInput.trim() } });
      toast.success("تم تسجيل العنوان الجديد");
      setUrlInput("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التسجيل");
    } finally {
      setBusy(null);
    }
  };

  const doVerify = async (id: string) => {
    setBusy(`verify-${id}`);
    try {
      const res = await verify({ data: { addressId: id } });
      toast(res.ok ? "تم التحقق" : "فشل التحقق");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحقق");
    } finally {
      setBusy(null);
    }
  };

  const doPublish = async (id: string) => {
    setBusy(`pub-${id}`);
    try {
      await publish({ data: { updateId: id } });
      toast.success("تم النشر");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل النشر");
    } finally {
      setBusy(null);
    }
  };

  const doRollback = async (id: string) => {
    setBusy(`rollback-${id}`);
    try {
      await rollback({ data: { updateId: id } });
      toast.success("تم التراجع");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التراجع");
    } finally {
      setBusy(null);
    }
  };

  const doHeal = async () => {
    setBusy("heal");
    try {
      await heal({ data: { key } });
      toast.success("تم إرسال أوامر التصحيح");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التصحيح");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !project) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild><Link to="/manara"><ArrowRight className="w-4 h-4" /> رجوع</Link></Button>
        <div className="text-muted-foreground">جارٍ التحميل...</div>
      </div>
    );
  }

  const current = project.current_address;
  const addresses = (project.addresses ?? []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const updates = data?.updates ?? [];
  const events = data?.events ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/manara"><ArrowRight className="w-5 h-5" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {project.name}
              <Badge variant="outline">{project.project_key}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">تفاصيل التوجيه الحي</p>
          </div>
        </div>
        <Button variant="outline" onClick={refresh} className="gap-2"><RefreshCw className="w-4 h-4" /> تحديث</Button>
      </header>

      <Card className="overflow-hidden border-primary/20" style={{ minHeight: 280 }}>
        <div className="absolute inset-0"><LighthouseScene active={current?.is_verified} /></div>
        <div className="relative z-10 p-6 flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: 280 }}>
          <h2 className="text-2xl font-bold drop-shadow-lg">{project.name}</h2>
          <div className="text-lg drop-shadow">{current?.url || "لا يوجد عنوان حالي"}</div>
          <div className="flex items-center gap-2">
            {current?.is_verified ? (
              <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> متحقق</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> غير متحقق</Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/10">
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> تغيير العنوان</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="العنوان الجديد" className="flex-1" />
              <Button onClick={submitChange} disabled={busy === "change" || !urlInput}>تسجيل</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => current && doVerify(current.id)} disabled={busy === `verify-${current?.id}` || !current} className="gap-1"><RefreshCw className="w-4 h-4" /> إعادة الفحص</Button>
              <Button variant="outline" onClick={doHeal} disabled={busy === "heal"} className="gap-1"><ShieldAlert className="w-4 h-4" /> تصحيح التوجيه</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> روابط التطبيقات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(project.endpoints ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">لا توجد نقاط نهاية مسجلة.</div>
            ) : (
              (project.endpoints ?? []).map((ep: any) => (
                <div key={ep.id} className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border/50">
                  <div className="text-sm"><Badge variant="outline" className="ml-2">{ep.kind}</Badge>{ep.label || ep.url}</div>
                  <StatusBadge status={ep.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" /> سجل العناوين</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {addresses.map((a: any) => (
            <div key={a.id} className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border ${a.is_current ? "border-success/40 bg-success/5" : "border-border/50 bg-card/50"}`}>
              <div className="space-y-1">
                <div className="font-medium text-sm">{a.url}</div>
                <div className="text-xs text-muted-foreground">{a.host}{a.port ? `:${a.port}` : ""} • {fmt(a.created_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                {a.is_current && <Badge className="bg-success/15 text-success border-success/30">الحالي</Badge>}
                {a.is_verified ? <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> متحقق</Badge> : <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> غير متحقق</Badge>}
                {!a.is_current && !a.is_verified && <Button size="sm" variant="outline" onClick={() => doVerify(a.id)} disabled={busy === `verify-${a.id}`}>تحقق</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> عمليات التحديث</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {updates.map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
              <div className="space-y-1">
                <div className="text-sm font-medium">{u.reason}</div>
                <div className="text-xs text-muted-foreground">من {u.from?.url || "—"} ← إلى {u.to?.url || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={u.status} />
                {u.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => doVerify(u.to_address_id)} disabled={busy === `verify-${u.to_address_id}`}>تحقق</Button>
                    <Button size="sm" onClick={() => doPublish(u.id)} disabled={busy === `pub-${u.id}`}>نشر</Button>
                  </>
                )}
                {(u.status === "completed" || u.status === "failed") && u.from && (
                  <Button size="sm" variant="outline" onClick={() => doRollback(u.id)} disabled={busy === `rollback-${u.id}`} className="gap-1"><RotateCcw className="w-3 h-3" /> تراجع</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader><CardTitle className="flex items-center gap-2"><Code className="w-5 h-5 text-primary" /> شارة المنارة</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">انسخ هذا السكربت إلى الموقع لربطه تلقائياً:</p>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto ltr text-left" dir="ltr">
{`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/public/manara/badge.js" data-key="${project.project_key}"></script>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
