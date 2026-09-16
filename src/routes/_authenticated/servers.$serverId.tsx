import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowRight, Cpu, MemoryStick, HardDrive, Activity, Network, Globe, Database, Shield,
  Users, Terminal, Clock, Box, Loader2, Link2, Trash2, Play, Gauge,
} from "lucide-react";
import {
  getServerDetail, setServerRole, grantServerAccess, revokeServerAccess,
  bindPortToDomain, unbindPortDomain, bindPortToSupabase, runServerAction, scheduleServerTask,
} from "@/lib/server-detail.functions";
import { MeshPanel } from "@/components/servers/MeshPanel";
import { AgentPanel } from "@/components/servers/AgentPanel";
import { LiveConsole } from "@/components/servers/LiveConsole";
import { AutostorePanel } from "@/components/servers/AutostorePanel";

export const Route = createFileRoute("/_authenticated/servers/$serverId")({
  component: ServerDetailPage,
  head: () => ({
    meta: [
      { title: "لوحة السيرفر — TVCC" },
      { name: "description", content: "لوحة تحكم كاملة لكل سيرفر: المعالج والذاكرة والتخزين والمنافذ والأدوار والمهام وربط النطاقات." },
      { property: "og:title", content: "لوحة السيرفر — TVCC" },
      { property: "og:description", content: "مؤشرات حية، ربط المنافذ بالنطاقات، أدوار وصلاحيات، ومركز مهام لكل سيرفر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ROLES = [
  { v: "control", l: "تحكم (Controller)" },
  { v: "db_primary", l: "قاعدة بيانات رئيسية" },
  { v: "db_replica", l: "نسخة قاعدة بيانات" },
  { v: "web", l: "خادم ويب" },
  { v: "storage", l: "تخزين" },
  { v: "backup", l: "نسخ احتياطي" },
  { v: "monitor", l: "مراقبة" },
];

const pct = (used?: number | null, total?: number | null) =>
  total && Number(total) > 0 ? Math.min(100, Math.round((Number(used ?? 0) / Number(total)) * 100)) : 0;

function Metric({ icon: Icon, label, value, percent, hint }: any) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground"><Icon className="w-4 h-4" /> {label}</span>
          <span className="font-semibold">{value}</span>
        </div>
        <Progress value={percent} />
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ServerDetailPage() {
  const { serverId } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getServerDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["server-detail", serverId],
    queryFn: () => fetchDetail({ data: { serverId } }),
    refetchInterval: 30_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["server-detail", serverId] });

  const roleFn = useServerFn(setServerRole);
  const grantFn = useServerFn(grantServerAccess);
  const revokeFn = useServerFn(revokeServerAccess);
  const bindDomainFn = useServerFn(bindPortToDomain);
  const unbindFn = useServerFn(unbindPortDomain);
  const bindSupaFn = useServerFn(bindPortToSupabase);
  const actionFn = useServerFn(runServerAction);
  const scheduleFn = useServerFn(scheduleServerTask);

  const [domain, setDomain] = useState("");
  const [bindPort, setBindPort] = useState("3000");
  const [supaPort, setSupaPort] = useState("8000");
  const [supaDir, setSupaDir] = useState("/opt/supabase");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"view" | "operate" | "manage">("view");
  const [taskName, setTaskName] = useState("");
  const [taskType, setTaskType] = useState("health_check");
  const [taskInterval, setTaskInterval] = useState("60");

  const mut = (fn: (v: any) => Promise<any>, ok: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => { toast.success(ok); refresh(); },
      onError: (e: any) => toast.error(e?.message ?? "فشلت العملية"),
    });

  const bindDomain = mut((v) => bindDomainFn({ data: v }), "تم إرسال أمر ربط النطاق بالمنفذ");
  const unbind = mut((v) => unbindFn({ data: v }), "تم فك الربط");
  const bindSupa = mut((v) => bindSupaFn({ data: v }), "تم إرسال أمر ربط Supabase CLI");
  const grant = mut((v) => grantFn({ data: v }), "تم منح الصلاحية");
  const revoke = mut((v) => revokeFn({ data: v }), "تم سحب الصلاحية");
  const setRole = mut((v) => roleFn({ data: v }), "تم تحديث دور السيرفر");
  const action = mut((v) => actionFn({ data: v }), "تم إرسال الأمر إلى الوكيل");
  const schedule = mut((v) => scheduleFn({ data: v }), "تمت جدولة المهمة");

  if (isLoading || !data) {
    return <div className="p-6 space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const s: any = data.server;
  const m: any = data.latest;
  const health = data.health;
  const healthTone = health >= 80 ? "text-success" : health >= 50 ? "text-warning" : "text-destructive";
  const domainOptions = [...data.verifiedDomains, ...data.hnDomains];

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/servers"><ArrowRight className="w-4 h-4 ml-1" /> السيرفرات</Link></Button>
          <div>
            <h1 className="text-xl font-bold">{s.name}</h1>
            <p className="text-xs text-muted-foreground">{s.public_ip || s.hostname || "—"} · {s.os || "—"} · وكيل {s.agent_version || "غير مثبت"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm"><Link to="/servers/$serverId/cockpit" params={{ serverId }}><Gauge className="w-4 h-4 ml-1" /> Cockpit</Link></Button>
          <div className="text-center">
            <div className={`text-2xl font-black ${healthTone}`}>{health}</div>
            <div className="text-[10px] text-muted-foreground">مؤشر الصحة</div>
          </div>
          <Badge variant="outline">{s.status}</Badge>
          <Select value={s.role ?? "web"} onValueChange={(v) => setRole.mutate({ serverId, role: v })}>
            <SelectTrigger className="w-48"><SelectValue placeholder="الدور" /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={Cpu} label="المعالج" value={`${Math.round(Number(m?.cpu_percent ?? 0))}%`} percent={Number(m?.cpu_percent ?? 0)} hint={`الحمل: ${m?.load_avg ?? "—"}`} />
        <Metric icon={MemoryStick} label="الذاكرة" value={`${Math.round(Number(m?.mem_used_mb ?? 0))} / ${Math.round(Number(m?.mem_total_mb ?? 0))} MB`} percent={pct(m?.mem_used_mb, m?.mem_total_mb)} />
        <Metric icon={HardDrive} label="التخزين" value={`${Math.round(Number(m?.disk_used_gb ?? 0))} / ${Math.round(Number(m?.disk_total_gb ?? 0))} GB`} percent={pct(m?.disk_used_gb, m?.disk_total_gb)} />
        <Metric icon={Activity} label="التشغيل" value={m?.uptime_seconds ? `${Math.floor(Number(m.uptime_seconds) / 3600)} ساعة` : "—"} percent={100} hint={`العمليات: ${m?.process_count ?? "—"}`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="ports">المنافذ والربط</TabsTrigger>
          <TabsTrigger value="services">الخدمات والحاويات</TabsTrigger>
          <TabsTrigger value="tasks">المهام والأوامر</TabsTrigger>
          <TabsTrigger value="access">الأدوار والصلاحيات</TabsTrigger>
          <TabsTrigger value="agent">الوكيل والصلاحيات</TabsTrigger>
          <TabsTrigger value="mesh">الشبكة الخاصة والأتمتة</TabsTrigger>
          <TabsTrigger value="autostore">التخزين التلقائي</TabsTrigger>
          <TabsTrigger value="events">الأحداث</TabsTrigger>
        </TabsList>

        <TabsContent value="agent"><AgentPanel serverId={serverId} /></TabsContent>
        <TabsContent value="mesh"><MeshPanel serverId={serverId} /></TabsContent>
        <TabsContent value="autostore" className="pt-4"><AutostorePanel serverId={serverId} /></TabsContent>

        {/* ------------------------------------------------ overview */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><HardDrive className="w-4 h-4" /> الأقراص</h3>
              {data.disks.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p> :
                data.disks.map((d: any) => (
                  <div key={d.id} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{d.mount} <span className="text-muted-foreground">{d.device}</span></span><span>{Math.round(Number(d.used_gb ?? 0))}/{Math.round(Number(d.total_gb ?? 0))} GB</span></div>
                    <Progress value={pct(d.used_gb, d.total_gb)} />
                  </div>
                ))}
            </CardContent></Card>

            <Card><CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Network className="w-4 h-4" /> الشبكة</h3>
              {data.nets.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p> :
                data.nets.map((n: any) => (
                  <div key={n.id} className="flex justify-between text-xs border-b border-border/50 py-1">
                    <span>{n.name}</span>
                    <span className="text-muted-foreground">↓ {Math.round(Number(n.rx_bps ?? 0) / 1024)} KB/s · ↑ {Math.round(Number(n.tx_bps ?? 0) / 1024)} KB/s</span>
                  </div>
                ))}
              <div className="pt-2 text-xs text-muted-foreground space-y-1">
                <div>IP عام: {s.public_ip || "—"} · خاص: {s.private_ip || "—"}</div>
                {data.ipHistory.slice(0, 3).map((h: any) => (
                  <div key={h.id}>تغيّر إلى {h.public_ip} — {new Date(h.detected_at).toLocaleString("ar")}</div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------ ports */}
        <TabsContent value="ports" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> ربط منفذ باسم نطاق مُثبت الملكية</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">النطاق</Label>
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger><SelectValue placeholder="اختر نطاقاً مُثبتاً" /></SelectTrigger>
                    <SelectContent>
                      {domainOptions.length === 0 ? <SelectItem value="__none" disabled>لا توجد نطاقات مُثبتة</SelectItem> :
                        domainOptions.map((d: any) => <SelectItem key={d.domain} value={d.domain}>{d.domain}{d.kind === "hn" ? " (.HN)" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المنفذ</Label>
                  <Input value={bindPort} onChange={(e) => setBindPort(e.target.value)} inputMode="numeric" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={!domain || bindDomain.isPending}
                  onClick={() => bindDomain.mutate({ serverId, domain, port: Number(bindPort) })}>
                  {bindDomain.isPending ? <Loader2 className="w-3 h-3 ml-1 animate-spin" /> : <Link2 className="w-3 h-3 ml-1" />} ربط + SSL
                </Button>
                <Button size="sm" variant="outline" disabled={!domain}
                  onClick={() => bindDomain.mutate({ serverId, domain, port: Number(bindPort), dryRun: true })}>محاكاة</Button>
              </div>
              {data.unverifiedDomains.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  نطاقات غير مُثبتة ({data.unverifiedDomains.length}): تحقق منها أولاً من صفحة المواقع لتصبح قابلة للربط.
                </p>
              )}
            </CardContent></Card>

            <Card><CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Database className="w-4 h-4" /> ربط منفذ بـ Supabase CLI</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">منفذ البوابة</Label><Input value={supaPort} onChange={(e) => setSupaPort(e.target.value)} inputMode="numeric" /></div>
                <div className="space-y-1"><Label className="text-xs">مجلد المشروع</Label><Input value={supaDir} onChange={(e) => setSupaDir(e.target.value)} /></div>
              </div>
              <Button size="sm" disabled={bindSupa.isPending}
                onClick={() => bindSupa.mutate({ serverId, port: Number(supaPort), projectDir: supaDir })}>
                {bindSupa.isPending ? <Loader2 className="w-3 h-3 ml-1 animate-spin" /> : <Database className="w-3 h-3 ml-1" />} ربط وفحص
              </Button>
            </CardContent></Card>
          </div>

          <Card><CardContent className="p-4 space-y-2">
            <h3 className="font-semibold">المنافذ المفتوحة ({data.ports.length})</h3>
            <div className="max-h-72 overflow-y-auto text-sm">
              {data.ports.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between border-b border-border/50 py-1.5">
                  <span className="font-mono">{p.address}:{p.port}/{p.protocol}</span>
                  <span className="text-muted-foreground text-xs">{p.process_name || p.service || "—"}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setBindPort(String(p.port)); toast.info(`تم اختيار المنفذ ${p.port} للربط`); }}>ربط بنطاق</Button>
                </div>
              ))}
              {data.ports.length === 0 && <p className="text-muted-foreground text-sm">لا توجد منافذ مُبلّغ عنها بعد.</p>}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4 space-y-2">
            <h3 className="font-semibold">الروابط الحالية ({data.links.length})</h3>
            {data.links.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm">
                <span>{l.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{l.link_kind ?? l.bridge_kind}</Badge>
                  <Badge variant="outline">{l.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => unbind.mutate({ id: l.id })}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
            {data.links.length === 0 && <p className="text-muted-foreground text-sm">لا توجد روابط.</p>}
          </CardContent></Card>
        </TabsContent>

        {/* ------------------------------------------------ services */}
        <TabsContent value="services" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> الخدمات ({data.services.length})</h3>
              <div className="max-h-80 overflow-y-auto">
                {data.services.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm">
                    <span className="font-mono text-xs">{v.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={v.status === "active" ? "text-success" : "text-muted-foreground"}>{v.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => action.mutate({ serverId, action: "service_restart", args: { name: v.name } })}>إعادة تشغيل</Button>
                    </div>
                  </div>
                ))}
                {data.services.length === 0 && <p className="text-muted-foreground text-sm">لا توجد بيانات.</p>}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2"><Box className="w-4 h-4" /> الحاويات ({data.containers.length})</h3>
              <div className="max-h-80 overflow-y-auto">
                {data.containers.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm">
                    <span className="font-mono text-xs">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.state} · {c.cpu_pct ?? 0}% · {c.mem_mb ?? 0}MB</span>
                  </div>
                ))}
                {data.containers.length === 0 && <p className="text-muted-foreground text-sm">لا توجد حاويات.</p>}
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------ tasks */}
        <TabsContent value="tasks" className="space-y-4 pt-4">
          <Card><CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Terminal className="w-4 h-4" /> أوامر سريعة</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { a: "restore_all", l: "استعادة كل الخدمات" },
                { a: "scan_ports", l: "فحص المنافذ" },
                { a: "nginx_test", l: "اختبار Nginx" },
                { a: "nginx_reload", l: "إعادة تحميل Nginx" },
                { a: "disk_usage", l: "استهلاك القرص" },
                { a: "firewall_list", l: "قواعد الجدار الناري" },
              ].map((c) => (
                <Button key={c.a} size="sm" variant="outline" onClick={() => action.mutate({ serverId, action: c.a })}>
                  <Play className="w-3 h-3 ml-1" /> {c.l}
                </Button>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> جدولة مهمة</h3>
            <div className="grid gap-2 md:grid-cols-4">
              <Input placeholder="اسم المهمة" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_check">فحص صحة</SelectItem>
                  <SelectItem value="site_backup">نسخ احتياطي</SelectItem>
                  <SelectItem value="db_sync">مزامنة قاعدة بيانات</SelectItem>
                  <SelectItem value="scan_ports">فحص المنافذ</SelectItem>
                </SelectContent>
              </Select>
              <Input value={taskInterval} onChange={(e) => setTaskInterval(e.target.value)} inputMode="numeric" placeholder="كل كم دقيقة" />
              <Button disabled={!taskName || schedule.isPending}
                onClick={() => schedule.mutate({ serverId, name: taskName, taskType, intervalMinutes: Number(taskInterval) })}>جدولة</Button>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4 space-y-2">
            <h3 className="font-semibold">آخر الأوامر</h3>
            <div className="max-h-72 overflow-y-auto text-sm">
              {data.commands.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between border-b border-border/50 py-1.5">
                  <span className="font-mono text-xs">{c.action}{c.dry_run ? " (محاكاة)" : ""}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</span>
                  </div>
                </div>
              ))}
              {data.commands.length === 0 && <p className="text-muted-foreground">لا توجد أوامر.</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ------------------------------------------------ access */}
        <TabsContent value="access" className="space-y-4 pt-4">
          <Card><CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> صلاحيات هذا السيرفر</h3>
            <div className="grid gap-2 md:grid-cols-3">
              <Input placeholder="بريد المستخدم" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Select value={level} onValueChange={(v) => setLevel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">مشاهدة</SelectItem>
                  <SelectItem value="operate">تشغيل</SelectItem>
                  <SelectItem value="manage">إدارة كاملة</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={!email || grant.isPending} onClick={() => grant.mutate({ serverId, email, level })}>منح الصلاحية</Button>
            </div>
            <div className="text-sm">
              {data.access.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between border-b border-border/50 py-1.5">
                  <span className="font-mono text-xs">{a.user_id}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{a.level}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate({ id: a.id })}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
              {data.access.length === 0 && <p className="text-muted-foreground">لم تُمنح صلاحيات بعد — المالك ومدير المنصة فقط.</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ------------------------------------------------ events */}
        <TabsContent value="events" className="pt-4">
          <Card><CardContent className="p-4 space-y-2">
            {data.events.map((e: any) => (
              <div key={e.id} className="border-b border-border/50 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={e.severity === "warning" ? "text-warning" : e.severity === "error" ? "text-destructive" : ""}>{e.kind}</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString("ar")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 break-words">{e.message}</p>
              </div>
            ))}
            {data.events.length === 0 && <p className="text-muted-foreground text-sm">لا توجد أحداث.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <LiveConsole serverId={serverId} />
    </div>
  );
}
