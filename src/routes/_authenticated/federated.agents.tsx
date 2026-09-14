import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import {
  getAgentsData, saveAgentConfig, getNginxConfig, saveNginxConfig, mergeDuplicateServer,
  createSiteSnapshot, rollbackSiteSnapshot,
} from "@/lib/federated.functions";
import { setAgentCapability, dispatchAgentCommand, createAgentJob } from "@/lib/agent-roles.functions";
import { COMMAND_WHITELIST, COMMAND_LABELS, COMMAND_ARG, COMMAND_CATEGORIES, RISKY_COMMANDS, commandCategory, permissionForAction, rolesForAction, AGENT_ROLE_LABELS, agentRoleAllows } from "@/lib/server-commands";
import { usePermissions } from "@/hooks/use-permissions";
import { EntityRelations } from "@/components/relations/EntityRelations";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Loader2, Save, FileCode2, Copy, Play, Plus, Activity, RefreshCw, ExternalLink, Trash2, SlidersHorizontal, ShieldCheck, GitMerge, ChevronDown, ChevronLeft, Download, Signal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/agents")({
  component: AgentsPage,
  head: () => ({
    meta: [
      { title: "الوكيل (Agent Control) — TVCC" },
      { name: "description", content: "جدول حالة السيرفرات وجدول مهام الوكيل: تفعيل، تشغيل فوري، وإضافة مهام مركّبة." },
      { property: "og:title", content: "الوكيل (Agent Control) — TVCC" },
      { property: "og:description", content: "حالة كل سيرفر في 12 خانة، وكل مهام الوكيل مع التفعيل والتشغيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL_ACTIONS = Array.from(new Set(COMMAND_WHITELIST as readonly string[])).sort();

function ago(iso: string | null) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

function pct(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v)}%`;
}

function fmtBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}MB`;
  return `${Math.round(n / 1e3)}KB`;
}

function fmtUptime(sec: number | null | undefined) {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((sec % 3600) / 60)}m`;
}

function statusBadge(status: string) {
  const ok = status === "online" || status === "completed" || status === "success";
  const warn = status === "warning" || status === "running" || status === "pending";
  return ok ? "bg-success/15 text-success" : warn ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
}

function AgentsPage() {
  const qc = useQueryClient();
  const fetchAgents = useServerFn(getAgentsData);
  const saveCfgFn = useServerFn(saveAgentConfig);
  const fetchNginx = useServerFn(getNginxConfig);
  const saveNginxFn = useServerFn(saveNginxConfig);
  const snapshotFn = useServerFn(createSiteSnapshot);
  const rollbackFn = useServerFn(rollbackSiteSnapshot);
  const setCapFn = useServerFn(setAgentCapability);
  const dispatchFn = useServerFn(dispatchAgentCommand);
  const createJobFn = useServerFn(createAgentJob);

  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverSearch, setServerSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [hb, setHb] = useState(60);
  const [cmds, setCmds] = useState("");
  const [autostart, setAutostart] = useState(true);
  const [nginxOpen, setNginxOpen] = useState<any>(null);
  const [nginxContent, setNginxContent] = useState("");
  const [jobOpen, setJobOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDryRun, setJobDryRun] = useState(false);
  const [jobSteps, setJobSteps] = useState<Array<{ action: string; arg: string }>>([{ action: "agent_diag", arg: "" }]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mergeRow, setMergeRow] = useState<any>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const { can } = usePermissions();
  const mergeFn = useServerFn(mergeDuplicateServer);


  // أعمدة جدول السيرفرات القابلة للإظهار/الإخفاء
  const COLS: Array<{ key: string; label: string; on: boolean }> = [
    { key: "id", label: "المعرّف", on: true },
    { key: "name", label: "الاسم", on: true },
    { key: "host", label: "المضيف / IP", on: true },
    { key: "agents", label: "الوكلاء", on: true },
    { key: "link", label: "قوة الاتصال", on: true },
    { key: "trust", label: "الموثوقية", on: true },
    { key: "cpu", label: "المعالج", on: true },
    { key: "ram", label: "الرام", on: true },
    { key: "disk", label: "التخزين", on: true },
    { key: "sites", label: "المواقع", on: true },
    { key: "queue", label: "الطابور", on: true },
    { key: "tools", label: "الأدوات", on: true },
    { key: "net", label: "الشبكة", on: false },
    { key: "uptime", label: "مدة التشغيل", on: false },
    { key: "ports", label: "المنافذ", on: false },
    { key: "dbs", label: "قواعد البيانات", on: false },
    { key: "status", label: "الحالة", on: false },
    { key: "os", label: "النظام", on: false },
  ];
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(COLS.map((c) => [c.key, c.on])));
  const visibleCols = COLS.filter((c) => visible[c.key]);

  const { data, isLoading } = useQuery({
    queryKey: ["federated-agents"],
    queryFn: () => fetchAgents(),
    refetchInterval: 30000,
  });

  const servers: any[] = (data?.servers ?? []) as any[];
  const capMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const c of ((data?.capabilities ?? []) as any[])) m[`${c.server_id}:${c.action}`] = !!c.allowed;
    return m;
  }, [data]);

  const activeServer = servers.find((s) => s.id === selected) ?? servers[0] ?? null;
  const activeId: string | null = activeServer?.id ?? null;
  const activeAgents: any[] = activeId ? ((data?.agents as any)?.[activeId] ?? []) : [];


  const refresh = () => qc.invalidateQueries({ queryKey: ["federated-agents"] });

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("نُسخ"); };

  const openConfig = (sid: string) => {
    setSelected(sid);
    const c = ((data?.configs ?? []) as any[]).find((x) => x.server_id === sid);
    setHb(c?.heartbeat_interval_sec ?? 60);
    setCmds((c?.allowed_commands ?? []).join("\n"));
    setAutostart(c?.autostart ?? true);
  };

  const run = async (action: string, sid: string | null, args?: Record<string, unknown>) => {
    if (!sid) return toast.error("اختر سيرفراً أولاً");
    if (!can(permissionForAction(action))) {
      return toast.error(`صلاحيات غير كافية لتشغيل «${COMMAND_LABELS[action] ?? action}»`);
    }
    setRunningAction(action);
    try {
      await dispatchFn({ data: { serverId: sid, action, args: args ?? {} } });
      toast.success(`أُرسل الأمر ${COMMAND_LABELS[action] ?? action} — النتيجة تظهر في سجل الأوامر`);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "تعذّر إرسال الأمر"); }
    finally { setRunningAction(null); }
  };

  const toggleCap = async (action: string, allowed: boolean) => {
    if (!activeId) return;
    if (!can("agent.capability")) return toast.error("صلاحيات غير كافية لتعديل مهام الوكيل");
    try {
      await setCapFn({ data: { serverId: activeId, action, allowed } });
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "تعذّر الحفظ"); }
  };


  const bulkCap = async (allowed: boolean) => {
    if (!activeId) return;
    setBusy(true);
    try {
      for (const a of filteredTasks.map((t) => t.action)) await setCapFn({ data: { serverId: activeId, action: a, allowed } });
      toast.success(allowed ? "فُعّلت كل المهام المعروضة" : "عُطّلت كل المهام المعروضة");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "تعذّر التنفيذ"); }
    setBusy(false);
  };

  const saveConfig = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      await saveCfgFn({ data: { serverId: activeId, heartbeatIntervalSec: hb, allowedCommands: cmds.split("\n").map((s) => s.trim()).filter(Boolean), autostart } });
      toast.success("حُفظت الإعدادات وأُرسلت للوكيل فوراً");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const openNginx = async (row: any) => {
    const full: any = await fetchNginx({ data: { id: row.id } });
    setNginxOpen(full);
    setNginxContent(full.content);
  };

  const saveNginx = async () => {
    setBusy(true);
    try {
      await saveNginxFn({ data: { id: nginxOpen.id, serverId: nginxOpen.server_id, websiteId: nginxOpen.website_id ?? undefined, filePath: nginxOpen.file_path, content: nginxContent } });
      toast.success("أُرسل الملف — سيفحص الوكيل nginx -t قبل التطبيق ويتراجع عند الفشل");
      setNginxOpen(null);
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const submitJob = async () => {
    if (!activeId) return toast.error("اختر سيرفراً أولاً");
    const steps = jobSteps.filter((s) => s.action).map((s) => {
      const spec = COMMAND_ARG[s.action];
      return { action: s.action, args: spec && s.arg ? { [spec.key]: s.arg, dry_run: jobDryRun } : { dry_run: jobDryRun } };
    });
    if (!steps.length) return toast.error("أضف خطوة واحدة على الأقل");
    setBusy(true);
    try {
      await createJobFn({ data: { serverId: activeId, title: jobTitle || "مهمة جديدة", kind: "custom", steps } });
      toast.success("أُنشئت المهمة ودخلت طابور الوكيل");
      setJobOpen(false);
      setJobTitle("");
      setJobSteps([{ action: "agent_diag", arg: "" }]);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "تعذّر إنشاء المهمة"); }
    setBusy(false);
  };

  const filteredServers = servers.filter((s) => {
    const q = serverSearch.trim().toLowerCase();
    return !q || [s.name, s.hostname, s.public_ip, s.private_ip, s.id].some((v: any) => String(v ?? "").toLowerCase().includes(q));
  });

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return ALL_ACTIONS.map((action) => {
      const cat = commandCategory(action);
      const allowed = activeId ? capMap[`${activeId}:${action}`] !== false : false;
      const last = activeId ? ((data?.lastRun ?? {}) as any)[`${activeId}:${action}`] : null;
      return { action, cat, allowed, last, label: COMMAND_LABELS[action] ?? action, risky: RISKY_COMMANDS.includes(action) };
    }).filter((t) => {
      if (catFilter !== "all" && t.cat !== catFilter) return false;
      if (stateFilter === "on" && !t.allowed) return false;
      if (stateFilter === "off" && t.allowed) return false;
      if (q && !t.action.toLowerCase().includes(q) && !t.label.includes(taskSearch.trim())) return false;
      return true;
    });
  }, [taskSearch, catFilter, stateFilter, capMap, activeId, data]);

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل الوكلاء…</div>;

  const healthOf = (id: string) => ((data.health ?? {}) as any)[id];
  const metricsOf = (id: string) => ((data.metrics ?? {}) as any)[id];
  const queueOf = (id: string) => ((data.queued ?? {}) as any)[id] ?? { pending: 0, running: 0 };

  // لا نعرض النسخ المؤرشفة/المدموجة في الجدول (منع تكرار نفس السيرفر)
  const visibleServers = filteredServers.filter((s) => !s.duplicate_of && s.status !== "archived");

  const exportCsv = () => {
    const header = ["id", "name", "hostname", "public_ip", "status", "agents", "link_quality", "cpu%", "ram", "disk", "sites", "verified"];
    const lines = visibleServers.map((s) => {
      const agents: any[] = ((data.agents ?? {}) as any)[s.id] ?? [];
      const main = agents.find((a) => a.agent_key === "main") ?? agents[0];
      const m = metricsOf(s.id);
      return [
        s.id, s.name, s.hostname ?? "", s.public_ip ?? "", s.status, agents.length,
        main?.link_quality ?? "", m?.cpu_percent ?? "",
        m?.mem_used_mb != null ? `${(m.mem_used_mb / 1024).toFixed(1)}/${((m.mem_total_mb ?? 0) / 1024).toFixed(1)}GB` : "",
        m?.disk_used_gb != null ? `${m.disk_used_gb}/${m.disk_total_gb}GB` : "",
        ((data.sitesPer ?? {}) as any)[s.id] ?? 0, main?.verified_at ? "yes" : "no",
      ].join(",");
    });
    const blob = new Blob(["\uFEFF" + header.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `servers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("صُدّر ملف CSV");
  };

  const serverSites = activeId ? (data.websites as any[]).filter((w) => w.server_id === activeId) : [];
  const serverNginx = activeId ? (data.nginx as any[]).filter((n) => n.server_id === activeId) : [];
  const serverCmds = activeId ? (data.commands as any[]).filter((c) => c.server_id === activeId).slice(0, 40) : [];

  return (
    <div className="p-6 space-y-8" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">الوكيل (Agent Control)</h1>
            <p className="text-sm text-muted-foreground">جدول حالة السيرفرات + جدول كل مهام الوكيل مع التفعيل والتشغيل الفوري</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="w-4 h-4 ml-1" /> تحديث</Button>
      </div>

      {/* ===== القسم الأول: جدول حالة السيرفرات (بيانات موثّقة من الوكيل) ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> حالة السيرفرات ({visibleServers.length})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 ml-1" /> تصدير CSV</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><SlidersHorizontal className="w-4 h-4 ml-1" /> الأعمدة</Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 max-h-80 overflow-y-auto" align="end">
                <div className="space-y-2">
                  {COLS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={!!visible[c.key]} onCheckedChange={(v) => setVisible((p) => ({ ...p, [c.key]: !!v }))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Input placeholder="بحث بالاسم أو المضيف أو المعرّف…" value={serverSearch} onChange={(e) => setServerSearch(e.target.value)} className="max-w-xs" />
          </div>
        </div>
        <Card><CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleCols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleServers.map((s, i) => {
                const agents: any[] = ((data.agents ?? {}) as any)[s.id] ?? [];
                const main = agents.find((a) => a.agent_key === "main") ?? agents[0];
                const h = healthOf(s.id);
                const m = metricsOf(s.id);
                const q = queueOf(s.id);
                const quality: number | null = main?.link_quality ?? null;
                const verified = !!main?.verified_at;
                const liveState = main?.live ?? "offline";
                const dupIds: string[] = ((data.duplicates ?? {}) as any)[s.id] ?? [];
                const isDupOf = !!s.duplicate_of;
                const sitesN = ((data.sitesPer ?? {}) as any)[s.id] ?? 0;
                const isActive = s.id === activeId;
                const open = !!expanded[s.id];
                const qColor = quality == null ? "bg-muted" : quality >= 75 ? "bg-success" : quality >= 40 ? "bg-warning" : "bg-destructive";
                const cell = (key: string) => {
                  switch (key) {
                    case "id": return (
                      <button className="flex items-center gap-1 font-mono text-xs text-primary" dir="ltr"
                        onClick={(e) => { e.stopPropagation(); copy(s.id); }}>
                        #{i + 1} · {String(s.id).slice(0, 8)} <Copy className="w-3 h-3" />
                      </button>
                    );
                    case "name": return (
                      <span className="font-medium whitespace-nowrap flex items-center gap-1">
                        {s.name}
                        {isDupOf && <Badge className="bg-muted text-muted-foreground text-[10px]">مكرر</Badge>}
                        {dupIds.length > 0 && <Badge className="bg-warning/15 text-warning text-[10px]">له نسخة مكررة</Badge>}
                      </span>
                    );
                    case "host": return <span dir="ltr" className="text-xs text-muted-foreground whitespace-nowrap">{s.hostname}{s.public_ip ? ` · ${s.public_ip}` : s.private_ip ? ` · ${s.private_ip}` : ""}</span>;
                    case "status": return <Badge className={statusBadge(s.status)}>{s.status}</Badge>;
                    case "os": return <span className="text-xs" dir="ltr">{main?.os ?? s.os ?? "—"}</span>;
                    case "agents": return (
                      <button className="flex items-center gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setExpanded((p) => ({ ...p, [s.id]: !p[s.id] })); }}>
                        <Badge className="bg-primary/10 text-primary">{agents.length || 0} وكيل</Badge>
                        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                        <span className="text-muted-foreground" dir="ltr">v{main?.agent_version ?? s.agent_version ?? "—"}</span>
                      </button>
                    );
                    case "link": return quality == null ? <span className="text-xs text-muted-foreground">لا نبض</span> : (
                      <div className="flex items-center gap-2 min-w-[110px]">
                        <Signal className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${qColor}`} style={{ width: `${quality}%` }} /></div>
                        <span className="text-xs font-mono" dir="ltr">{quality}%</span>
                      </div>
                    );
                    case "trust": return (
                      <span className="flex items-center gap-1 text-xs whitespace-nowrap">
                        {verified ? <Badge className="bg-success/15 text-success"><ShieldCheck className="w-3 h-3 ml-1" /> موثّق</Badge> : <Badge className="bg-muted text-muted-foreground">غير موثّق</Badge>}
                        <span className={liveState === "live" ? "text-success" : liveState === "stale" ? "text-warning" : "text-destructive"}>
                          {liveState === "live" ? "مباشر" : liveState === "stale" ? "متأخر" : "منقطع"}
                        </span>
                        <span className="text-muted-foreground">{ago(main?.last_poll_at ?? s.last_seen_at)}</span>
                      </span>
                    );
                    case "cpu": return <span className="text-xs">{pct(m?.cpu_percent ?? h?.cpu_percent)}</span>;
                    case "ram": return (
                      <span className="text-xs whitespace-nowrap" dir="ltr">
                        {m?.mem_used_mb != null ? `${(m.mem_used_mb / 1024).toFixed(1)}/${((m.mem_total_mb ?? 0) / 1024).toFixed(1)}GB` : pct(h?.memory_percent)}
                      </span>
                    );
                    case "disk": return (
                      <span className="text-xs whitespace-nowrap" dir="ltr">
                        {m?.disk_used_gb != null ? `${Math.round(m.disk_used_gb)}/${Math.round(m.disk_total_gb ?? 0)}GB` : pct(h?.disk_percent)}
                      </span>
                    );
                    case "sites": return <Badge className="bg-secondary text-secondary-foreground">{sitesN}</Badge>;
                    case "ports": return <span className="text-xs">{((data.portsPer ?? {}) as any)[s.id] ?? 0}</span>;
                    case "dbs": return <span className="text-xs">{((data.dbsPer ?? {}) as any)[s.id] ?? 0}</span>;
                    case "net": return (
                      <span className="text-[10px] font-mono whitespace-nowrap" dir="ltr">
                        {main?.net_rx_bytes != null ? `↓${fmtBytes(main.net_rx_bytes)} ↑${fmtBytes(main.net_tx_bytes ?? 0)}` : "—"}
                      </span>
                    );
                    case "uptime": return <span className="text-xs" dir="ltr">{fmtUptime(main?.uptime_seconds ?? m?.uptime_seconds)}</span>;
                    case "queue": return <span className="text-xs whitespace-nowrap">{q.running} / {q.pending}</span>;
                    case "tools": return (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => run("agent_diag", s.id)}>تشخيص</Button>
                        <Button size="sm" variant="outline" onClick={() => run("agent_self_update", s.id)}>تحديث</Button>
                        <Button size="sm" variant="ghost" onClick={() => openConfig(s.id)}>إعدادات</Button>
                        {dupIds.length > 0 && (
                          <Button size="sm" variant="ghost" title="دمج النسخ المكررة" onClick={() => setMergeRow({ primary: s, dupIds })}>
                            <GitMerge className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" asChild><a href={`/servers/${s.id}`}><ExternalLink className="w-3 h-3" /></a></Button>
                      </div>
                    );
                    default: return null;
                  }
                };
                return (
                  <Fragment key={s.id}>
                    <TableRow key={s.id} className={isActive ? "bg-primary/5" : ""} onClick={() => setSelected(s.id)}>
                      {visibleCols.map((c) => <TableCell key={c.key}>{cell(c.key)}</TableCell>)}
                    </TableRow>
                    {open && (
                      <TableRow key={`${s.id}-agents`} className="bg-muted/30">
                        <TableCell colSpan={visibleCols.length}>
                          <div className="py-1 space-y-1">
                            {agents.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد وكيل مسجّل — ثبّت الوكيل من صفحة السيرفر.</p>}
                            {agents.map((a) => (
                              <div key={`${a.server_id}:${a.agent_key}`} className="flex items-center gap-4 text-xs flex-wrap" dir="rtl">
                                <Badge className="bg-primary/10 text-primary" dir="ltr">{a.agent_key}</Badge>
                                <span>الدور: {a.role}</span>
                                <span dir="ltr">v{a.agent_version ?? "—"}</span>
                                <span>النبض: {ago(a.last_poll_at)}</span>
                                <span>الجودة: {a.link_quality}%</span>
                                <span className={a.live === "live" ? "text-success" : a.live === "stale" ? "text-warning" : "text-destructive"}>
                                  {a.live === "live" ? "مباشر" : a.live === "stale" ? "متأخر" : "منقطع"}
                                </span>
                                {a.poll_latency_ms != null && <span dir="ltr">{a.poll_latency_ms}ms</span>}
                                {a.uptime_seconds != null && <span dir="ltr">up {fmtUptime(a.uptime_seconds)}</span>}
                                {a.last_error && <span className="text-destructive">{a.last_error}</span>}
                                <span className="text-muted-foreground" dir="ltr">{a.os ?? ""}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {visibleServers.length === 0 && (
                <TableRow><TableCell colSpan={visibleCols.length} className="text-center text-muted-foreground">لا سيرفرات مطابقة</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </section>

      {/* حوار دمج السيرفرات المكررة */}
      <Dialog open={!!mergeRow} onOpenChange={(o) => !o && setMergeRow(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>دمج سيرفرات مكررة (نفس البصمة)</DialogTitle></DialogHeader>
          {mergeRow && (
            <div className="space-y-3 text-sm">
              <p>السجل الأصلي: <b>{mergeRow.primary.name}</b> <span className="font-mono text-xs" dir="ltr">({String(mergeRow.primary.id).slice(0, 8)})</span></p>
              <p className="text-muted-foreground">السجلات التالية تشاركه بصمة الجهاز وستُنقل مواقعها وأوامرها للأصل ثم تُؤرشف:</p>
              <ul className="list-disc pr-5 space-y-1">
                {mergeRow.dupIds.map((id: string) => {
                  const d = servers.find((x) => x.id === id);
                  return <li key={id}><span className="font-mono text-xs" dir="ltr">{id.slice(0, 8)}</span> — {d?.name ?? "؟"}</li>;
                })}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeRow(null)}>إلغاء</Button>
            <Button disabled={busy} onClick={async () => {
              if (!mergeRow) return;
              setBusy(true);
              try {
                for (const id of mergeRow.dupIds) await mergeFn({ data: { primaryId: mergeRow.primary.id, duplicateId: id } });
                toast.success("تم الدمج والأرشفة");
                setMergeRow(null);
                refresh();
              } catch (e: any) { toast.error(e?.message ?? "تعذّر الدمج"); }
              setBusy(false);
            }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الدمج"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== القسم الثاني: جدول مهام الوكيل ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold">مهام الوكيل ({filteredTasks.length} / {ALL_ACTIONS.length})</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeId ?? ""} onValueChange={(v) => setSelected(v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="اختر السيرفر" /></SelectTrigger>
              <SelectContent>{servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {COMMAND_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="on">مفعّلة</SelectItem>
                <SelectItem value="off">معطّلة</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="بحث عن مهمة…" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="w-48" />
            <Button size="sm" variant="outline" disabled={busy || !activeId} onClick={() => bulkCap(true)}>تفعيل الكل</Button>
            <Button size="sm" variant="outline" disabled={busy || !activeId} onClick={() => bulkCap(false)}>تعطيل الكل</Button>
            <Button size="sm" disabled={!activeId} onClick={() => setJobOpen(true)}><Plus className="w-4 h-4 ml-1" /> إضافة مهمة</Button>
          </div>
        </div>
        {activeId && <EntityRelations serverId={activeId} />}
        <Card><CardContent className="p-0 overflow-x-auto max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>معرّف المهمة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>دور الوكيل</TableHead>
                <TableHead>الصلاحية</TableHead>
                <TableHead>الخطورة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر تنفيذ</TableHead>
                <TableHead>تفعيل</TableHead>
                <TableHead>تشغيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((t) => {
                const roles = rolesForAction(t.action);
                const eligible = !activeAgents.length || activeAgents.some((a: any) => agentRoleAllows(a.role, t.action));
                const allowedByPerm = can(permissionForAction(t.action));
                const blockedReason = !activeId
                  ? "اختر سيرفراً"
                  : !allowedByPerm
                    ? "صلاحياتك لا تسمح بهذه المهمة"
                    : !eligible
                      ? `لا يوجد وكيل بدور: ${roles.map((r) => AGENT_ROLE_LABELS[r]).join("، ")}`
                      : "";
                return (
                <TableRow key={t.action}>
                  <TableCell dir="ltr" className="font-mono text-xs">{t.action}</TableCell>
                  <TableCell className="text-sm">{t.label}</TableCell>
                  <TableCell><Badge variant="outline">{t.cat}</Badge></TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {roles.map((r) => AGENT_ROLE_LABELS[r]).join("، ")}
                  </TableCell>
                  <TableCell className="text-[11px] font-mono" dir="ltr">{permissionForAction(t.action)}</TableCell>
                  <TableCell>
                    <Badge className={t.risky ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}>
                      {t.risky ? "يحتاج تأكيد" : "آمن"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{t.allowed ? "مفعّلة" : "معطّلة"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {t.last ? `${t.last.status} · ${ago(t.last.created_at)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={t.allowed}
                      disabled={!activeId || !can("agent.capability")}
                      onCheckedChange={(v) => toggleCap(t.action, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" title={blockedReason}
                      disabled={Boolean(blockedReason) || runningAction === t.action}
                      onClick={() => {
                        if (t.risky && !window.confirm(`تنفيذ «${t.label}» على ${activeServer?.name}؟ هذا أمر حسّاس.`)) return;
                        run(t.action, activeId);
                      }}>
                      {runningAction === t.action
                        ? <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                        : <Play className="w-3 h-3 ml-1" />} تشغيل
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </section>


      {/* ===== القسم الثالث: إعدادات الوكيل و Nginx واللقطات والسجل ===== */}
      {activeServer && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{activeServer.name} — التفاصيل</h2>
          <Tabs defaultValue="ops">
            <TabsList>
              <TabsTrigger value="ops">سجل الأوامر</TabsTrigger>
              <TabsTrigger value="sites">المواقع والنسخ</TabsTrigger>
              <TabsTrigger value="nginx">إعدادات Nginx</TabsTrigger>
              <TabsTrigger value="config">إعدادات الوكيل</TabsTrigger>
            </TabsList>

            <TabsContent value="ops">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>الأمر</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {serverCmds.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell dir="ltr" className="font-mono text-xs">{c.action}</TableCell>
                        <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</TableCell>
                      </TableRow>
                    ))}
                    {serverCmds.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">لا أوامر مسجّلة لهذا السيرفر</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="sites">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>الموقع</TableHead><TableHead>الحالة</TableHead><TableHead>النسخة الجديدة</TableHead><TableHead>النسخة القديمة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {serverSites.map((w) => {
                      const cur = (data.snapshots as any[]).find((s) => s.website_id === w.id && s.slot === "current");
                      const prev = (data.snapshots as any[]).find((s) => s.website_id === w.id && s.slot === "previous");
                      return (
                        <TableRow key={w.id}>
                          <TableCell dir="ltr" className="font-medium">{w.domain}</TableCell>
                          <TableCell><Badge variant="outline">{w.status}</Badge></TableCell>
                          <TableCell className="text-xs">{cur ? new Date(cur.created_at).toLocaleString("ar") : "—"}</TableCell>
                          <TableCell className="text-xs">{prev ? new Date(prev.created_at).toLocaleString("ar") : "—"}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
                              setBusy(true);
                              try { await snapshotFn({ data: { websiteId: w.id } }); toast.success("طُلبت لقطة جديدة"); refresh(); }
                              catch (e: any) { toast.error(e.message); }
                              setBusy(false);
                            }}>لقطة</Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
                              setBusy(true);
                              try { await rollbackFn({ data: { websiteId: w.id } }); toast.success("أُرسل أمر الاستعادة"); }
                              catch (e: any) { toast.error(e.message); }
                              setBusy(false);
                            }}>استعادة</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {serverSites.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا مواقع مرتبطة بهذا السيرفر</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="nginx">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>الملف</TableHead><TableHead>الموقع</TableHead><TableHead>الإصدار</TableHead><TableHead>آخر تحديث</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {serverNginx.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell dir="ltr" className="font-mono text-xs">{n.file_path}</TableCell>
                        <TableCell dir="ltr" className="text-xs">{(data.websites as any[]).find((w) => w.id === n.website_id)?.domain ?? "—"}</TableCell>
                        <TableCell>v{n.version}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(n.updated_at).toLocaleString("ar")}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => openNginx(n)}><FileCode2 className="w-3 h-3 ml-1" /> تحرير</Button></TableCell>
                      </TableRow>
                    ))}
                    {serverNginx.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا ملفات Nginx مسجّلة — يجمعها الوكيل مع النبضة القادمة</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="config">
              <Card><CardContent className="p-4 space-y-4 max-w-xl">
                <div className="space-y-1">
                  <label className="text-sm">فاصل النبضة (ثانية)</label>
                  <Input type="number" min={15} value={hb} onChange={(e) => setHb(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm">الأوامر المسموحة (سطر لكل أمر)</label>
                  <Textarea dir="ltr" rows={6} value={cmds} onChange={(e) => setCmds(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">التشغيل التلقائي عند الإقلاع</span>
                  <Switch checked={autostart} onCheckedChange={setAutostart} />
                </div>
                <Button onClick={saveConfig} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />} حفظ ودفع للوكيل</Button>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </section>
      )}

      {/* نافذة إضافة مهمة */}
      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>إضافة مهمة إلى {activeServer?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="عنوان المهمة" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {jobSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                  <Select value={s.action} onValueChange={(v) => setJobSteps((p) => p.map((x, j) => j === i ? { ...x, action: v } : x))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {ALL_ACTIONS.map((a) => <SelectItem key={a} value={a}>{COMMAND_LABELS[a] ?? a} — {a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input dir="ltr" className="w-40" placeholder={COMMAND_ARG[s.action]?.placeholder ?? "بدون وسيط"}
                    disabled={!COMMAND_ARG[s.action]}
                    value={s.arg} onChange={(e) => setJobSteps((p) => p.map((x, j) => j === i ? { ...x, arg: e.target.value } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => setJobSteps((p) => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setJobSteps((p) => [...p, { action: "agent_diag", arg: "" }])}>
              <Plus className="w-4 h-4 ml-1" /> خطوة أخرى
            </Button>
            <div className="flex items-center justify-between">
              <span className="text-sm">محاكاة فقط (Dry Run)</span>
              <Switch checked={jobDryRun} onCheckedChange={setJobDryRun} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitJob} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} إنشاء المهمة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!nginxOpen} onOpenChange={() => setNginxOpen(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader><DialogTitle dir="ltr" className="font-mono text-sm">{nginxOpen?.file_path}</DialogTitle></DialogHeader>
          <Textarea dir="ltr" rows={18} value={nginxContent} onChange={(e) => setNginxContent(e.target.value)} className="font-mono text-xs" />
          <DialogFooter><Button onClick={saveNginx} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} فحص وحفظ وإعادة تحميل</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
