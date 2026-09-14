import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFederatedOverview } from "@/lib/federated.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radar, HardDrive, Globe, AlertTriangle, Cpu, MemoryStick, Database } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated")({
  component: FederatedOverviewPage,
  head: () => ({ meta: [
    { title: "نظرة عامة فيدرالية — TVCC" },
    { name: "description", content: "إدارة كل المواقع والسيرفرات من مكان واحد" },
  ] }),
});

function pct(a?: number, b?: number) {
  if (!a || !b) return 0;
  return Math.round((a / b) * 100);
}

function FederatedOverviewPage() {
  const fetchOverview = useServerFn(getFederatedOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["federated-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 15000,
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل النظرة الفيدرالية…</div>;

  const metrics = Object.values(data.metrics) as any[];
  const avgCpu = metrics.length ? Math.round(metrics.reduce((s, m) => s + (m.cpu_percent ?? 0), 0) / metrics.length) : 0;
  const avgMem = metrics.length ? Math.round(metrics.reduce((s, m) => s + pct(m.mem_used_bytes, m.mem_total_bytes), 0) / metrics.length) : 0;
  const avgDisk = metrics.length ? Math.round(metrics.reduce((s, m) => s + pct(m.disk_used_bytes, m.disk_total_bytes), 0) / metrics.length) : 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Radar className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">نظرة عامة فيدرالية</h1>
          <p className="text-sm text-muted-foreground">طبولوجيا حية لكل المواقع والسيرفرات من مكان واحد</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">المواقع</div><div className="text-2xl font-bold">{data.totals.websites}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">السيرفرات</div><div className="text-2xl font-bold">{data.totals.servers}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">متصلة</div><div className="text-2xl font-bold text-success">{data.totals.online}</div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /><div><div className="text-xs text-muted-foreground">المعالج</div><div className="text-xl font-bold">{avgCpu}%</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><MemoryStick className="w-4 h-4 text-primary" /><div><div className="text-xs text-muted-foreground">الذاكرة</div><div className="text-xl font-bold">{avgMem}%</div></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2"><Database className="w-4 h-4 text-primary" /><div><div className="text-xs text-muted-foreground">التخزين</div><div className="text-xl font-bold">{avgDisk}%</div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HardDrive className="w-4 h-4" /> خريطة الطبولوجيا</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data.servers as any[]).map((s) => {
              const sites = (data.websites as any[]).filter((w) => w.server_id === s.id);
              return (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Link to="/servers/$serverId" params={{ serverId: s.id }} className="font-medium hover:text-primary">{s.name}</Link>
                    <Badge className={s.status === "online" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}>{s.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.hostname} · {s.role}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sites.length === 0 && <span className="text-xs text-muted-foreground">لا مواقع</span>}
                    {sites.slice(0, 12).map((w) => (
                      <Badge key={w.id} variant="outline" className="text-[10px]">{w.domain}</Badge>
                    ))}
                    {sites.length > 12 && <Badge variant="outline" className="text-[10px]">+{sites.length - 12}</Badge>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="w-4 h-4 text-destructive" /> مركز التنبيهات الحرجة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.alerts as any[]).length === 0 && <p className="text-sm text-muted-foreground">لا تنبيهات مفتوحة — كل شيء سليم.</p>}
            {(data.alerts as any[]).map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-medium text-sm">{a.title}</div>
                  {a.body && <div className="text-xs text-muted-foreground mt-1">{a.body}</div>}
                </div>
                <Badge className={a.severity === "critical" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}>{a.severity}</Badge>
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              آخر الاستنساخات: {data.recentClones.length} · آخر عمليات نشر القوالب: {data.recentDeployments.length} — <Link to="/federated/fleet" className="text-primary">الأسطول</Link>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> يتحدث تلقائياً كل 15 ثانية</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
