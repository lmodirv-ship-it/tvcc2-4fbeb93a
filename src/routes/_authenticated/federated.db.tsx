import { useMemo, useState } from "react";
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
  connectDatabaseAgent, getDbStudioData, provisionSiteIdentities, queueDbStudioAction, runDbStudioQuery,
} from "@/lib/dbstudio.functions";

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
  const client = useQueryClient();
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
              <SelectContent>{data?.databases.map((db: any) => <SelectItem key={db.id} value={db.id}>{db.name} · {db.db_kind === "local" ? "محلية" : "سحابية"}</SelectItem>)}</SelectContent>
            </Select>
            <Badge variant={statusTone(connection?.status ?? selected?.status)}>{connection?.status ?? selected?.status ?? "غير معروف"}</Badge>
            <Button variant="outline" size="icon" onClick={() => query.refetch()} aria-label="تحديث"><RefreshCw className="size-4" /></Button>
            <Button disabled={!selectedId || connectMutation.isPending || connection?.status === "connected"} onClick={() => connectMutation.mutate()}>
              {connectMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Cable className="size-4" />}
              {connection?.status === "connected" ? "CONNECTED" : "ربط الوكيل"}
            </Button>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-card/35 p-3 lg:min-h-[calc(100vh-70px)] lg:border-b-0 lg:border-l">
            <div className="relative mb-3"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث" className="pr-9" /></div>
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">{sections.filter((item) => item.label.includes(search)).map((item) => <Button key={item.id} variant={section === item.id ? "secondary" : "ghost"} className="justify-start" onClick={() => setSection(item.id)}><item.icon className="size-4" />{item.label}</Button>)}</nav>
          </aside>
          <main className="min-w-0 p-4 md:p-6">
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
  if (section === "activity") return <ActivityPanel data={data} />;
  if (section === "backups") return <ActionPanel title="النسخ والاستعادة" description="نسخ مشفرة، تحقق من السلامة، واستعادة عبر الوكيل." actions={[ ["نسخة الآن", "backup_run", Download], ["تحقق", "backup_verify", CheckCircle2], ["استعادة", "backup_restore", ArchiveRestore] ]} mutation={actionMutation} />;
  if (section === "transfer") return <ActionPanel title="الاستيراد والتصدير الكامل" description="المهام الطويلة تعمل في مركز المهام ويمكن استئنافها." actions={[ ["تصدير كامل", "db_export", Download], ["استيراد كامل", "db_import_full", Upload] ]} mutation={actionMutation} />;
  if (section === "sync") return <ActionPanel title="المزامنة والترحيل" description="مزامنة محلية وسحابية مع كشف التعارضات دون الكتابة فوق تغييرات أحدث." actions={[ ["مزامنة الآن", "db_sync", RefreshCw], ["بدء ترحيل", "db_migrate", CloudCog] ]} mutation={actionMutation} />;
  const mapped: Record<string, [string, string, typeof Database, string]> = {
    tables: ["محرر الجداول", "pg_rows", Table2, "استكشاف الجداول والصفوف من خلال الوكيل. وضع القراءة هو الافتراضي."],
    schema: ["المخطط والعلاقات", "pg_meta", Network, "الجداول والأعمدة والمفاتيح والعلاقات والفهارس."],
    auth: ["المصادقة", "auth_users", Users, "المستخدمون ومزوّدو الدخول والسياسات المرتبطة."],
    storage: ["التخزين", "storage_list", HardDrive, "الحاويات والملفات والسياسات والاستهلاك."],
    functions: ["الدوال", "edge_functions_list", Braces, "الدوال والوظائف والإصدارات والسجلات."],
    realtime: ["Realtime", "realtime_inspect", Radio, "القنوات والجداول المنشورة والاتصالات الحية."],
    advisors: ["المستشارون", "advisor_scan", ShieldCheck, "فحص الأمان والأداء مع توصيات قابلة للتنفيذ."],
    monitoring: ["المراقبة", "db_discover", Activity, "الصحة والاتصالات والذاكرة والحجم والاستعلامات."],
    integrations: ["الاتصالات", "db_discover", Link2, "حالة الوكيل والنفق والقاعدة المحلية والسحابية."],
    health: ["الصحة والحدود", "db_discover", Gauge, "الحجم والاتصالات والحدود ونقاط الاختناق."],
    secrets: ["الأسرار والمفاتيح", "db_discover", LockKeyhole, "تُعرض أسماء الأسرار وحالتها فقط؛ القيم تبقى داخل الخزنة."],
    settings: ["إعدادات المشروع", "db_discover", Settings2, "إعدادات الاتصال والمخطط والمنافذ والربط بالوكيل."],
  };
  const item = mapped[section] ?? mapped.monitoring;
  return <ActionPanel title={item[0]} description={item[3]} actions={[["تحديث البيانات", item[1], item[2]]]} mutation={actionMutation} />;
}

function Overview({ data, selected, connection, server, actionMutation }: any) {
  const linked = data.siteDatabases.filter((row: any) => row.database_id === selected.id);
  const recent = data.commands.filter((row: any) => row.args?.database_id === selected.id).slice(0, 8);
  const stats = [
    ["الجداول", selected.tables_count ?? "—", Table2], ["الصفوف", selected.rows_count ?? "—", Layers3],
    ["المواقع المرتبطة", linked.length, Boxes], ["الوكيل", server?.agent_version ?? "بانتظار", Cable],
  ];
  return <div className="space-y-5">
    <section className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{selected.db_kind === "local" ? "قاعدة محلية عبر وكيل TVCC" : "قاعدة سحابية"}</p><h2 className="text-3xl font-bold">{selected.name}</h2><p className="mt-1 font-mono text-sm text-muted-foreground">{selected.host}:{selected.port} / {selected.db_name}</p></div><div className="flex gap-2"><Badge variant={statusTone(server?.status)}>{server?.status ?? "لا يوجد سيرفر"}</Badge><Badge variant={statusTone(connection?.status)}>{connection?.status ?? "غير مقترن"}</Badge></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, Icon]: any) => <Card key={label}><CardContent className="flex items-center gap-3 p-4"><Icon className="size-8 text-primary" /><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>التحكم السريع</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button onClick={() => actionMutation.mutate({ action: "db_discover" })}><RefreshCw className="size-4" />اكتشاف المزايا</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: "db_sync" })}><CloudCog className="size-4" />مزامنة</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: "backup_run" })}><Download className="size-4" />نسخة احتياطية</Button><Button variant="outline" onClick={() => actionMutation.mutate({ action: "advisor_scan" })}><ShieldCheck className="size-4" />فحص الأمان</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>آخر مهام الوكيل</CardTitle></CardHeader><CardContent><div className="space-y-2">{recent.length ? recent.map((row: any) => <div key={row.id} className="flex items-center justify-between border-b border-border py-2 text-sm"><span className="font-mono">{row.action}</span><Badge variant={statusTone(row.status)}>{row.status}</Badge></div>) : <p className="text-muted-foreground">لا توجد مهام بعد.</p>}</div></CardContent></Card>
  </div>;
}

function SqlPanel({ selected, runQuery, invalidate, assistant }: any) {
  const [sql, setSql] = useState(assistant ? "-- اكتب طلبك ثم حوّله إلى SQL\nSELECT current_database(), now();" : "SELECT * FROM information_schema.tables\nWHERE table_schema = 'public'\nLIMIT 100;");
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation({ mutationFn: () => runQuery({ data: { databaseId: selected.id, sql, confirmWrite: confirm, title: assistant ? "مساعد SQL" : "SQL Studio" } }), onSuccess: () => { toast.success("دخل الاستعلام مركز المهام"); invalidate(); }, onError: (e) => toast.error(e.message) });
  return <div className="space-y-4"><div><h2 className="text-2xl font-bold">{assistant ? "مساعد SQL" : "محرر SQL"}</h2><p className="text-muted-foreground">التنفيذ عبر الوكيل على {selected.name}. القراءة فقط افتراضياً.</p></div><Textarea value={sql} onChange={(e) => setSql(e.target.value)} dir="ltr" className="min-h-[330px] font-mono" /><div className="flex flex-wrap items-center gap-3"><Switch checked={confirm} onCheckedChange={setConfirm} id="confirm-write" /><label htmlFor="confirm-write" className="text-sm">تأكيد السماح بالكتابة لهذا الاستعلام</label><Button className="mr-auto" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}تنفيذ</Button></div></div>;
}

function SitesPanel({ data, selected, provisionMutation }: any) {
  const rows = data.siteDatabases.filter((row: any) => row.database_id === selected.id);
  const ready = rows.filter((row: any) => row.provisioning_status === "ready").length;
  return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold">هوية تخزين موحّدة لكل موقع</h2><p className="text-muted-foreground">مخطط بيانات وملف خادم يحملان معرف الموقع نفسه.</p></div><Button disabled={provisionMutation.isPending} onClick={() => provisionMutation.mutate()}>{provisionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FolderTree className="size-4" />}تهيئة جميع المواقع</Button></div><div className="grid gap-3 sm:grid-cols-3"><Stat label="المواقع" value={data.websites.length} /><Stat label="تمت جدولتها" value={rows.length} /><Stat label="جاهزة" value={ready} /></div><Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b border-border text-right"><th className="p-3">المعرف</th><th className="p-3">المخطط</th><th className="p-3">مسار الخادم</th><th className="p-3">الحالة</th></tr></thead><tbody>{rows.slice(0, 100).map((row: any) => <tr key={row.id} className="border-b border-border/60"><td className="p-3 font-mono">{row.site_code ?? "—"}</td><td className="p-3 font-mono">{row.schema_name ?? "—"}</td><td className="p-3 font-mono" dir="ltr">{row.server_path ?? "—"}</td><td className="p-3"><Badge variant={statusTone(row.provisioning_status)}>{row.provisioning_status}</Badge></td></tr>)}</tbody></table></CardContent></Card></div>;
}

function ActivityPanel({ data }: any) { return <div className="space-y-4"><h2 className="text-2xl font-bold">سجل النشاط</h2>{data.audits.map((row: any) => <Card key={row.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{row.action}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("ar")}</p></div><Badge variant="outline">{row.resource_id?.slice(0, 8)}</Badge></CardContent></Card>)}</div>; }
function ActionPanel({ title, description, actions, mutation }: any) { return <div className="space-y-5"><div><h2 className="text-2xl font-bold">{title}</h2><p className="text-muted-foreground">{description}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{actions.map(([label, action, Icon]: any) => <Card key={action}><CardContent className="flex min-h-40 flex-col justify-between gap-5 p-5"><Icon className="size-9 text-primary" /><div><p className="font-semibold">{label}</p><p className="mt-1 text-sm text-muted-foreground">تنفيذ آمن ومسجل عبر وكيل TVCC.</p></div><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ action })}><Play className="size-4" />تشغيل</Button></CardContent></Card>)}</div></div>; }
function Stat({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>; }
function EmptyState() { return <div className="grid min-h-[50vh] place-items-center text-center"><div><Database className="mx-auto mb-3 size-12 text-muted-foreground" /><h2 className="text-xl font-bold">لا توجد قاعدة محددة</h2><p className="text-muted-foreground">سجّل قاعدة ثم اربطها بوكيل TVCC.</p></div></div>; }
