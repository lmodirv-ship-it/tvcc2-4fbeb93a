import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AppWindow, ArrowRight, Box, Boxes, CircleUserRound, Cpu, Database, Download, FileText, Gauge, HardDrive, ListTree, MemoryStick, Network, Package, Play, RefreshCw, Search, Server, Settings, Shield, Terminal, Users } from "lucide-react";
import { getCockpitOverview, queueCockpitCommand } from "@/lib/cockpit.functions";
import { CommandGuide } from "@/components/servers/cockpit/CommandGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/servers_/$serverId/cockpit")({
  component: CockpitPage,
  head: () => ({ meta: [
    { title: "Cockpit للسيرفر — TVCC" },
    { name: "description", content: "إدارة نظام السيرفر وموارده وخدماته وسجلاته من لوحة Cockpit داخل TVCC." },
    { property: "og:title", content: "Cockpit للسيرفر — TVCC" },
    { property: "og:description", content: "إدارة مباشرة للسيرفر عبر وكيل TVCC الموقّع." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const NAV = [
  ["system", "النظام", Server], ["overview", "نظرة عامة", Gauge], ["logs", "السجلات", FileText],
  ["storage", "التخزين", HardDrive], ["network", "الشبكة", Network], ["accounts", "الحسابات", Users],
  ["services", "الخدمات", Activity], ["tools", "الأدوات", Settings], ["apps", "التطبيقات", AppWindow],
  ["updates", "تحديثات البرامج", Package], ["terminal", "الطرفية", Terminal],
] as const;

function pct(used: unknown, total: unknown) { const t = Number(total ?? 0); return t ? Math.min(100, Math.round(Number(used ?? 0) / t * 100)) : 0; }
function tone(status: string) { return status === "done" || status === "success" ? "text-success" : status === "failed" || status === "error" ? "text-destructive" : "text-warning"; }

function CockpitPage() {
  const { serverId } = Route.useParams();
  const load = useServerFn(getCockpitOverview);
  const queue = useServerFn(queueCockpitCommand);
  const qc = useQueryClient();
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [command, setCommand] = useState("systemctl status cockpit.socket");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["cockpit", serverId], queryFn: () => load({ data: { serverId } }), refetchInterval: 5000 });
  const data = q.data as any;
  const run = async (action: string, args: Record<string, unknown> = {}, confirmed = false) => {
    setBusy(action);
    try { await queue({ data: { serverId, action, args, confirmed } }); toast.success("أُرسل الأمر إلى وكيل TVCC"); await qc.invalidateQueries({ queryKey: ["cockpit", serverId] }); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(null); }
  };
  const latestOutput = (action: string) => data?.commands?.find((item: any) => item.action === action)?.output ?? "";
  const chart = useMemo(() => (data?.metrics ?? []).map((m: any) => ({ time: new Date(m.collected_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }), cpu: Number(m.cpu_percent ?? 0), memory: pct(m.mem_used_mb, m.mem_total_mb), disk: pct(m.disk_used_gb, m.disk_total_gb) })), [data?.metrics]);
  if (!data) return <div className="p-6 text-sm text-muted-foreground">جارٍ فتح Cockpit…</div>;
  const s = data.server; const m = data.latest; const address = s.public_ip || s.private_ip || s.hostname;
  const cockpitUrl = address ? `https://${address}:9090` : "";
  const filteredCommands = (data.commands ?? []).filter((item: any) => !search || `${item.action} ${item.output ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="min-h-[calc(100vh-4rem)] bg-background" dir="rtl">
    <header className="border-b bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button asChild variant="ghost" size="sm"><Link to="/servers/$serverId" params={{ serverId }}><ArrowRight className="size-4" /> لوحة السيرفر</Link></Button><div><h1 className="font-bold">Cockpit — {s.name}</h1><p className="text-xs text-muted-foreground" dir="ltr">root@{address || "—"}</p></div></div>
      <div className="flex items-center gap-2"><Badge variant="outline" className={s.status === "online" ? "text-success" : "text-warning"}>{s.status}</Badge><Button variant="outline" size="sm" onClick={() => q.refetch()}><RefreshCw className="size-4" /></Button>{cockpitUrl && <Button asChild size="sm"><a href={cockpitUrl} target="_blank" rel="noreferrer">فتح Cockpit الأصلي</a></Button>}</div>
    </header>
    <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-l bg-sidebar p-3 lg:min-h-[calc(100vh-8rem)]">
        <div className="relative mb-3"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input className="pr-9 bg-sidebar-accent" placeholder="بحث" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <nav className="space-y-1">{NAV.map(([id, label, Icon]) => <Button key={id} variant={section === id ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setSection(id)}><Icon className="size-4" />{label}{(id === "services" && data.services.some((v: any) => v.status !== "active")) || (id === "updates" && latestOutput("pkg_updates")) ? <span className="mr-auto size-2 rounded-full bg-destructive" /> : null}</Button>)}</nav>
      </aside>
      <main className="p-4 md:p-6 space-y-5 min-w-0">
        {(section === "system" || section === "overview") && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[[Cpu,"المعالج",`${Math.round(Number(m?.cpu_percent ?? 0))}%`,Number(m?.cpu_percent ?? 0)],[MemoryStick,"الذاكرة",`${Math.round(Number(m?.mem_used_mb ?? 0))}/${Math.round(Number(m?.mem_total_mb ?? 0))} MB`,pct(m?.mem_used_mb,m?.mem_total_mb)],[HardDrive,"القرص",`${Math.round(Number(m?.disk_used_gb ?? 0))}/${Math.round(Number(m?.disk_total_gb ?? 0))} GB`,pct(m?.disk_used_gb,m?.disk_total_gb)],[Activity,"مدة التشغيل",m?.uptime_seconds?`${Math.floor(Number(m.uptime_seconds)/3600)} ساعة`:"—",100]].map(([Icon,label,value,percent]:any)=><div key={label} className="border bg-card p-4 space-y-2"><div className="flex justify-between"><span className="text-sm text-muted-foreground flex gap-2"><Icon className="size-4"/>{label}</span><strong>{value}</strong></div><Progress value={percent}/></div>)}
          </div>
          {section === "system" ? <div className="grid gap-4 md:grid-cols-2"><Panel title="معلومات النظام"><Info label="نظام التشغيل" value={s.os}/><Info label="اسم المضيف" value={s.hostname}/><Info label="معرّف الجهاز" value={s.machine_id}/><Info label="إصدار الوكيل" value={s.agent_version}/><Info label="المعمارية" value={s.architecture}/></Panel><Panel title="حالة Cockpit"><Button disabled={busy === "cockpit_install"} onClick={() => run("cockpit_install",{},true)}><Download className="size-4"/> تثبيت وتشغيل Cockpit</Button><CommandOutput text={latestOutput("cockpit_install") || "لم يُطلب التثبيت بعد."}/></Panel></div> : <Panel title="استخدام الموارد الحي"><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" opacity={0.2}/><XAxis dataKey="time"/><YAxis domain={[0,100]}/><Tooltip/><Area dataKey="cpu" name="CPU" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15}/><Area dataKey="memory" name="RAM" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.12}/><Area dataKey="disk" name="Disk" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.1}/></AreaChart></ResponsiveContainer></div></Panel>}
        </>}
        {section === "logs" && <Panel title="سجلات النظام"><div className="flex gap-2"><Input placeholder="اسم الخدمة: nginx" id="log-service"/><Button onClick={()=>{const el=document.getElementById("log-service") as HTMLInputElement|null;void run("service_logs",{name:el?.value||"cockpit.socket"});}}>عرض السجل</Button></div><CommandOutput text={latestOutput("service_logs") || "اختر خدمة لعرض سجلها."}/></Panel>}
        {section === "storage" && <Panel title="الأقراص والتخزين"><Button variant="outline" onClick={()=>run("disk_usage")}><RefreshCw className="size-4"/> تحديث</Button><DataTable headers={["الجهاز","نقطة التحميل","المستخدم","الإجمالي"]} rows={data.disks.map((d:any)=>[d.device,d.mount,`${d.used_gb??0} GB`,`${d.total_gb??0} GB`])}/></Panel>}
        {section === "network" && <Panel title="واجهات الشبكة والمنافذ"><div className="flex gap-2"><Button variant="outline" onClick={()=>run("scan_ports")}><Network className="size-4"/> فحص المنافذ</Button><Button variant="outline" onClick={()=>run("firewall_list")}><Shield className="size-4"/> الجدار الناري</Button></div><DataTable headers={["الواجهة/العنوان","الاستقبال","الإرسال"]} rows={data.nets.map((n:any)=>[n.name||n.address,`${Math.round(Number(n.rx_bps??0)/1024)} KB/s`,`${Math.round(Number(n.tx_bps??0)/1024)} KB/s`])}/><CommandOutput text={latestOutput("scan_ports")||latestOutput("firewall_list")}/></Panel>}
        {section === "accounts" && <Panel title="حسابات النظام"><Button onClick={()=>run("users_list")}><Users className="size-4"/> تحديث الحسابات</Button><CommandOutput text={latestOutput("users_list")||"اضغط تحديث الحسابات."}/></Panel>}
        {section === "services" && <Panel title="الخدمات"><DataTable headers={["الخدمة","الحالة","الإجراء"]} rows={data.services.map((v:any)=>[v.name,<Badge key={v.id} variant="outline" className={v.status==="active"?"text-success":"text-destructive"}>{v.status}</Badge>,<Button key={`${v.id}-run`} size="sm" variant="outline" onClick={()=>run("service_action",{name:v.name,op:"restart"})}>إعادة تشغيل</Button>])}/></Panel>}
        {section === "tools" && <div className="grid gap-4 md:grid-cols-2"><Panel title="العمليات"><Button onClick={()=>run("proc_list")}><ListTree className="size-4"/> تحديث العمليات</Button><CommandOutput text={latestOutput("proc_list")}/></Panel><Panel title={`الحاويات (${data.containers.length})`}><Button onClick={()=>run("docker_ps")}><Boxes className="size-4"/> جرد Docker</Button><CommandOutput text={latestOutput("docker_ps")}/></Panel></div>}
        {section === "apps" && <Panel title="التطبيقات والحزم"><Button onClick={()=>run("pkg_list")}><Box className="size-4"/> عرض الحزم</Button><CommandOutput text={latestOutput("pkg_list")||"اضغط لقراءة الحزم المثبتة."}/></Panel>}
        {section === "updates" && <Panel title="تحديثات البرامج"><div className="flex gap-2"><Button variant="outline" onClick={()=>run("pkg_updates")}><Search className="size-4"/> فحص التحديثات</Button><Button variant="destructive" onClick={()=>{if(confirm("تأكيد تثبيت تحديثات Ubuntu؟"))void run("pkg_upgrade",{},true);}}><Download className="size-4"/> تثبيت التحديثات</Button></div><CommandOutput text={latestOutput("pkg_upgrade")||latestOutput("pkg_updates")||"لم يتم الفحص بعد."}/></Panel>}
        {section === "terminal" && <Panel title="الطرفية المتقدمة"><div className="flex flex-wrap gap-2"><Input dir="ltr" className="font-mono flex-1 min-w-64" value={command} onChange={(e)=>setCommand(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&command.trim()&&confirm("تنفيذ هذا الأمر على السيرفر؟"))void run("shell_exec",{cmd:command},true);}}/><Button onClick={()=>{if(command.trim()&&confirm("تنفيذ هذا الأمر على السيرفر؟"))void run("shell_exec",{cmd:command},true);}}><Play className="size-4"/> تنفيذ</Button><CommandGuide onChoose={setCommand}/></div><p className="text-xs text-muted-foreground">كل أمر يُسجّل ويُنفّذ عبر الوكيل الموقّع. الأوامر المدمرة المحظورة تُرفض تلقائياً.</p><CommandOutput text={latestOutput("shell_exec")||"root@server:~#"}/></Panel>}
        <Panel title="آخر الأوامر"><DataTable headers={["الأمر","الحالة","الوقت","المخرجات"]} rows={filteredCommands.slice(0,30).map((c:any)=>[c.action,<span key={c.id} className={tone(c.status)}>{c.status}</span>,new Date(c.created_at).toLocaleString("ar"),String(c.output??"").slice(0,120)])}/></Panel>
      </main>
    </div>
  </div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="border bg-card"><div className="border-b px-4 py-3 font-semibold">{title}</div><div className="p-4 space-y-3">{children}</div></section>; }
function Info({label,value}:{label:string;value:unknown}) { return <div className="flex justify-between border-b py-2 text-sm"><span className="text-muted-foreground">{label}</span><span>{String(value||"—")}</span></div>; }
function CommandOutput({text}:{text:string}) { return <pre className="max-h-96 overflow-auto bg-muted p-3 text-xs leading-6 text-left whitespace-pre-wrap" dir="ltr">{text||"—"}</pre>; }
function DataTable({headers,rows}:{headers:string[];rows:ReactNode[][]}) { return <Table><TableHeader><TableRow>{headers.map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,i)=><TableRow key={i}>{row.map((cell,j)=><TableCell key={j}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>; }
