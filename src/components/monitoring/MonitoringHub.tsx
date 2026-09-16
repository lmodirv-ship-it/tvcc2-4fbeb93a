import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonitoringOverview, registerMonitoringGraph } from "@/lib/monitoring.functions";
import { getSiteAgentProgram, provisionAllSiteAgents } from "@/lib/site-agents.functions";
import { getAgentInstall } from "@/lib/servers.functions";
import { autoFixAndReport, runHealthCheckAll } from "@/lib/health-check.functions";
import { getSyncScript } from "@/lib/dbsync.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  Database,
  HeartPulse,
  Link2,
  RefreshCw,
  Server as ServerIcon,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { UnifiedTable } from "./UnifiedTable";
import { KeysPanel } from "./KeysPanel";
import { MonitoringCharts } from "./MonitoringCharts";

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(ts?: string | null) {
  return ts ? new Date(ts).toLocaleString("ar", { hour12: false }) : "—";
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function MonitoringHub() {
  const overview = useServerFn(getMonitoringOverview);
  const program = useServerFn(getSiteAgentProgram);
  const provision = useServerFn(provisionAllSiteAgents);
  const agentInstall = useServerFn(getAgentInstall);
  const registerGraph = useServerFn(registerMonitoringGraph);
  const healthAll = useServerFn(runHealthCheckAll);
  const autoFix = useServerFn(autoFixAndReport);
  const syncScript = useServerFn(getSyncScript);

  const [serverId, setServerId] = useState("");
  const [busy, setBusy] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["monitoring-overview"],
    queryFn: () => overview(),
    refetchInterval: 15000,
  });

  const t = data?.totals;

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت العملية");
    } finally {
      setBusy("");
    }
  };

  const downloadSiteProgram = async (websiteId: string, kind: "php" | "node" | "badge") =>
    act("program", async () => {
      const res: any = await program({ data: { websiteId, kind } });
      download(res.filename, res.content);
      toast.success("تم توليد برنامج الموقع");
    });

  if (isLoading || !t || !data) return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل مركز المراقبة…</div>;

  const sources = data.sources as any[];

  return (
    <div className="space-y-4" dir="rtl">
      {/* شريط الأزرار الأفقي */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="اختر سيرفراً" />
            </SelectTrigger>
            <SelectContent>
              {(data.servers as any[]).map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name} · {s.hostname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!!busy}
            onClick={() =>
              act("agent", async () => {
                if (!serverId) throw new Error("اختر سيرفراً أولاً");
                const res: any = await agentInstall({ data: { serverId, origin: window.location.origin } });
                download("tvcc-agent.sh", res.script);
                toast.success("برنامج السيرفر جاهز — نفّذه على السيرفر");
              })
            }
          >
            <ServerIcon className="size-3.5" /> برنامج السيرفر
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!!busy}
            onClick={() =>
              act("beat", async () => {
                const src = sources[0];
                if (!src) throw new Error("لا مصدر مزامنة — أضفه من مركز قواعد البيانات ← المزامنة");
                const res: any = await syncScript({ data: { sourceId: src.id, kind: "heartbeat" } });
                download(res.filename, res.content);
                toast.success("نزّل سكريبت النبضة ثم نفّذه على السيرفر المحلي: node tvcc-heartbeat.js");
              })
            }
          >
            <HeartPulse className="size-3.5" /> نبضة المزامنة
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!!busy}
            onClick={() =>
              act("provision", async () => {
                const res: any = await provision({ data: {} } as any);
                toast.success(`تم تسجيل ${res.created} موقع جديد من أصل ${res.total}`);
              })
            }
          >
            <Link2 className="size-3.5" /> تسجيل كل المواقع
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!!busy}
            onClick={() =>
              act("graph", async () => {
                const res: any = await registerGraph({ data: {} } as any);
                toast.success(`سُجّل في قاعدة البيانات: ${res.entities} كيان و${res.links} علاقة`);
              })
            }
          >
            <Database className="size-3.5" /> تسجيل العلاقات في قاعدة البيانات
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!!busy}
            onClick={() =>
              act("scan", async () => {
                const res: any = await healthAll();
                toast.success(`اكتمل الفحص الشامل: ${res?.online ?? "—"} متصل`);
              })
            }
          >
            <ShieldCheck className="size-3.5" /> فحص شامل الآن
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!!busy}
            onClick={() =>
              act("fix", async () => {
                const res: any = await autoFix();
                const s = res?.summary;
                toast.success(`إصلاح تلقائي: متصلة ${s?.online} · معطلة ${s?.offline} · أُصلح ${s?.fixed}`);
              })
            }
          >
            <Wrench className="size-3.5" /> إصلاح تلقائي + تقرير
          </Button>

          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => refetch()}>
            <RefreshCw className="size-3.5" /> تحديث
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="مواقع نشطة" value={`${t.activeSites}/${t.sites}`} />
        <Stat label="مواقع متصلة بالبرنامج" value={`${t.connectedSites}/${t.sitesWithProgram}`} hint="نبضة خلال 5 دقائق" />
        <Stat label="سيرفرات متصلة" value={`${t.onlineServers}/${t.servers}`} hint={`وكلاء: ${t.onlineAgents}/${t.agents}`} />
        <Stat label="مهام دائمة تعمل" value={`${t.activeSchedules}/${t.schedules}`} />
        <Stat label="مصادر مزامنة متصلة" value={`${t.onlineSources}/${t.sources}`} hint={`جداول: ${t.syncTables}`} />
        <Stat
          label="صفوف محلي / مرآة"
          value={`${t.localRows.toLocaleString("ar")} / ${t.mirrorRows.toLocaleString("ar")}`}
          hint={`الفارق: ${t.rowGap.toLocaleString("ar")}`}
        />
      </div>

      <Tabs defaultValue="entities">
        <TabsList className="flex-wrap">
          <TabsTrigger value="entities" className="text-xs">
            المواقع والسيرفرات
          </TabsTrigger>
          <TabsTrigger value="engines" className="text-xs">
            المحرّكات الدائمة
          </TabsTrigger>
          <TabsTrigger value="sync" className="text-xs">
            المزامنة
          </TabsTrigger>
          <TabsTrigger value="keys" className="text-xs">
            المفاتيح والأمان
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-xs">
            المخططات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="mt-3">
          <UnifiedTable sites={data.sites as any[]} servers={data.servers as any[]} onProgram={downloadSiteProgram} />
        </TabsContent>

        <TabsContent value="engines" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="size-4" /> المهام الدائمة ({t.activeSchedules} تعمل)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-xs">المحرّك</TableHead>
                    <TableHead className="text-xs">كل</TableHead>
                    <TableHead className="text-xs">تشغيلات</TableHead>
                    <TableHead className="text-xs">آخر تشغيل</TableHead>
                    <TableHead className="text-xs">التالي</TableHead>
                    <TableHead className="text-xs">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.schedules as any[]).map((s) => (
                    <TableRow key={s.id} className="text-xs">
                      <TableCell>{s.label || s.engine_id}</TableCell>
                      <TableCell>{s.interval_minutes} د</TableCell>
                      <TableCell>{s.run_count ?? 0}</TableCell>
                      <TableCell>{fmt(s.last_run_at)}</TableCell>
                      <TableCell>{fmt(s.next_run_at)}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px]">
                          {s.is_active ? s.last_status || "نشط" : "متوقف"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!(data.schedules as any[]).length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-xs text-muted-foreground">
                        لا مهام دائمة بعد.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="size-4" /> المزامنة المحلية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                  <div>
                    <div className="font-medium">{s.label}</div>
                    <div dir="ltr" className="text-[10px] text-muted-foreground">
                      {s.host}:{s.port} · {fmt(s.last_beacon_at)}
                    </div>
                  </div>
                  <Badge variant={s.online ? "default" : "secondary"} className="text-[10px]">
                    {s.online ? "متصل" : s.status || "بانتظار النبضة"}
                  </Badge>
                </div>
              ))}
              {!sources.length && (
                <p className="text-xs text-muted-foreground">لا مصادر محلية — أضفها من مركز قواعد البيانات ← المزامنة.</p>
              )}
              <div className="pt-1 text-[11px] text-muted-foreground">
                آخر الدفعات: {(data.batches as any[]).length} · صفوف محلية {t.localRows.toLocaleString("ar")} مقابل{" "}
                {t.mirrorRows.toLocaleString("ar")} في المرآة.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="mt-3">
          <KeysPanel />
        </TabsContent>

        <TabsContent value="charts" className="mt-3">
          <MonitoringCharts />
        </TabsContent>
      </Tabs>
    </div>
  );
}
