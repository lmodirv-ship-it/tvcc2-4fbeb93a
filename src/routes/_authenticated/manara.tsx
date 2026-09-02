import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LighthouseScene } from "@/components/manara/LighthouseScene";
import {
  Globe, Smartphone, Code, Activity, Route as RouteIcon, AlertTriangle, CheckCircle2,
  Clock, XCircle, RefreshCw, ArrowLeft, Plus, Server, ShieldCheck, Database, Cpu,
  Search, Send, ChevronLeft,
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

function timeAgo(d: string | null) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `منذ ${s} ثانية`;
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

function parseHostPort(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const port = u.port || (u.protocol === "https:" ? 443 : 80);
    return { host: u.hostname, port };
  } catch {
    return { host: url, port: 443 };
  }
}

function endpointIcon(kind: string) {
  if (kind === "apk" || kind === "android") return <Smartphone className="w-4 h-4" />;
  if (kind === "pwa") return <Code className="w-4 h-4" />;
  if (kind === "api" || kind === "service") return <Code className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
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
    completed: updates.filter((u) => u.status === "completed").length,
    suspended: updates.filter((u) => u.status === "suspended").length,
  };

  const liveRoutes = projects.slice(0, 3);
  const endpoints = projects.flatMap((p) => (p.endpoints ?? []).map((e: any) => ({ ...e, project: p }))).slice(0, 4);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 space-y-5">
      {/* Top utility bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <RouteIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">منارة — مركز التوجيه الحي</h1>
            <p className="text-xs text-muted-foreground">المصدر الوحيد للحقيقة لعناوين مشاريع المجموعة</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Live routes */}
          <section className="glass-card rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2 text-sm">
                <RouteIcon className="w-4 h-4 text-primary" />
                المسارات الحية
              </h2>
              <Activity className="w-4 h-4 text-success" />
            </div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-muted-foreground text-xs">جارٍ التحميل...</div>
              ) : liveRoutes.length === 0 ? (
                <div className="text-muted-foreground text-xs">لا توجد مسارات حية.</div>
              ) : (
                liveRoutes.map((p) => {
                  const addr = p.current_address;
                  const { host, port } = addr ? parseHostPort(addr.url) : { host: "—", port: 0 };
                  return (
                    <div key={p.id} className="rounded-xl bg-background/40 border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{p.project_key}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{addr?.url || "لا يوجد عنوان"}</div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {host}{port ? `:${port}` : ""}</span>
                        <span className="flex items-center gap-1 text-success"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> متصل</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Link to="/manara" className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
              <ChevronLeft className="w-3 h-3" /> عرض جميع المسارات
            </Link>
          </section>

          {/* Updates donut */}
          <section className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-primary" />
                تحديثات العناوين
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="oklch(0.3 0.03 260)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="oklch(0.78 0.2 150)" strokeWidth="3" strokeDasharray={`${stats.completed ? (stats.completed / Math.max(updates.length, 1)) * 100 : 0}, 100`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold">{updates.length}</span>
                  <span className="text-[10px] text-muted-foreground">إجمالي</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> قيد النشر</span><span>{stats.pending}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> مكتمل</span><span>{stats.completed}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> معلق</span><span>{stats.suspended}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> فشل</span><span>{stats.failed}</span></div>
              </div>
            </div>
            <Link to="/manara" className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
              <ChevronLeft className="w-3 h-3" /> عرض جميع التحديثات
            </Link>
          </section>
        </div>

        {/* Center hero */}
        <div className="lg:col-span-6 space-y-5">
          <section className="glass-card rounded-3xl p-1 relative overflow-hidden min-h-[420px] flex flex-col">
            <div className="absolute inset-0 rounded-3xl overflow-hidden">
              <LighthouseScene active={stats.current > 0} />
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center text-center gap-4 p-6 flex-1">
              <div className="space-y-1">
                <h2 className="text-3xl md:text-4xl font-black">
                  <span className="manara-gold-text">منارة</span>
                  <span className="text-foreground"> — مركز التوجيه الحي</span>
                </h2>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-white/90">متصلة بـ TVCC</span>
                </div>
              </div>
              <Badge className="bg-success/15 text-success border-success/30 gap-1 px-3 py-1">
                <CheckCircle2 className="w-3 h-3" /> جميع المسارات متزامنة
              </Badge>

              <div className="w-full max-w-lg mt-4">
                <div className="flex flex-wrap items-center gap-2 bg-background/60 border border-border/60 rounded-2xl p-2 backdrop-blur">
                  <div className="flex-1 min-w-[180px] relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="معرّف المشروع IDXXXXX"
                      className="pr-9 bg-transparent border-0 focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex-[2] min-w-[220px] relative">
                    <Globe className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="أدخل العنوان الجديد..."
                      className="pr-9 bg-transparent border-0 focus-visible:ring-0"
                    />
                  </div>
                  <Button
                    onClick={submitChange}
                    disabled={busy === "change" || !keyInput || !urlInput}
                    className="rounded-xl w-12 h-12 p-0 bg-gradient-to-br from-manara-gold to-warning hover:opacity-90 shadow-lg shadow-manara-gold/20"
                  >
                    <Send className="w-5 h-5 text-background" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <Globe className="w-8 h-8 text-primary" />
              <div>
                <div className="text-xl font-bold">{stats.total}</div>
                <div className="text-[10px] text-muted-foreground">المشاريع المسجلة</div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-success" />
              <div>
                <div className="text-xl font-bold">{stats.current}</div>
                <div className="text-[10px] text-muted-foreground">عناوين متحققة</div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <Clock className="w-8 h-8 text-warning" />
              <div>
                <div className="text-xl font-bold">{stats.pending}</div>
                <div className="text-[10px] text-muted-foreground">قيد النشر</div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <div className="text-xl font-bold">{stats.failed}</div>
                <div className="text-[10px] text-muted-foreground">فاشلة</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Sites & apps */}
          <section className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-primary" />
                المواقع والتطبيقات
              </h2>
            </div>
            <div className="space-y-2">
              {endpoints.length === 0 ? (
                <div className="text-muted-foreground text-xs">لا توجد نقاط نهاية.</div>
              ) : (
                endpoints.map((ep: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/40 border border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {endpointIcon(ep.kind)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{ep.label || ep.kind}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{ep.url || "—"}</div>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-success shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> متصل
                    </span>
                  </div>
                ))
              )}
            </div>
            <Link to="/manara" className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
              <ChevronLeft className="w-3 h-3" /> عرض جميع التطبيقات
            </Link>
          </section>

          {/* Routing points */}
          <section className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2 text-sm">
                <RouteIcon className="w-4 h-4 text-primary" />
                نقاط التوجيه
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "DNS", icon: Database, ok: true },
                { label: "Nginx", icon: Server, ok: true },
                { label: "الخادم", icon: Cpu, ok: true },
                { label: "الوكيل", icon: Activity, ok: true },
              ].map((pt) => (
                <div key={pt.label} className="rounded-xl bg-background/40 border border-border/50 p-3 flex flex-col items-center gap-2 text-center">
                  <pt.icon className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium">{pt.label}</span>
                  <span className="text-[10px] flex items-center gap-1 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> متصل
                  </span>
                </div>
              ))}
            </div>
            <Link to="/manara" className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
              <ChevronLeft className="w-3 h-3" /> عرض جميع نقاط التوجيه
            </Link>
          </section>
        </div>
      </div>

      {/* Bottom activity timeline */}
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-primary" />
            النشاط المباشر
          </h2>
        </div>
        {events.length === 0 ? (
          <div className="text-muted-foreground text-xs">لا توجد أحداث حديثة.</div>
        ) : (
          <div className="relative">
            <svg className="absolute top-6 inset-x-0 h-1 w-full hidden lg:block" preserveAspectRatio="none">
              <line x1="0" y1="0" x2="100%" y2="0" className="lightning-line" />
            </svg>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {events.slice(0, 4).map((e: any, idx: number) => (
                <div key={e.id} className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center z-10">
                      {e.kind === "publish_completed" ? <CheckCircle2 className="w-4 h-4 text-success" /> :
                       e.kind === "verify_fail" ? <XCircle className="w-4 h-4 text-destructive" /> :
                       e.kind === "heal" ? <ShieldCheck className="w-4 h-4 text-primary" /> :
                       <Activity className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="text-xs font-medium">{e.kind}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{e.message}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(e.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Updates list (compact) */}
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2 text-sm">
            <Code className="w-4 h-4 text-primary" />
            تحديثات العناوين الأخيرة
          </h2>
        </div>
        <div className="space-y-2">
          {updates.slice(0, 5).map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-background/40 border border-border/50">
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
        </div>
      </section>

      {/* Badge snippet */}
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-sm">شارة منارة للمواقع</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">أضف هذا السكربت أسفل أي موقع في المجموعة ليظهر رمز المنارة ويربط تلقائياً بالعنوان الصحيح:</p>
        <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto ltr text-left" dir="ltr">
{`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/public/manara/badge" data-key="IDXXXXX"></script>`}
        </pre>
      </section>
    </div>
  );
}
