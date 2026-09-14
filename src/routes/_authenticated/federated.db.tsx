import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, ArchiveRestore, Boxes, Braces, Cable, CheckCircle2, CloudCog, Code2,
  Database, Download, Eye, FileClock, FolderTree, Gauge, HardDrive, KeyRound,
  Layers3, Link2, Loader2, LockKeyhole, Network, Play, Radio, RefreshCw, Search,
  Settings2, ShieldCheck, Table2, Upload, Users, WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  connectDatabaseAgent, getDbStudioData, linkDatabaseServer, provisionSiteIdentities, queueDbStudioAction, runDbStudioQuery, getQueryHistory,
} from "@/lib/dbstudio.functions";
import { TableEditor } from "@/components/dbstudio/TableEditor";
import { TemplateLibrary } from "@/components/dbstudio/TemplateLibrary";
import { EntityRelations } from "@/components/relations/EntityRelations";


export const Route = createFileRoute("/_authenticated/federated/db")({
  component: DbStudioPage,
  head: () => ({ meta: [
    { title: "مركز قواعد البيانات | TVCC" },
    { name: "description", content: "إدارة قواعد البيانات المحلية والسحابية عبر وكيل TVCC." },
    { property: "og:title", content: "مركز قواعد البيانات | TVCC" },
    { property: "og:description", content: "إدارة قواعد البيانات والنسخ والمزامنة بأمان." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Section = { id: string; label: string; icon: typeof Database };
const sections: Section[] = [
  { id: "overview", label: "نظرة عامة", icon: Gauge },
  { id: "tables", label: "محرر الجداول", icon: Table2 },
  { id: "templates", label: "نماذج الجداول", icon: Layers3 },
  { id: "sql", label: "محرر SQL", icon: Code2 },
  { id: "schema", label: "المخطط والعلاقات", icon: Network },
  { id: "auth", label: "المصادقة", icon: Users },
  { id: "storage", label: "التخزين", icon: HardDrive },
  { id: "functions", label: "الدوال", icon: Braces },
  { id: "realtime", label: "Realtime", icon: Radio },
  { id: "advisors", label: "المستشارون", icon: ShieldCheck },
  { id: "monitoring", label: "المراقبة", icon: Activity },
  { id: "integrations", label: "الاتصالات", icon: Link2 },
  { id: "backups", label: "النسخ والاستعادة", icon: ArchiveRestore },
  { id: "sync", label: "المزامنة", icon: RefreshCw },
  { id: "secrets", label: "الأسرار والمفاتيح", icon: KeyRound },
  { id: "transfer", label: "الاستيراد والتصدير", icon: Upload },
  { id: "assistant", label: "مساعد SQL", icon: WandSparkles },
  { id: "activity", label: "سجل النشاط", icon: FileClock },
  { id: "health", label: "الصحة والحدود", icon: Gauge },
  { id: "sites", label: "هوية المواقع", icon: FolderTree },
  { id: "settings", label: "الإعدادات", icon: Settings2 },
];

const statusTone = (status?: string) => status === "online" || status === "connected" || status === "available" || status === "completed"
  ? "default" : status === "pending" || status === "pairing" || status === "queued" ? "secondary" : "outline";

function DbStudioPage() {
  const [section, setSection] = useState("overview");
  const [databaseId, setDatabaseId] = useState("");
  const [search, setSearch] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);
  const client = useQueryClient();

  useEffect(() => {
    mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [section]);
  const fetchStudio = useServerFn(getDbStudioData);
  const connect = useServerFn(connectDatabaseAgent);
  const action = useServerFn(queueDbStudioAction);
  const provision = useServerFn(provisionSiteIdentities);
  const runQuery = useServerFn(runDbStudioQuery);
  const query = useQuery({ queryKey: ["db-studio", databaseId], queryFn: () => fetchStudio({ data: { databaseId: databaseId || undefined } }), refetchInterval: 12_000 });
  const data = query.data;
  const selectedId = databaseId || data?.selected?.id || "";
  const selected = data?.databases.find((row: any) => row.id === selectedId) ?? data?.selected;
  const connection = data?.connections.find((row: any) => row.database_id === selectedId);
  const server = data?.servers.find((row: any) => row.id === selected?.server_id);
  const invalidate = () => client.invalidateQueries({ queryKey: ["db-studio"] });
  const connectMutation = useMutation({ mutationFn: () => connect({ data: { databaseId: selectedId } }), onSuccess: (result) => { toast.success(`رمز الاقتران: ${result.pairingCode}`); invalidate(); }, onError: (e) => toast.error(e.message) });
  const actionMutation = useMutation({ mutationFn: (payload: { action: any; args?: Record<string, unknown> }) => action({ data: { databaseId: selectedId, ...payload } }), onSuccess: () => { toast.success("أُرسلت المهمة إلى الوكيل"); invalidate(); }, onError: (e) => toast.error(e.message) });
  const provisionMutation = useMutation({ mutationFn: () => provision({ data: { databaseId: selectedId } }), onSuccess: (result) => { toast.success(`تمت جدولة ${result.queued} موقعاً`); invalidate(); }, onError: (e) => toast.error(e.message) });

  if (query.isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  return (
    <TooltipProvider>
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
            <div className="flex items-center gap-2"><Database className="size-6 text-primary" /><h1 className="text-xl font-bold">مركز قواعد البيانات</h1></div>
            <Select value={selectedId} onValueChange={setDatabaseId}>
              <SelectTrigger className="mr-auto w-[290px]"><SelectValue placeholder="اختر قاعدة" /></SelectTrigger>
              <SelectContent>{data?.databases.map((db: any) => <SelectItem key={db.id} value={db.id}>{db.name} · {db.db_kind === "internal" ? "داخلية TVCC" : db.db_kind === "local" ? "محلية" : "سحابية"}</SelectItem>)}</SelectContent>
            </Select>
            <Badge variant={statusTone(connection?.status ?? selected?.status)}>{connection?.status ?? selected?.status ?? "غير معروف"}</Badge>
            {selected?.db_kind === "internal" && <Badge variant="default">داخلية TVCC</Badge>}
            <Button variant="outline" size="icon" onClick={() => query.refetch()} aria-label="تحديث"><RefreshCw className="size-4" /></Button>
            <Button disabled={!selectedId || selected?.db_kind === "internal" || connectMutation.isPending || connection?.status === "connected"} onClick={() => connectMutation.mutate()}>
              {connectMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Cable className="size-4" />}
              {selected?.db_kind === "internal" ? "بدون وكيل" : connection?.status === "connected" ? "CONNECTED" : "ربط الوكيل"}
            </Button>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1600px] grid-cols-1">
          <aside className="border-b border-border bg-card/35 p-3">
            <div className="relative mb-3"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث" className="pr-9" /></div>
            <nav className="grid grid-cols-1 gap-1">{sections.filter((item) => item.label.includes(search)).map((item) => <Button key={item.id} variant={section === item.id ? "secondary" : "ghost"} className="justify-start" onClick={() => setSection(item.id)}><item.icon className="size-4 shrink-0" />{item.label}</Button>)}</nav>
          </aside>
          <main ref={mainRef} className="min-w-0 space-y-4 p-4 md:p-6">
            {!selected ? <EmptyState /> : <SectionContent section={section} data={data} selected={selected} connection={connection} server={server} actionMutation={actionMutation} provisionMutation={provisionMutation} runQuery={runQuery} invalidate={invalidate} />}
          </main>

        </div>
      </div>
    </TooltipProvider>
  );
}

function SectionContent({ section, data, selected, connection, server, actionMutation, provisionMutation, runQuery, invalidate }: any) {
  if (section === "overview") return <Overview data={data} selected={selected} connection={connection} server={server} actionMutation={actionMutation} />;
  if (section === "sql" || section === "assistant") return <SqlPanel selected={selected} runQuery={runQuery} invalidate={invalidate} assistant={section === "assistant"} />;
  if (section === "sites") return <SitesPanel data={data} selected={selected} provisionMutation={provisionMutation} />;
  if (section === "tables") return <TableEditor databaseId={selected.id} hasAgent={Boolean(selected.server_id) || selected.db_kind === "internal"} />;
  if (section === "templates") return <TemplateLibrary databaseId={selected.id} hasAgent={Boolean(selected.server_id) || selected.db_kind === "internal"} />;
  if (section === "activity") return <ActivityPanel data={data} />;
  if (section === "backups") return <BackupsPanel data={data} selected={selected} mutation={actionMutation} />;
  if (section === "integrations") return <IntegrationsPanel data={data} selected={selected} connection={connection} server={server} mutation={actionMutation} />;
  if (section === "settings") return <SettingsPanel data={data} selected={selected} connection={connection} server={server} mutation={actionMutation} invalidate={invalidate} />;
  const spec = SECTION_SPECS[section] ?? SECTION_SPECS.monitoring!;
  return <LivePanel spec={spec} data={data} selected={selected} mutation={actionMutation} />;
}

type SectionSpec = {
  title: string; description: string; action: DbActionId; icon: typeof Database;
  extras?: [string, DbActionId, typeof Database][];
  paths: string[]; columns?: string[]; empty: string;
};
type DbActionId = string;

const SECTION_SPECS: Record<string, SectionSpec> = {
  tables: { title: "محرر الجداول", description: "الجداول والصفوف كما قرأها الوكيل من القاعدة الفعلية. القراءة هي الوضع الافتراضي.", action: "pg_meta", icon: Table2, extras: [["قراءة صفوف", "pg_rows", Eye]], paths: ["tables", "rows", "result", "data"], columns: ["schema", "name", "rows", "size"], empty: "لم تُقرأ الجداول بعد — اضغط «قراءة الجداول» ليجلبها الوكيل." },
  schema: { title: "المخطط والعلاقات", description: "الأعمدة والمفاتيح والعلاقات والفهارس كما هي في القاعدة.", action: "pg_meta", icon: Network, paths: ["columns", "relations", "schema", "tables", "result"], empty: "لا يوجد مخطط محفوظ بعد." },
  auth: { title: "المصادقة", description: "المستخدمون ومزوّدو الدخول في القاعدة الهدف.", action: "auth_users", icon: Users, paths: ["users", "result", "data"], columns: ["email", "role", "last_sign_in_at", "created_at"], empty: "لم تُجلب حسابات القاعدة بعد." },
  storage: { title: "التخزين", description: "الحاويات والملفات والاستهلاك الفعلي.", action: "storage_list", icon: HardDrive, paths: ["buckets", "objects", "result", "data"], columns: ["name", "public", "objects", "size"], empty: "لا توجد بيانات تخزين بعد." },
  functions: { title: "الدوال", description: "الدوال والوظائف المنشورة وإصداراتها.", action: "edge_functions_list", icon: Braces, paths: ["functions", "result", "data"], columns: ["name", "version", "status", "updated_at"], empty: "لم تُجلب قائمة الدوال بعد." },
  realtime: { title: "Realtime", description: "القنوات والجداول المنشورة والاتصالات الحية.", action: "realtime_inspect", icon: Radio, paths: ["channels", "publications", "result", "data"], empty: "لا توجد بيانات بث حي بعد." },
  advisors: { title: "المستشارون", description: "نتائج فحص الأمان والأداء مع توصيات قابلة للتنفيذ.", action: "advisor_scan", icon: ShieldCheck, paths: ["findings", "issues", "result", "data"], columns: ["level", "title", "detail"], empty: "لم يُجرَ فحص بعد." },
  monitoring: { title: "المراقبة", description: "الصحة والاتصالات والذاكرة وحجم القاعدة.", action: "db_discover", icon: Activity, paths: ["metrics", "stats", "result", "data"], empty: "لا توجد قياسات بعد." },
  health: { title: "الصحة والحدود", description: "الحجم والاتصالات والحدود ونقاط الاختناق.", action: "db_discover", icon: Gauge, paths: ["limits", "health", "metrics", "result"], empty: "لا توجد بيانات صحة بعد." },
  secrets: { title: "الأسرار والمفاتيح", description: "تُعرض الأسماء والحالة فقط — القيم لا تغادر الخزنة أبداً.", action: "db_discover", icon: LockKeyhole, paths: ["secrets", "env_keys", "result"], columns: ["name", "status", "updated_at"], empty: "لا توجد أسرار مكتشفة على هذه القاعدة." },
  sync: { title: "المزامنة والترحيل", description: "مزامنة محلية وسحابية مع كشف التعارضات دون الكتابة فوق تغييرات أحدث.", action: "db_sync", icon: RefreshCw, extras: [["بدء ترحيل", "db_migrate", CloudCog]], paths: ["synced", "conflicts", "result", "data"], empty: "لم تُنفَّذ مزامنة بعد." },
  transfer: { title: "الاستيراد والتصدير الكامل", description: "مهام طويلة تعمل في الخلفية ويمكن استئنافها.", action: "db_export", icon: Download, extras: [["استيراد كامل", "db_import_full", Upload]], paths: ["files", "artifacts", "result", "data"], empty: "لا توجد عمليات تصدير أو استيراد بعد." },
};

function pickPayload(output: unknown, paths: string[]) {
  if (!output) return null;
  let parsed: any = output;
  if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return { text: parsed }; } }
  if (Array.isArray(parsed)) return { rows: parsed };
  if (typeof parsed !== "object") return { text: String(parsed) };
  for (const key of paths) {
    const value = parsed[key];
    if (Array.isArray(value) && value.length) return { rows: value };
    if (value && typeof value === "object") return { fields: value };
  }
  return { fields: parsed };
}

function latestCommand(commands: any[], selectedId: string, action: string) {
  return commands.find((row: any) => row.action === action && (row.args?.database_id === selectedId || !row.args?.database_id));
}

function LivePanel({ spec, data, selected, mutation }: { spec: SectionSpec; data: any; selected: any; mutation: any }) {
  const command = latestCommand(data.commands, selected.id, spec.action);
  const payload = pickPayload(command?.output, spec.paths);
  const buttons: [string, string, typeof Database][] = [[`قراءة ${spec.title}`, spec.action, spec.icon], ...(spec.extras ?? [])];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold">{spec.title}</h2><p className="text-muted-foreground">{spec.description}</p></div>
      <div className="flex flex-wrap gap-2">{buttons.map(([label, action, Icon]) => (
        <Button key={action} variant={action === spec.action ? "default" : "outline"} disabled={mutation.isPending} onClick={() => mutation.mutate({ action })}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}{label}
        </Button>
      ))}</div>
    </div>
    <CommandStatus command={command} />
    {payload ? <PayloadView payload={payload} columns={spec.columns} /> : <EmptyPanel text={spec.empty} />}
  </div>;
}

function CommandStatus({ command }: { command: any }) {
  if (!command) return null;
  const done = command.completed_at ? new Date(command.completed_at) : command.created_at ? new Date(command.created_at) : null;
  return <Card><CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
    <Badge variant={statusTone(command.status)}>{command.status}</Badge>
    <span className="font-mono text-muted-foreground">{command.action}</span>
    {done && <span className="text-muted-foreground">آخر تحديث: {done.toLocaleString("ar")}</span>}
    {typeof command.exit_code === "number" && <span className="text-muted-foreground">رمز الخروج: {command.exit_code}</span>}
    {command.status === "pending" && <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />بانتظار التقاط الوكيل للمهمة</span>}
  </CardContent></Card>;
}

function PayloadView({ payload, columns }: { payload: any; columns?: string[] }) {
  if (payload.text) return <Card><CardContent className="p-4"><pre dir="ltr" className="max-h-[520px] overflow-auto whitespace-pre-wrap font-mono text-xs">{payload.text}</pre></CardContent></Card>;
  if (payload.rows?.length) {
    const keys = columns?.filter((key) => key in (payload.rows[0] ?? {})) ?? [];
    const headers = keys.length ? keys : Object.keys(payload.rows[0] ?? {}).slice(0, 8);
    return <Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm">
      <thead><tr className="border-b border-border text-right">{headers.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{payload.rows.slice(0, 200).map((row: any, index: number) => <tr key={index} className="border-b border-border/60">{headers.map((h) => <td key={h} className="p-3 font-mono text-xs" dir="ltr">{formatCell(row[h])}</td>)}</tr>)}</tbody>
    </table></CardContent></Card>;
  }
  const entries = Object.entries(payload.fields ?? {});
  if (!entries.length) return <EmptyPanel text="النتيجة فارغة." />;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{entries.slice(0, 24).map(([key, value]) => (
    <Card key={key}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{key}</p><p className="mt-1 break-all font-mono text-sm" dir="ltr">{formatCell(value)}</p></CardContent></Card>
  ))}</div>;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 120);
  return String(value);
}

function EmptyPanel({ text }: { text: string }) {
  return <Card><CardContent className="grid min-h-40 place-items-center p-6 text-center text-muted-foreground">{text}</CardContent></Card>;
}

function BackupsPanel({ data, selected, mutation }: any) {
  const rows = data.backups ?? [];
  const verified = rows.filter((row: any) => row.verified_at).length;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold">النسخ والاستعادة</h2><p className="text-muted-foreground">نسخ مشفّرة على {selected.name} مع تحقق من السلامة واستعادة عبر الوكيل.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "backup_run" })}><Download className="size-4" />نسخة الآن</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "backup_verify" })}><CheckCircle2 className="size-4" />تحقق</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "backup_restore" })}><ArchiveRestore className="size-4" />استعادة</Button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="النسخ المسجّلة" value={rows.length} /><Stat label="تم التحقق منها" value={verified} /><Stat label="المواقع المرتبطة" value={data.siteDatabases.filter((row: any) => row.database_id === selected.id).length} /></div>
    {rows.length ? <Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm">
      <thead><tr className="border-b border-border text-right"><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">الحجم</th><th className="p-3">التحقق</th><th className="p-3">التاريخ</th></tr></thead>
      <tbody>{rows.map((row: any) => <tr key={row.id} className="border-b border-border/60">
        <td className="p-3">{row.backup_type ?? "—"}</td><td className="p-3"><Badge variant={statusTone(row.status)}>{row.status}</Badge></td>
        <td className="p-3 font-mono text-xs">{row.size_bytes ? `${(row.size_bytes / 1048576).toFixed(1)} MB` : "—"}</td>
        <td className="p-3">{row.verified_at ? <CheckCircle2 className="size-4 text-primary" /> : "—"}</td>
        <td className="p-3 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("ar")}</td>
      </tr>)}</tbody>
    </table></CardContent></Card> : <EmptyPanel text="لا توجد نسخ احتياطية بعد — شغّل «نسخة الآن»." />}
  </div>;
}

function IntegrationsPanel({ data, selected, connection, server, mutation }: any) {
  const tunnel = latestCommand(data.commands, selected.id, "tunnel_status");
  const rows: [string, string][] = [
    ["نوع القاعدة", selected.db_kind === "local" ? "محلية عبر الوكيل" : "سحابية"],
    ["المحرك", selected.db_type ?? "—"], ["العنوان", `${selected.host ?? "—"}:${selected.port ?? "—"}`],
    ["اسم القاعدة", selected.db_name ?? "—"], ["السيرفر", server?.name ?? "غير مرتبط"],
    ["إصدار الوكيل", server?.agent_version ?? "—"], ["آخر ظهور للوكيل", server?.last_seen_at ? new Date(server.last_seen_at).toLocaleString("ar") : "—"],
    ["حالة الاقتران", connection?.status ?? "غير مقترن"], ["نوع الاتصال", connection?.connection_kind ?? "—"],
    ["آخر خطأ", connection?.last_error ?? "لا يوجد"], ["حالة النفق", tunnel?.status ?? "لم يُفحص"],
  ];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold">الاتصالات</h2><p className="text-muted-foreground">حالة الوكيل والنفق والقاعدة المحلية والسحابية.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "tunnel_status" })}><Cable className="size-4" />فحص النفق</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "tunnel_setup" })}><Link2 className="size-4" />تهيئة النفق</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "tunnel_drop" })}><LockKeyhole className="size-4" />إغلاق النفق</Button>
      </div>
    </div>
    <Card><CardContent className="grid gap-0 p-0 sm:grid-cols-2">{rows.map(([label, value]) => (
      <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 p-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="truncate font-mono text-xs" dir="ltr">{value}</span></div>
    ))}</CardContent></Card>
    <CommandStatus command={tunnel} />
  </div>;
}

function SettingsPanel({ data, selected, connection, server, mutation, invalidate }: any) {
  const link = useServerFn(linkDatabaseServer);
  const [serverId, setServerId] = useState(selected.server_id ?? "");
  const linkMutation = useMutation({
    mutationFn: () => link({ data: { databaseId: selected.id, serverId: serverId || null } }),
    onSuccess: () => { toast.success("تم ربط القاعدة بالسيرفر"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold">إعدادات القاعدة</h2><p className="text-muted-foreground">بيانات الاتصال والربط بالوكيل. القيم الحسّاسة تبقى في الخزنة.</p></div>
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "agent_update" })}><CloudCog className="size-4" />تحديث الوكيل</Button>
    </div>
    <Card><CardHeader><CardTitle>السيرفر المسؤول (الوكيل)</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3">
      <Select value={serverId} onValueChange={setServerId}>
        <SelectTrigger className="w-[320px]"><SelectValue placeholder="اختر سيرفراً عليه وكيل TVCC" /></SelectTrigger>
        <SelectContent>{(data?.servers ?? []).map((row: any) => <SelectItem key={row.id} value={row.id}>{row.name} · {row.status ?? "—"}</SelectItem>)}</SelectContent>
      </Select>
      <Button disabled={linkMutation.isPending || serverId === (selected.server_id ?? "")} onClick={() => linkMutation.mutate()}>
        {linkMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Cable className="size-4" />}حفظ الربط
      </Button>
      {!selected.server_id && <span className="text-sm text-destructive">غير مرتبطة بوكيل — محرر الجداول والنماذج معطّلة حتى تُربط.</span>}
    </CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[["الاسم", selected.name], ["المعرف", selected.id], ["المحرك", selected.db_type], ["المضيف", selected.host], ["المنفذ", selected.port], ["القاعدة", selected.db_name], ["مفتاح البيئة", selected.env_key], ["أساسية", selected.is_primary ? "نعم" : "لا"], ["حالة الاقتران", connection?.status ?? selected.pairing_status ?? "—"], ["السيرفر", server?.name ?? "—"]].map(([label, value]: any) => (
        <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-all font-mono text-sm" dir="ltr">{value ?? "—"}</p></CardContent></Card>
      ))}
    </div>
  </div>;
}

function Overview({ data, selected, connection, server, actionMutation }: any) {
  const linked = data.siteDatabases.filter((row: any) => row.database_id === selected.id);
  const recent = data.commands.filter((row: any) => row.args?.database_id === selected.id).slice(0, 8);
  const stats = [
    ["الجداول", selected.tables_count ?? "—", Table2], ["الصفوف", selected.rows_count ?? "—", Layers3],
    ["المواقع المرتبطة", linked.length, Boxes], ["الوكيل", server?.agent_version ?? "بانتظار", Cable],
  ];
  return <div className="space-y-5">
    <section className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{selected.db_kind === "internal" ? "قاعدة منصة TVCC الداخلية — وصول مباشر بدون وكيل" : selected.db_kind === "local" ? "قاعدة محلية عبر وكيل TVCC" : "قاعدة سحابية"}</p><h2 className="text-3xl font-bold">{selected.name}</h2><p className="mt-1 font-mono text-sm text-muted-foreground">{selected.host}:{selected.port} / {selected.db_name}</p></div><div className="flex gap-2"><Badge variant={statusTone(server?.status)}>{selected.db_kind === "internal" ? "داخلية" : server?.status ?? "لا يوجد سيرفر"}</Badge><Badge variant={statusTone(connection?.status)}>{selected.db_kind === "internal" ? "متصلة" : connection?.status ?? "غير مقترن"}</Badge></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, Icon]: any) => <Card key={label}><CardContent className="flex items-center gap-3 p-4"><Icon className="size-8 text-primary" /><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>التحكم السريع</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button onClick={() => actionMutation.mutate({ action: "db_discover" })}><RefreshCw className="size-4" />اكتشاف المزايا</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: "db_sync" })}><CloudCog className="size-4" />مزامنة</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: "backup_run" })}><Download className="size-4" />نسخة احتياطية</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: "advisor_scan" })}><ShieldCheck className="size-4" />فحص الأمان</Button></CardContent></Card>
    <EntityRelations databaseId={selected.id} serverId={selected.server_id ?? null} websiteId={selected.website_id ?? null} />
    <Card><CardHeader><CardTitle>آخر مهام الوكيل</CardTitle></CardHeader><CardContent><div className="space-y-2">{recent.length ? recent.map((row: any) => <div key={row.id} className="flex items-center justify-between border-b border-border py-2 text-sm"><span className="font-mono">{row.action}</span><Badge variant={statusTone(row.status)}>{row.status}</Badge></div>) : <p className="text-muted-foreground">لا توجد مهام بعد.</p>}</div></CardContent></Card>
  </div>;
}

const SQL_SNIPPETS: [string, string][] = [
  ["كل الجداول", "SELECT table_name, table_type\nFROM information_schema.tables\nWHERE table_schema = 'public'\nORDER BY table_name;"],
  ["أكبر الجداول", "SELECT relname AS table_name, n_live_tup AS rows\nFROM pg_stat_user_tables\nORDER BY n_live_tup DESC\nLIMIT 20;"],
  ["أعمدة جدول", "SELECT column_name, data_type, is_nullable, column_default\nFROM information_schema.columns\nWHERE table_schema = 'public' AND table_name = 'websites'\nORDER BY ordinal_position;"],
  ["سياسات RLS", "SELECT schemaname, tablename, policyname, cmd\nFROM pg_policies\nWHERE schemaname = 'public'\nORDER BY tablename;"],
  ["حجم القاعدة", "SELECT pg_size_pretty(pg_database_size(current_database())) AS size;"],
];

function SqlPanel({ selected, runQuery, invalidate, assistant }: any) {
  const internal = selected.db_kind === "internal";
  const [sql, setSql] = useState(assistant ? "-- اكتب طلبك ثم حوّله إلى SQL\nSELECT current_database(), now();" : "SELECT * FROM information_schema.tables\nWHERE table_schema = 'public'\nLIMIT 100;");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ rows: any[]; durationMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyFn = useServerFn(getQueryHistory);
  const history = useQuery({ queryKey: ["sql-history", selected.id], queryFn: () => historyFn({ data: { databaseId: selected.id } }) });

  const mutation = useMutation({
    mutationFn: () => runQuery({ data: { databaseId: selected.id, sql, confirmWrite: confirm, title: assistant ? "مساعد SQL" : "SQL Studio" } }),
    onSuccess: (res: any) => {
      setError(null);
      if (res?.direct) {
        setResult({ rows: res.rows ?? [], durationMs: res.durationMs ?? 0 });
        toast.success(`تم التنفيذ — ${res.rowCount ?? 0} صف في ${res.durationMs ?? 0}ms`);
      } else {
        setResult(null);
        toast.success("دخل الاستعلام مركز المهام لدى الوكيل");
      }
      history.refetch();
      invalidate();
    },
    onError: (e: any) => { setResult(null); setError(e.message); toast.error(e.message); },
  });

  const run = () => { if (!mutation.isPending) mutation.mutate(); };
  const columns = result?.rows?.length ? Object.keys(result.rows[0] ?? {}) : [];
  const exportCsv = () => {
    if (!result?.rows?.length) return;
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.join(","), ...result.rows.map((r) => columns.map((c) => esc(typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `query-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold">{assistant ? "مساعد SQL" : "محرر SQL"}</h2>
        <p className="text-muted-foreground">{internal ? "تنفيذ مباشر على " + selected.name + " بصلاحيات المالك/المدير — القراءة والكتابة." : "تنفيذ عبر مركز مهام الوكيل على " + selected.name + "."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SQL_SNIPPETS.map(([label, snippet]) => (
          <Button key={label} size="sm" variant="outline" onClick={() => setSql(snippet)}>{label}</Button>
        ))}
      </div>
    </div>
    <Textarea
      value={sql}
      onChange={(e) => setSql(e.target.value)}
      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
      dir="ltr"
      className="min-h-[260px] font-mono"
    />
    <div className="flex flex-wrap items-center gap-3">
      <Switch checked={confirm} onCheckedChange={setConfirm} id="confirm-write" />
      <label htmlFor="confirm-write" className="text-sm">تأكيد السماح بالكتابة لهذا الاستعلام</label>
      <span className="text-xs text-muted-foreground">Ctrl/⌘ + Enter للتنفيذ</span>
      {result && <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4" />تصدير CSV</Button>}
      <Button className="mr-auto" disabled={mutation.isPending} onClick={run}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}تنفيذ</Button>
    </div>

    {error && <Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive" dir="ltr">{error}</CardContent></Card>}

    {result && <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>النتيجة</CardTitle>
        <span className="text-sm text-muted-foreground">{result.rows.length} صف · {result.durationMs}ms</span>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {result.rows.length ? <table className="w-full text-sm" dir="ltr">
          <thead><tr className="border-b border-border text-left">{columns.map((c) => <th key={c} className="whitespace-nowrap p-3 font-mono text-xs">{c}</th>)}</tr></thead>
          <tbody>{result.rows.slice(0, 200).map((row, i) => (
            <tr key={i} className="border-b border-border/60">{columns.map((c) => <td key={c} className="max-w-[320px] truncate p-3 font-mono text-xs">{typeof row[c] === "object" && row[c] !== null ? JSON.stringify(row[c]) : String(row[c] ?? "—")}</td>)}</tr>
          ))}</tbody>
        </table> : <p className="p-4 text-muted-foreground">نُفِّذ الاستعلام بنجاح دون صفوف مُعادة.</p>}
      </CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle>سجل الاستعلامات</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(history.data ?? []).length ? (history.data as any[]).map((row) => (
          <div key={row.id} className="flex items-center gap-3 border-b border-border/60 pb-2 text-sm">
            <Badge variant={statusTone(row.status)}>{row.mode}</Badge>
            <code className="flex-1 truncate font-mono text-xs" dir="ltr">{row.sql_text}</code>
            <Button size="sm" variant="ghost" onClick={() => setSql(row.sql_text)}>استرجاع</Button>
          </div>
        )) : <p className="text-muted-foreground">لا يوجد سجل بعد.</p>}
      </CardContent>
    </Card>
  </div>;
}


function SitesPanel({ data, selected, provisionMutation }: any) {
  const rows = data.siteDatabases.filter((row: any) => row.database_id === selected.id);
  const ready = rows.filter((row: any) => row.provisioning_status === "ready").length;
  return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold">هوية تخزين موحّدة لكل موقع</h2><p className="text-muted-foreground">مخطط بيانات وملف خادم يحملان معرف الموقع نفسه.</p></div><Button disabled={provisionMutation.isPending} onClick={() => provisionMutation.mutate()}>{provisionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FolderTree className="size-4" />}تهيئة جميع المواقع</Button></div><div className="grid gap-3 sm:grid-cols-3"><Stat label="المواقع" value={data.websites.length} /><Stat label="تمت جدولتها" value={rows.length} /><Stat label="جاهزة" value={ready} /></div><Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b border-border text-right"><th className="p-3">المعرف</th><th className="p-3">المخطط</th><th className="p-3">مسار الخادم</th><th className="p-3">الحالة</th></tr></thead><tbody>{rows.slice(0, 100).map((row: any) => <tr key={row.id} className="border-b border-border/60"><td className="p-3 font-mono">{row.site_code ?? "—"}</td><td className="p-3 font-mono">{row.schema_name ?? "—"}</td><td className="p-3 font-mono" dir="ltr">{row.server_path ?? "—"}</td><td className="p-3"><Badge variant={statusTone(row.provisioning_status)}>{row.provisioning_status}</Badge></td></tr>)}</tbody></table></CardContent></Card></div>;
}

function ActivityPanel({ data }: any) { return <div className="space-y-4"><h2 className="text-2xl font-bold">سجل النشاط</h2>{data.audits.map((row: any) => <Card key={row.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{row.action}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("ar")}</p></div><Badge variant="outline">{row.resource_id?.slice(0, 8)}</Badge></CardContent></Card>)}</div>; }
function Stat({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>; }
function EmptyState() { return <div className="grid min-h-[50vh] place-items-center text-center"><div><Database className="mx-auto mb-3 size-12 text-muted-foreground" /><h2 className="text-xl font-bold">لا توجد قاعدة محددة</h2><p className="text-muted-foreground">سجّل قاعدة ثم اربطها بوكيل TVCC.</p></div></div>; }
