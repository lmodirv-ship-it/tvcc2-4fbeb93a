import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LighthouseScene } from "@/components/manara/LighthouseScene";
import {
  Globe, Smartphone, Code, Activity, Route as RouteIcon, AlertTriangle, CheckCircle2,
  Clock, XCircle, RefreshCw, ArrowLeft, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { listManara, changeAddress, verifyAddress, publishAddress, healRouting } from "@/lib/manara.functions";

export const Route = createFileRoute("/_authenticated/manara")({
  component: ManaraPage,
  head: () => ({
    meta: [
      { title: "منارة — مركز التوجيه الحي — TVCC" },
      { name: "description", content: "نظام اكتشاف وتوجيه ومزامنة العناوين داخل TVCC." },
      { property: "og:title", content: "منارة — مركز التوجيه الحي — TVCC" },
      { property: "og:description", content: "المصدر الوحيد للحقيقة لعناوين مشاريع المجموعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StatusBadge({ status }: { status: string | null }) {
  if (status === "completed" || status === "active" || status === "online")
    return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> مكتمل</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> فشل</Badge>;
  if (status === "pending" || status === "publishing")
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> قيد النشر</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">معلق</Badge>;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

function ManaraPage() {
  const qc = useQueryClient();
  const list = useServerFn(listManara);
  const change = useServerFn(changeAddress);
  const verify = useServerFn(verifyAddress);
  const publish = useServerFn(publishAddress);
  const heal = useServerFn(healRouting);

  const [keyInput, setKeyInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["manara"],
    queryFn: () => list({ data: {} as never }),
    refetchInterval: 300000,
  });

  const projects = (data?.projects ?? []) as any[];
  const updates = (data?.updates ?? []) as any[];
  const events = (data?.events ?? []) as any[];
  const refresh = () => qc.invalidateQueries({ queryKey: ["manara"] });

  const submitChange = async () => {
    if (!keyInput || !urlInput) return;
    setBusy("change");
    try {
      await change({ data: { key: keyInput.trim().toUpperCase(), url: urlInput.trim() } });
      toast.success("تم تسجيل العنوان الجديد");
      setKeyInput("");
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

  const doHeal = async (key: string) => {
    setBusy(`heal-${key}`);
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

  const stats = {
    total: projects.length,
    current: projects.filter((p) => p.current_address?.is_verified).length,
    pending: updates.filter((u) => u.status === "pending").length,
    failed: updates.filter((u) => u.status === "failed").length,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V6z"/><circle cx="12" cy="10" r="3"/></svg>
            منارة — مركز التوجيه الحي
          </h1>
          <p className="text-sm text-muted-foreground">المصدر الوحيد للحقيقة لعناوين مشاريع المجموعة</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </header>

      <Card className="relative overflow-hidden border-primary/20" style={{ minHeight: 340 }}>
        <div className="absolute inset-0">
          <LighthouseScene active={stats.current > 0} />
        </div>
        <div className="relative z-10 p-6 flex flex-col items-center justify-center text-center gap-4" style={{ minHeight: 340 }}>
          <h2 className="text-3xl font-bold drop-shadow-lg">منارة</h2>
          <p className="max-w-xl text-sm text-white/80 drop-shadow">اكتشف العنوان الحالي لأي مشروع بالمعرّف الثابت، وانشر التحديثات لكل التطبيقات والمواقع.</p>
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <Input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="معرّف المشروع IDXXXXX"
              className="w-44 bg-black/40 border-white/20"
            />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="العنوان الجديد"
              className="w-64 bg-black/40 border-white/20"
            />
            <Button onClick={submitChange} disabled={busy === "change" || !keyInput || !urlInput} className="gap-1">
              <Plus className="w-4 h-4" /> نشر
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/10"><CardContent className="p-4 flex items-center gap-3"><Globe className="w-8 h-8 text-primary" /><div><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">المشاريع المسجلة</div></div></CardContent></Card>
        <Card className="border-success/20"><CardContent className="p-4 flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-success" /><div><div className="text-2xl font-bold">{stats.current}</div><div className="text-xs text-muted-foreground">عناوين متحققة</div></div></CardContent></Card>
        <Card className="border-warning/20"><CardContent className="p-4 flex items-center gap-3"><Clock className="w-8 h-8 text-warning" /><div><div className="text-2xl font-bold">{stats.pending}</div><div className="text-xs text-muted-foreground">قيد النشر</div></div></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-destructive" /><div><div className="text-2xl font-bold">{stats.failed}</div><div className="text-xs text-muted-foreground">فاشلة</div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RouteIcon className="w-5 h-5 text-primary" /> المسارات الحية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-muted-foreground text-sm">جارٍ التحميل...</div>
            ) : projects.length === 0 ? (
              <div className="text-muted-foreground text-sm">لا توجد مشاريع مسجلة بعد.</div>
            ) : (
              projects.slice(0, 20).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      <Link to="/manara/$key" params={{ key: p.project_key }} className="hover:text-primary hover:underline">{p.name}</Link>
                      <Badge variant="outline" className="text-[10px]">{p.project_key}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {p.current_address ? (
                        <><Globe className="w-3 h-3" /> {p.current_address.url}</>
                      ) : (
                        "لا يوجد عنوان حالي"
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.current_address?.is_verified ? (
                      <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="w-3 h-3" /> متحقق</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> غير متحقق</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => doHeal(p.project_key)} disabled={busy === `heal-${p.project_key}`}>تصحيح</Button>
                    <Button size="sm" variant="ghost" asChild><Link to="/manara/$key" params={{ key: p.project_key }}><ArrowLeft className="w-4 h-4" /></Link></Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> النشاط المباشر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-auto">
            {events.slice(0, 30).map((e: any) => (
              <div key={e.id} className="text-xs border-b border-border/30 pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.kind}</span>
                  <span className="text-muted-foreground">{fmt(e.created_at)}</span>
                </div>
                <div className="text-muted-foreground truncate">{e.message}</div>
              </div>
            ))}
            {events.length === 0 && <div className="text-sm text-muted-foreground">لا توجد أحداث حديثة.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5 text-primary" /> تحديثات العناوين</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {updates.slice(0, 15).map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
              <div className="space-y-1">
                <div className="text-sm font-medium">{u.reason}</div>
                <div className="text-xs text-muted-foreground">
                  من {u.from?.url || "—"} ← إلى {u.to?.url || "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={u.status} />
                {u.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => doVerify(u.to_address_id)} disabled={busy === `verify-${u.to_address_id}`}>تحقق</Button>
                    <Button size="sm" onClick={() => doPublish(u.id)} disabled={busy === `pub-${u.id}`}>نشر</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {updates.length === 0 && <div className="text-sm text-muted-foreground">لا توجد عمليات تحديث.</div>}
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> شارة منارة للمواقع</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">أضف هذا السكربت أسفل أي موقع في المجموعة ليظهر رمز المنارة ويربط تلقائياً بالعنوان الصحيح:</p>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto ltr text-left" dir="ltr">
{`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/public/manara/badge.js" data-key="IDXXXXX"></script>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
