import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonitoringOverview } from "@/lib/monitoring.functions";
import { getSiteAgentProgram, provisionAllSiteAgents } from "@/lib/site-agents.functions";
import { getAgentInstall } from "@/lib/servers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Download, Globe, Link2, RefreshCw, Server as ServerIcon, Database } from "lucide-react";
import { toast } from "sonner";

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ar", { hour12: false });
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

  const [q, setQ] = useState("");
  const [serverId, setServerId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["monitoring-overview"],
    queryFn: () => overview(),
    refetchInterval: 15000,
  });

  const t = data?.totals;
  const sites = useMemo(() => {
    const list = (data?.sites ?? []) as any[];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? list.filter((s) =>
          [s.name, s.domain, s.site_code].some((v) => String(v ?? "").toLowerCase().includes(term)),
        )
      : list;
    return filtered.slice(0, 60);
  }, [data, q]);

  const downloadSiteProgram = async (websiteId: string, kind: "php" | "node" | "badge") => {
    try {
      const res: any = await program({ data: { websiteId, kind } });
      download(res.filename, res.content);
      toast.success("تم توليد برنامج الموقع");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التوليد");
    }
  };

  const downloadServerProgram = async () => {
    if (!serverId) return toast.error("اختر سيرفراً أولاً");
    try {
      const res: any = await agentInstall({ data: { serverId, origin: window.location.origin } });
      download("tvcc-agent.sh", res.script);
      toast.success("برنامج السيرفر جاهز — نفّذ أمر التثبيت على السيرفر");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر توليد برنامج السيرفر");
    }
  };

  const provisionAll = async () => {
    setBusy(true);
    try {
      const res: any = await provision({ data: {} } as any);
      toast.success(`تم تسجيل ${res.created} موقع جديد من أصل ${res.total}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التسجيل التلقائي");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !t) return <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل مركز المراقبة…</div>;

  return (
    <div className="space-y-4" dir="rtl">
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

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="size-4" /> البرامج الموحّدة
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger className="h-8 w-56 text-xs">
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
            <Button size="sm" className="h-8 text-xs" onClick={downloadServerProgram}>
              <ServerIcon className="size-3.5" /> برنامج السيرفر
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={provisionAll}>
              <Link2 className="size-3.5" /> تسجيل كل المواقع تلقائياً
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => refetch()}>
              <RefreshCw className="size-3.5" /> تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-[11px] leading-5 text-muted-foreground">
          برنامج السيرفر يستجيب لتعليمات المحرّكات ويصلح نفسه تلقائياً. برنامج الموقع يُوضع داخل ملفات الموقع ويرسل نبضة موقّعة
          كل دقيقة، وتظهر شارة <b>TVCC</b> بنقطة خضراء أعلى الصفحة الرسمية عندما يكون الموقع ضمن المجموعة ومتصلاً بالمنصة. كل
          الاتصالات موقّعة بمفتاح خاص بكل موقع/سيرفر عبر HTTPS.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Globe className="size-4" /> برامج المواقع ({t.sitesWithProgram})
          </CardTitle>
          <Input className="h-8 w-56 text-xs" placeholder="بحث عن موقع…" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-xs">الموقع</TableHead>
                <TableHead className="text-xs">الحالة</TableHead>
                <TableHead className="text-xs">النبضات</TableHead>
                <TableHead className="text-xs">آخر نبضة</TableHead>
                <TableHead className="text-xs">البرنامج</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id} className="text-xs">
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div dir="ltr" className="text-[10px] text-muted-foreground">
                      {s.site_code} · {s.domain}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`inline-block size-2 rounded-full ${s.connected ? "bg-success" : s.program ? "bg-warning" : "bg-muted-foreground"}`}
                      />
                      {s.connected ? "متصل" : s.program ? "مسجّل" : "بدون برنامج"}
                    </span>
                  </TableCell>
                  <TableCell>{s.beacons}</TableCell>
                  <TableCell>{fmt(s.last_beacon_at)}</TableCell>
                  <TableCell className="space-x-1 space-x-reverse">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => downloadSiteProgram(s.id, "php")}>
                      PHP
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => downloadSiteProgram(s.id, "node")}>
                      Node
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => downloadSiteProgram(s.id, "badge")}>
                      الشارة
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
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
                  <TableHead className="text-xs">آخر تشغيل</TableHead>
                  <TableHead className="text-xs">التالي</TableHead>
                  <TableHead className="text-xs">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.schedules as any[]).slice(0, 15).map((s) => (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell>{s.label || s.engine_id}</TableCell>
                    <TableCell>{s.interval_minutes} د</TableCell>
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
                    <TableCell colSpan={5} className="text-xs text-muted-foreground">
                      لا مهام دائمة بعد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="size-4" /> المزامنة المحلية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.sources as any[]).map((s) => (
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
            {!(data.sources as any[]).length && (
              <p className="text-xs text-muted-foreground">لا مصادر محلية — أضفها من مركز قواعد البيانات ← المزامنة.</p>
            )}
            <div className="pt-1 text-[11px] text-muted-foreground">
              آخر الدفعات: {(data.batches as any[]).length} · صفوف محلية {t.localRows.toLocaleString("ar")} مقابل{" "}
              {t.mirrorRows.toLocaleString("ar")} في المرآة.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
