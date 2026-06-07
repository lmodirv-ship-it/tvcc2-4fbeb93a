import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe, Users, CreditCard, Database, Activity, HardDrive,
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, Home,
  Layers, ArrowUpRight, Clock,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "لوحة التحكم — TVCC" }] }),
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
  const { data: websites } = useQuery({
    queryKey: ["dash-websites"],
    queryFn: async () => (await supabase.from("websites").select("*").order("created_at", { ascending: false })).data || [],
  });
  const { data: clients } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id,full_name,website_id")).data || [],
  });
  const { data: subs } = useQuery({
    queryKey: ["dash-subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("id,price,plan_name,status")).data || [],
  });
  const { data: dbs } = useQuery({
    queryKey: ["dash-dbs"],
    queryFn: async () => (await supabase.from("databases").select("id,size_mb,status")).data || [],
  });
  const { data: storages } = useQuery({
    queryKey: ["dash-storages"],
    queryFn: async () => (await supabase.from("storages").select("id,used_gb,size_gb,status")).data || [],
  });
  const { data: activity } = useQuery({
    queryKey: ["dash-activity"],
    queryFn: async () => (await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(6)).data || [],
  });

  const total = websites?.length || 0;
  const online = websites?.filter((w) => w.status === "online").length || 0;
  const warning = websites?.filter((w) => w.status === "pending").length || 0;
  const offline = websites?.filter((w) => w.status === "offline").length || 0;
  const usedGb = storages?.reduce((s, x) => s + Number(x.used_gb || 0), 0) || 0;
  const revenue = subs?.reduce((s, x) => s + Number(x.price || 0), 0) || 0;
  const systemOk = offline === 0 && warning < 2;

  const stats = [
    { label: "إجمالي المواقع", value: total, sub: "جميع المواقع", icon: Globe, tone: "primary" },
    { label: "متصلة الآن", value: online, sub: `من ${total} موقع`, icon: CheckCircle2, tone: "success" },
    { label: "تحذيرات", value: warning, sub: "بحاجة لمراجعة", icon: AlertTriangle, tone: "warning" },
    { label: "غير متصلة", value: offline, sub: "تحتاج تدخل", icon: XCircle, tone: "destructive" },
    { label: "العملاء", value: clients?.length || 0, sub: "إجمالي العملاء", icon: Users, tone: "info" },
  ] as const;

  const toneMap: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
    primary: { ring: "ring-primary/40", text: "text-primary", bg: "bg-primary/15", glow: "shadow-[0_0_30px_-10px_hsl(var(--primary)/0.5)]" },
    success: { ring: "ring-success/40", text: "text-success", bg: "bg-success/15", glow: "shadow-[0_0_30px_-10px_hsl(var(--success)/0.5)]" },
    warning: { ring: "ring-warning/40", text: "text-warning", bg: "bg-warning/15", glow: "shadow-[0_0_30px_-10px_hsl(var(--warning)/0.5)]" },
    destructive: { ring: "ring-destructive/40", text: "text-destructive", bg: "bg-destructive/15", glow: "shadow-[0_0_30px_-10px_hsl(var(--destructive)/0.5)]" },
    info: { ring: "ring-accent/40", text: "text-accent-foreground", bg: "bg-accent/30", glow: "" },
  };

  // Donut chart percentages
  const seg = total ? { on: (online / total) * 100, warn: (warning / total) * 100, off: (offline / total) * 100 } : { on: 0, warn: 0, off: 0 };
  const C = 2 * Math.PI * 60;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Home className="w-3.5 h-3.5" />
          <span>الرئيسية</span>
          <span>/</span>
          <span className="text-foreground">لوحة التحكم</span>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <h1 className="text-3xl font-bold">لوحة التحكم</h1>
            <Layers className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على المواقع، الموارد، والاشتراكات</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((c) => {
          const t = toneMap[c.tone];
          return (
            <Card key={c.label} className={`relative overflow-hidden ring-1 ${t.ring} ${t.glow} bg-card/60 backdrop-blur`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-11 h-11 rounded-xl ${t.bg} flex items-center justify-center`}>
                    <c.icon className={`w-5 h-5 ${t.text}`} />
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${t.text}`}>{c.label}</p>
                    <p className="text-3xl font-bold mt-1">{c.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* System status banner + revenue + storage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`ring-1 ${systemOk ? "ring-success/40" : "ring-warning/40"} bg-card/60`}>
          <CardContent className="p-5 flex items-center justify-between">
            <div className={`w-3 h-3 rounded-full ${systemOk ? "bg-success" : "bg-warning"} shadow-[0_0_12px_currentColor] ${systemOk ? "text-success" : "text-warning"}`} />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">حالة النظام</p>
              <p className="text-lg font-semibold mt-1">{systemOk ? "جميع الأنظمة تعمل" : "هناك تنبيهات نشطة"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-primary/30 bg-card/60">
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

        <Card className="ring-1 ring-accent/40 bg-card/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-accent/30 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">التخزين المستخدم</p>
              <p className="text-2xl font-bold mt-1">{usedGb.toFixed(1)} <span className="text-sm text-muted-foreground">GB</span></p>
              <p className="text-[11px] text-muted-foreground">{storages?.length || 0} مساحة · {dbs?.length || 0} قاعدة بيانات</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main grid: websites table + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Websites table */}
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
                {(websites || []).slice(0, 6).map((w: any) => {
                  const dot = w.status === "online" ? "bg-success" : w.status === "offline" ? "bg-destructive" : "bg-warning";
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="font-medium">{w.name}</span>
                          <span className={`w-2 h-2 rounded-full ${dot}`} />
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
                  );
                })}
                {!websites?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">لا توجد مواقع بعد</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Donut chart */}
        <Card className="bg-card/60">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold mb-4 text-right flex items-center justify-end gap-2">
              توزيع الحالات <Activity className="w-4 h-4 text-primary" />
            </h2>
            <div className="flex items-center justify-center my-4">
              <svg viewBox="0 0 160 160" className="w-44 h-44 -rotate-90">
                <circle cx="80" cy="80" r="60" fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
                {total > 0 && (
                  <>
                    <circle cx="80" cy="80" r="60" fill="none" stroke="hsl(var(--success))" strokeWidth="16"
                      strokeDasharray={`${(seg.on / 100) * C} ${C}`} strokeDashoffset="0" />
                    <circle cx="80" cy="80" r="60" fill="none" stroke="hsl(var(--warning))" strokeWidth="16"
                      strokeDasharray={`${(seg.warn / 100) * C} ${C}`} strokeDashoffset={`${-((seg.on / 100) * C)}`} />
                    <circle cx="80" cy="80" r="60" fill="none" stroke="hsl(var(--destructive))" strokeWidth="16"
                      strokeDasharray={`${(seg.off / 100) * C} ${C}`} strokeDashoffset={`${-(((seg.on + seg.warn) / 100) * C)}`} />
                  </>
                )}
              </svg>
              <div className="absolute text-center">
                <div className="text-3xl font-bold">{total}</div>
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

      {/* Activity log */}
      <Card className="bg-card/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/dashboard">عرض جميع العمليات <ArrowUpRight className="w-3.5 h-3.5" /></Link>
            </Button>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> آخر العمليات
            </h2>
          </div>
          {activity?.length ? (
            <ul className="divide-y divide-border/60">
              {activity.map((a: any) => (
                <li key={a.id} className="py-3 flex items-center justify-between text-sm">
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
