import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonitoringOverview, registerMonitoringGraph } from "@/lib/monitoring.functions";
import { getSiteAgentProgram, provisionAllSiteAgents } from "@/lib/site-agents.functions";
import { getAgentInstall } from "@/lib/servers.functions";
import {
  deployAllSitePrograms,
  deployServerProgram,
  deploySiteProgram,
  registerTvccMesh,
  verifySiteLinkRecord,
} from "@/lib/monitoring-deploy.functions";
import { autoFixAndReport, runHealthCheckAll } from "@/lib/health-check.functions";
import { getSyncScript } from "@/lib/dbsync.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity,
  Database,
  HeartPulse,
  Link2,
  Loader2,
  Network,
  RefreshCw,
  Send,
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

type Tone = "ok" | "warn" | "idle";

function Stat({ label, value, hint, tone = "idle" }: { label: string; value: string; hint?: string; tone?: Tone }) {
  const bar = tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-muted-foreground/30";
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${bar}`} />
      <CardContent className="p-4">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-2xl font-bold leading-none" dir="ltr">
          {value}
        </div>
        {hint && <div className="mt-1.5 text-[10px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
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
  const pushServer = useServerFn(deployServerProgram);
  const pushSite = useServerFn(deploySiteProgram);
  const pushAllSites = useServerFn(deployAllSitePrograms);
  const verifyDns = useServerFn(verifySiteLinkRecord);
  const mesh = useServerFn(registerTvccMesh);

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

  if (isLoading || !t || !data)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> جارٍ تحميل مركز المراقبة…
      </div>
    );

  const sources = data.sources as any[];

  const Btn = ({
    id,
    icon,
    label,
    tip,
    variant = "outline",
    onClick,
  }: {
    id: string;
    icon: React.ReactNode;
    label: string;
    tip: string;
    variant?: "default" | "outline" | "ghost";
    onClick: () => void;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant={variant} className="h-8 gap-1.5 text-xs" disabled={!!busy} onClick={onClick}>
          {busy === id ? <Loader2 className="size-3.5 animate-spin" /> : icon}
          {busy === id ? "جارٍ التنفيذ…" : label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4" dir="rtl">
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

            <Group title="نشر">
              <Btn
                id="pushServer"
                variant="default"
                icon={<Send className="size-3.5" />}
                label="نشر برنامج السيرفر"
                tip="إرسال البرنامج تلقائياً إلى الوكيل على السيرفر المحدّد ليهيّئ البيئة"
                onClick={() =>
                  act("pushServer", async () => {
                    if (!serverId) throw new Error("اختر سيرفراً أولاً");
                    await pushServer({ data: { serverId } });
                    toast.success("أُرسل برنامج السيرفر إلى الوكيل");
                  })
                }
              />
              <Btn
                id="pushSites"
                variant="default"
                icon={<Network className="size-3.5" />}
                label="نشر برنامج المواقع"
                tip="إرسال برنامج الموقع إلى جذر كل موقع على سيرفره عبر الوكيل"
                onClick={() =>
                  act("pushSites", async () => {
                    const res: any = await pushAllSites({ data: { serverId: serverId || null } });
                    toast.success(`أُرسل البرنامج إلى ${res.sent} موقع من ${res.total}`);
                  })
                }
              />
              <Btn
                id="agent"
                icon={<ServerIcon className="size-3.5" />}
                label="تنزيل يدوي"
                tip="تنزيل مثبّت السيرفر للتثبيت اليدوي حين لا يوجد وكيل بعد"
                onClick={() =>
                  act("agent", async () => {
                    if (!serverId) throw new Error("اختر سيرفراً أولاً");
                    const res: any = await agentInstall({ data: { serverId, origin: window.location.origin } });
                    download("tvcc-agent.sh", res.script);
                    toast.success("نزّل المثبّت ونفّذه على السيرفر");
                  })
                }
              />
            </Group>

            <Group title="تشغيل">
              <Btn
                id="beat"
                icon={<HeartPulse className="size-3.5" />}
                label="نبضة المزامنة"
                tip="تنزيل سكربت نبضة القاعدة المحلية وتشغيله على السيرفر المحلي"
                onClick={() =>
                  act("beat", async () => {
                    const src = sources[0];
                    if (!src) throw new Error("لا مصدر مزامنة — أضفه من مركز قواعد البيانات ← المزامنة");
                    const res: any = await syncScript({ data: { sourceId: src.id, kind: "heartbeat" } });
                    download(res.filename, res.content);
                    toast.success("نفّذه على السيرفر المحلي: node tvcc-heartbeat.js");
                  })
                }
              />
              <Btn
                id="provision"
                icon={<Link2 className="size-3.5" />}
                label="تسجيل كل المواقع"
                tip="تسجيل كل مواقع المنصة في نظام المراقبة (إضافة فقط)"
                onClick={() =>
                  act("provision", async () => {
                    const res: any = await provision({ data: {} } as any);
                    toast.success(`تم تسجيل ${res.created} موقع جديد من أصل ${res.total}`);
                  })
                }
              />
              <Btn
                id="graph"
                icon={<Database className="size-3.5" />}
                label="تسجيل العلاقات"
                tip="كتابة الكيانات والعلاقات واللقطة اليومية في جداول المنصة"
                onClick={() =>
                  act("graph", async () => {
                    const res: any = await registerGraph({ data: {} } as any);
                    toast.success(`سُجّل: ${res.entities} كيان و${res.links} علاقة`);
                  })
                }
              />
              <Btn
                id="mesh"
                icon={<Network className="size-3.5" />}
                label="ربط نسخ TVCC"
                tip="تسجيل نسخ TVCC كعُقد وإنشاء روابط مشفّرة بينها"
                onClick={() =>
                  act("mesh", async () => {
                    const res: any = await mesh({ data: {} } as any);
                    toast.success(`عُقد: ${res.nodes} · روابط جديدة: ${res.newLinks}`);
                  })
                }
              />
            </Group>

            <Group title="صيانة">
              <Btn
                id="scan"
                icon={<ShieldCheck className="size-3.5" />}
                label="فحص شامل"
                tip="فحص صحة كل المواقع الآن"
                onClick={() =>
                  act("scan", async () => {
                    const res: any = await healthAll();
                    toast.success(`اكتمل الفحص: ${res?.online ?? "—"} متصل`);
                  })
                }
              />
              <Btn
                id="fix"
                icon={<Wrench className="size-3.5" />}
                label="إصلاح تلقائي"
                tip="محاولة إصلاح المواقع المعطّلة وإصدار تقرير"
                onClick={() =>
                  act("fix", async () => {
                    const res: any = await autoFix();
                    const s = res?.summary;
                    toast.success(`متصلة ${s?.online} · معطلة ${s?.offline} · أُصلح ${s?.fixed}`);
                  })
                }
              />
              <Btn
                id="refresh"
                variant="ghost"
                icon={<RefreshCw className="size-3.5" />}
                label="تحديث"
                tip="إعادة تحميل بيانات المراقبة"
                onClick={() => act("refresh", async () => {})}
              />
            </Group>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="مواقع نشطة"
            value={`${t.activeSites}/${t.sites}`}
            tone={t.activeSites > t.sites / 2 ? "ok" : "warn"}
          />
          <Stat
            label="متصلة بالبرنامج"
            value={`${t.connectedSites}/${t.sitesWithProgram}`}
            hint="نبضة خلال 5 دقائق"
            tone={t.connectedSites ? "ok" : "warn"}
          />
          <Stat
            label="سيرفرات متصلة"
            value={`${t.onlineServers}/${t.servers}`}
            hint={`وكلاء: ${t.onlineAgents}/${t.agents}`}
            tone={t.onlineServers ? "ok" : "warn"}
          />
          <Stat
            label="مهام دائمة تعمل"
            value={`${t.activeSchedules}/${t.schedules}`}
            tone={t.activeSchedules ? "ok" : "idle"}
          />
          <Stat
            label="مصادر مزامنة"
            value={`${t.onlineSources}/${t.sources}`}
            hint={`جداول: ${t.syncTables}`}
            tone={t.onlineSources ? "ok" : "warn"}
          />
          <Stat
            label="صفوف محلي / مرآة"
            value={`${t.localRows} / ${t.mirrorRows}`}
            hint={`الفارق: ${t.rowGap}`}
            tone={t.rowGap === 0 ? "ok" : "warn"}
          />
        </div>

        <Tabs defaultValue="entities">
          <TabsList className="flex-wrap">
            <TabsTrigger value="entities" className="text-xs">المواقع والسيرفرات</TabsTrigger>
            <TabsTrigger value="engines" className="text-xs">المحرّكات الدائمة</TabsTrigger>
            <TabsTrigger value="sync" className="text-xs">المزامنة</TabsTrigger>
            <TabsTrigger value="keys" className="text-xs">المفاتيح والأمان</TabsTrigger>
            <TabsTrigger value="events" className="text-xs">سجل الأحداث</TabsTrigger>
            <TabsTrigger value="charts" className="text-xs">المخططات</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="mt-3">
            <UnifiedTable
              sites={data.sites as any[]}
              servers={data.servers as any[]}
              busy={!!busy}
              onProgram={downloadSiteProgram}
              onDeploy={(websiteId) =>
                act("site", async () => {
                  const res: any = await pushSite({ data: { websiteId } });
                  toast.success(`أُرسل برنامج الموقع إلى ${res.root}`);
                })
              }
              onVerifyDns={(websiteId) =>
                act("dns", async () => {
                  const res: any = await verifyDns({ data: { websiteId } });
                  if (res.verified) toast.success("رمز الربط موجود في DNS");
                  else toast.warning(`أضف سجل TXT بالقيمة: ${res.expected}`);
                })
              }
            />
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
                    <TableRow className="bg-muted/40 text-xs">
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
                  آخر الدفعات: {(data.batches as any[]).length} · صفوف محلية {t.localRows} مقابل {t.mirrorRows} في المرآة.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys" className="mt-3">
            <KeysPanel />
          </TabsContent>

          <TabsContent value="events" className="mt-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">آخر أحداث المراقبة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead className="text-xs">الحدث</TableHead>
                      <TableHead className="text-xs">التفاصيل</TableHead>
                      <TableHead className="text-xs">الحالة</TableHead>
                      <TableHead className="text-xs">الوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((data as any).events ?? []).map((e: any, i: number) => (
                      <TableRow key={i} className="text-xs">
                        <TableCell className="font-mono text-[10px]" dir="ltr">{e.event_type}</TableCell>
                        <TableCell>{e.message}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "ok" || e.status === "queued" ? "default" : "secondary"} className="text-[10px]">
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{fmt(e.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {!((data as any).events ?? []).length && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                          لا أحداث بعد — نفّذ أحد أزرار النشر أو الصيانة.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="mt-3">
            <MonitoringCharts />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
