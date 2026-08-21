import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe, Users, Activity,
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, Home,
  Layers, ArrowUpRight, Clock, Database, HardDrive, Server, Cpu, BrainCircuit,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LiveBackdrop, Tilt3D, CountUp, Beacon, LivePulse } from "@/components/visual/LiveScene";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "لوحة التحكم الحيّة — TVCC" },
      { name: "description", content: "مركز تحكم حي لمواقعك وسيرفراتك ونماذج الذكاء الاصطناعي." },
    ],
  }),
});

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `منذ ${Math.floor(d)} ثانية`;
  if (d < 3600) return `منذ ${Math.floor(d / 60)} دقيقة`;
  if (d < 86400) return `منذ ${Math.floor(d / 3600)} ساعة`;
  return `منذ ${Math.floor(d / 86400)} يوم`;
}

function DashboardPage() {
  const live = { refetchInterval: 15000 } as const;

  const { data: websites } = useQuery({
    queryKey: ["dash-websites"],
    queryFn: async () => (await supabase.from("websites").select("*").order("created_at", { ascending: false })).data || [],
    ...live,
  });
  const { data: clients } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id,full_name,website_id")).data || [],
    ...live,
  });
  const { data: subs } = useQuery({
    queryKey: ["dash-subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("id,price,plan_name,status")).data || [],
    ...live,
  });
  const { data: activity } = useQuery({
    queryKey: ["dash-activity"],
    queryFn: async () => (await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(6)).data || [],
    ...live,
  });
  const { data: servers } = useQuery({
    queryKey: ["dash-servers"],
    queryFn: async () => (await supabase.from("servers").select("id,name,hostname,status,network_kind,last_seen_at,is_tvcc_node,vcpu,ram_mb").order("name")).data || [],
    ...live,
  });
  const { data: metrics } = useQuery({
    queryKey: ["dash-metrics"],
    queryFn: async () => (await supabase.from("server_metrics").select("server_id,cpu_percent,mem_used_mb,mem_total_mb,collected_at").order("collected_at", { ascending: false }).limit(60)).data || [],
    ...live,
  });
  const { data: models } = useQuery({
    queryKey: ["dash-models"],
    queryFn: async () => (await supabase.from("ai_models").select("id,name,kind,status,is_active,last_latency_ms,is_default").order("priority")).data || [],
    ...live,
  });

  const total = websites?.length || 0;
  const online = websites?.filter((w) => w.status === "online").length || 0;
  const warning = websites?.filter((w) => w.status === "pending").length || 0;
  const offline = websites?.filter((w) => w.status === "offline").length || 0;
  const revenue = subs?.reduce((s, x) => s + Number(x.price || 0), 0) || 0;
  const systemOk = offline === 0 && warning < 2;

  const serversOnline = servers?.filter((s) => s.status === "online").length || 0;
  const activeModels = models?.filter((m) => m.is_active).length || 0;

  const latestMetric = (sid: string) => metrics?.find((m) => m.server_id === sid);

  const stats = [
    { label: "إجمالي المواقع", value: total, sub: "جميع المواقع", icon: Globe, tone: "primary" },
    { label: "متصلة الآن", value: online, sub: `من ${total} موقع`, icon: CheckCircle2, tone: "success" },
    { label: "تحذيرات", value: warning, sub: "بحاجة لمراجعة", icon: AlertTriangle, tone: "warning" },
    { label: "غير متصلة", value: offline, sub: "تحتاج تدخل", icon: XCircle, tone: "destructive" },
    { label: "العملاء", value: clients?.length || 0, sub: "إجمالي العملاء", icon: Users, tone: "info" },
  ] as const;

  const toneMap: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
    primary: { ring: "ring-primary/40", text: "text-primary", bg: "bg-primary/15", glow: "shadow-[0_0_30px_-10px_oklch(0.7_0.18_245/0.5)]" },
    success: { ring: "ring-success/40", text: "text-success", bg: "bg-success/15", glow: "shadow-[0_0_30px_-10px_oklch(0.78_0.2_150/0.5)]" },
    warning: { ring: "ring-warning/40", text: "text-warning", bg: "bg-warning/15", glow: "shadow-[0_0_30px_-10px_oklch(0.78_0.18_60/0.5)]" },
    destructive: { ring: "ring-destructive/40", text: "text-destructive", bg: "bg-destructive/15", glow: "shadow-[0_0_30px_-10px_oklch(0.65_0.25_25/0.5)]" },
    info: { ring: "ring-accent/40", text: "text-accent-foreground", bg: "bg-accent/30", glow: "" },
  };

  const seg = total ? { on: (online / total) * 100, warn: (warning / total) * 100, off: (offline / total) * 100 } : { on: 0, warn: 0, off: 0 };
  const C = 2 * Math.PI * 60;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Live hero */}
      <Card className="relative overflow-hidden border-primary/25 bg-card/50 rise-in">
        <LiveBackdrop />
        <CardContent className="relative p-6 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border border-primary/30 spin-slow" />
              <div className="absolute inset-2 rounded-full border border-accent/40 spin-slow [animation-direction:reverse]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div className="text-primary/80 w-40">
              <LivePulse seed={2} />
              <p className="text-[11px] text-muted-foreground">نبض المنصة الحي</p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <h1 className="text-3xl font-bold neon-text">لوحة التحكم الحيّة</h1>
              <Layers className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              محرّك نشِط — {total} موقع · {serversOnline}/{servers?.length || 0} سيرفر متصل · {activeModels} نموذج ذكاء مفعّل
            </p>
            <div className="flex items-center gap-2 justify-end mt-2 text-xs text-muted-foreground">
              <Beacon tone={systemOk ? "success" : "warning"} />
              <span>{systemOk ? "جميع الأنظمة تعمل" : "هناك تنبيهات نشطة"}</span>
              <span>·</span>
              <Home className="w-3.5 h-3.5" /> <span>الرئيسية / لوحة التحكم</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((c, i) => {
          const t = toneMap[c.tone];
          return (
            <Tilt3D key={c.label}>
              <Card
                className={`relative overflow-hidden ring-1 ${t.ring} ${t.glow} bg-card/60 backdrop-blur rise-in`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="sweep-line" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-11 h-11 rounded-xl ${t.bg} flex items-center justify-center float-slow`}>
                      <c.icon className={`w-5 h-5 ${t.text}`} />
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${t.text}`}>{c.label}</p>
                      <p className="text-3xl font-bold mt-1 tabular-nums"><CountUp value={c.value} /></p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Tilt3D>
          );
        })}
      </div>

      {/* Banners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`ring-1 ${systemOk ? "ring-success/40" : "ring-warning/40"} bg-card/60 card-3d`}>
          <CardContent className="p-5 flex items-center justify-between">
            <Beacon tone={systemOk ? "success" : "warning"} />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">حالة النظام</p>
              <p className="text-lg font-semibold mt-1">{systemOk ? "جميع الأنظمة تعمل" : "هناك تنبيهات نشطة"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-primary/30 bg-card/60 card-3d">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold mt-1">${revenue.toFixed(0)}</p>
              <p className="text-[11px] text-muted-foreground">{subs?.length || 0} اشتراك</p>
            </div>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-accent/40 bg-card/60 card-3d">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex gap-1">
              <div className="w-9 h-9 rounded-lg bg-success/15 text-success flex items-center justify-center" title="HN-DB">
                <Database className="w-4 h-4" />
              </div>
              <div className="w-9 h-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center" title="HN-Cloud">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">الخدمات الخارجية</p>
              <p className="text-lg font-semibold mt-1">HN-DB · HN-Cloud</p>
              <Link to="/integrations" className="text-[11px] text-primary hover:underline">إدارة التكاملات</Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live servers + AI models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/60 relative overflow-hidden">
          <div className="sweep-line" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/servers">إدارة السيرفرات <ArrowUpRight className="w-3.5 h-3.5" /></Link>
              </Button>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> السيرفرات الحيّة
              </h2>
            </div>
            <div className="space-y-3">
              {(servers || []).slice(0, 5).map((s) => {
                const m = latestMetric(s.id);
                const cpu = Number(m?.cpu_percent ?? 0);
                const memPct = m?.mem_total_mb ? (Number(m.mem_used_mb) / Number(m.mem_total_mb)) * 100 : 0;
                const on = s.status === "online";
                return (
                  <div key={s.id} className="rounded-xl border border-border/60 bg-secondary/20 p-3 card-3d">
                    <div className="flex items-center justify-between">
                      <Badge variant={on ? "default" : "secondary"}>{on ? "متصل" : s.status}</Badge>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <div className="text-sm font-medium">{s.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {s.network_kind === "local" ? "محلي" : "سحابي"} · {timeAgo(s.last_seen_at)}
                            {s.is_tvcc_node ? " · TVCC" : ""}
                          </div>
                        </div>
                        <Beacon tone={on ? "success" : "destructive"} />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Meter label="CPU" pct={cpu} tone="bg-primary" />
                      <Meter label="RAM" pct={memPct} tone="bg-accent" />
                    </div>
                  </div>
                );
              })}
              {!servers?.length && <p className="text-sm text-muted-foreground text-center py-6">لا توجد سيرفرات مسجّلة</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 relative overflow-hidden">
          <div className="sweep-line" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/ai-models">إدارة النماذج <ArrowUpRight className="w-3.5 h-3.5" /></Link>
              </Button>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-primary" /> نماذج الذكاء (سحابي · محلي · سيرفر)
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(models || []).slice(0, 6).map((m) => {
                const on = m.is_active && m.status !== "offline";
                return (
                  <div key={m.id} className="rounded-xl border border-border/60 bg-secondary/20 p-3 card-3d">
                    <div className="flex items-center justify-between">
                      <Beacon tone={on ? "success" : "muted"} />
                      <div className="text-right">
                        <div className="text-sm font-medium flex items-center gap-1 justify-end">
                          {m.is_default && <Badge variant="outline" className="text-[10px]">افتراضي</Badge>}
                          {m.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {m.kind === "cloud" ? "سحابي" : m.kind === "local" ? "محلي" : "سيرفر"}
                          {m.last_latency_ms ? ` · ${m.last_latency_ms}ms` : ""}
                        </div>
                      </div>
                    </div>
                    <div className={on ? "text-success" : "text-muted-foreground/50"}>
                      <LivePulse seed={m.name.length} />
                    </div>
                  </div>
                );
              })}
              {!models?.length && (
                <p className="text-sm text-muted-foreground text-center py-6 sm:col-span-2">
                  لا توجد نماذج بعد — <Link to="/ai-connect" className="text-primary hover:underline">فعّل نموذجاً الآن</Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Websites + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/websites">عرض الكل <ArrowUpRight className="w-3.5 h-3.5" /></Link>
              </Button>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> آخر المواقع
              </h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموقع</TableHead>
                  <TableHead className="text-right">الدومين</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر تحديث</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(websites || []).slice(0, 6).map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-medium">{w.name}</span>
                        <Beacon tone={w.status === "online" ? "success" : w.status === "offline" ? "destructive" : "warning"} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{w.domain}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "online" ? "default" : w.status === "offline" ? "destructive" : "secondary"}>
                        {w.status === "online" ? "متصل" : w.status === "offline" ? "غير متصل" : w.status === "warning" ? "تحذير" : "موقوف"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(w.updated_at)}</TableCell>
                  </TableRow>
                ))}
                {!websites?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">لا توجد مواقع بعد</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold mb-4 text-right flex items-center justify-end gap-2">
              توزيع الحالات <Cpu className="w-4 h-4 text-primary" />
            </h2>
            <div className="relative flex items-center justify-center my-4 scene-3d">
              <svg viewBox="0 0 160 160" className="w-44 h-44 -rotate-90 [transform:rotateX(18deg)]">
                <circle cx="80" cy="80" r="60" fill="none" stroke="var(--muted)" strokeWidth="16" />
                {total > 0 && (
                  <>
                    <circle cx="80" cy="80" r="60" fill="none" stroke="var(--success)" strokeWidth="16"
                      strokeDasharray={`${(seg.on / 100) * C} ${C}`} strokeDashoffset="0" />
                    <circle cx="80" cy="80" r="60" fill="none" stroke="var(--warning)" strokeWidth="16"
                      strokeDasharray={`${(seg.warn / 100) * C} ${C}`} strokeDashoffset={`${-((seg.on / 100) * C)}`} />
                    <circle cx="80" cy="80" r="60" fill="none" stroke="var(--destructive)" strokeWidth="16"
                      strokeDasharray={`${(seg.off / 100) * C} ${C}`} strokeDashoffset={`${-(((seg.on + seg.warn) / 100) * C)}`} />
                  </>
                )}
                <circle cx="80" cy="80" r="72" fill="none" stroke="var(--primary)" strokeWidth="1" className="flow-line opacity-60" />
              </svg>
              <div className="absolute text-center">
                <div className="text-3xl font-bold"><CountUp value={total} /></div>
                <div className="text-[11px] text-muted-foreground">موقع</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">{online}</span><span className="flex items-center gap-2">متصل <span className="w-2 h-2 rounded-full bg-success" /></span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">{warning}</span><span className="flex items-center gap-2">تحذير <span className="w-2 h-2 rounded-full bg-warning" /></span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">{offline}</span><span className="flex items-center gap-2">غير متصل <span className="w-2 h-2 rounded-full bg-destructive" /></span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card className="bg-card/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/activity">عرض جميع العمليات <ArrowUpRight className="w-3.5 h-3.5" /></Link>
            </Button>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> آخر العمليات
            </h2>
          </div>
          {activity?.length ? (
            <ul className="divide-y divide-border/60">
              {activity.map((a: any, i: number) => (
                <li key={a.id} className="py-3 flex items-center justify-between text-sm rise-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  <div className="text-right">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">{a.entity_type || "—"}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد نشاط بعد</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Meter({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>{v.toFixed(0)}%</span>
        <span>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone} transition-all duration-700`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
