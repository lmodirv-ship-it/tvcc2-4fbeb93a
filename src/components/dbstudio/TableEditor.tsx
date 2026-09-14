import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownAZ, ArrowUpAZ, ChevronLeft, ChevronRight, Columns3, Copy, Database, Download, Eye, Filter,
  KeyRound, Loader2, MoreHorizontal, PanelRightClose, PanelRightOpen, Plus, RefreshCw, Rows3, Save, Search, Shield, ShieldAlert, ShieldCheck, Star,
  Table2, Trash2, Undo2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  applyTableDdl, getEditorCommands, importTableCsv, readCatalog, readTableRows, writeTableRows,
} from "@/lib/dbstudio.functions";
import {
  commandTone, downloadText, extractRows, extractTotal, findCommand, parseOutput, toCsv,
  type AgentCommand,
} from "./agent-result";

const TYPES = ["int8", "int4", "text", "varchar", "bool", "uuid", "timestamptz", "date", "numeric", "jsonb", "float8"];
const OPS: [string, string][] = [
  ["eq", "="], ["neq", "≠"], ["gt", ">"], ["lt", "<"], ["gte", "≥"], ["lte", "≤"],
  ["like", "يحتوي"], ["isnull", "فارغ"], ["notnull", "غير فارغ"],
];
type FilterRow = { column: string; op: string; value: string };

/** معرّف ثابت لكل جدول: حرف + ستة أرقام (مثل D222222) مشتق من اسم المخطط والجدول. */
function tableCode(schema: string, name: string) {
  const key = `${schema}.${name}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `D${String(hash % 1000000).padStart(6, "0")}`;
}

export function TableEditor({ databaseId, hasAgent = true }: { databaseId: string; hasAgent?: boolean }) {
  const fetchCommands = useServerFn(getEditorCommands);
  const catalog = useServerFn(readCatalog);
  const rowsFn = useServerFn(readTableRows);
  const writeFn = useServerFn(writeTableRows);
  const ddlFn = useServerFn(applyTableDdl);
  const csvFn = useServerFn(importTableCsv);

  const [schema, setSchema] = useState("public");
  const [table, setTable] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sort, setSort] = useState<{ column: string; dir: "asc" | "desc" } | null>(null);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [inserts, setInserts] = useState<Record<string, unknown>[]>([]);
  const [deletes, setDeletes] = useState<string[]>([]);
  const [drawerRow, setDrawerRow] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [openTables, setOpenTables] = useState<string[]>([]);
  const [catalogCollapsed, setCatalogCollapsed] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const queued = useRef<Set<string>>(new Set());

  const [local, setLocal] = useState<AgentCommand[]>([]);
  const push = (result: any) => {
    const cmd = result?.action ? result : result?.command?.action ? result.command : null;
    if (cmd) setLocal((prev) => [cmd as AgentCommand, ...prev].slice(0, 80));
    return result;
  };

  const query = useQuery({
    queryKey: ["db-editor", databaseId],
    queryFn: () => fetchCommands({ data: { databaseId } }) as Promise<AgentCommand[]>,
    refetchInterval: 6000,
    enabled: Boolean(databaseId),
  });
  const commands = useMemo(() => [...local, ...((query.data ?? []) as AgentCommand[])], [local, query.data]);

  const schemasCmd = findCommand(commands, "pg_meta", (a) => a.mode === "schemas");
  const tablesCmd = findCommand(commands, "pg_meta", (a) => a.mode === "tables" && a.schema === schema && !a.template_id);
  const columnsCmd = findCommand(commands, "pg_meta", (a) => a.mode === "columns" && a.schema === schema && a.table === table);
  const policiesCmd = findCommand(commands, "db_policy", (a) => a.schema === schema && a.table === table);
  const rowsCmd = findCommand(commands, "pg_rows", (a) => a.schema === schema && a.table === table);
  const writeCmd = findCommand(commands, "pg_write", (a) => a.schema === schema && a.table === table);
  const ddlCmd = findCommand(commands, "pg_ddl", (a) => a.schema === schema);

  const schemas = useMemo(() => {
    const list = (extractRows(schemasCmd?.output) ?? []).map((row: any) => row.schema ?? row.nspname).filter(Boolean);
    return list.length ? Array.from(new Set<string>(["public", ...list])) : ["public"];
  }, [schemasCmd]);
  const tables = useMemo(() => extractRows(tablesCmd?.output) ?? [], [tablesCmd]);
  const columns = useMemo(() => extractRows(columnsCmd?.output) ?? [], [columnsCmd]);
  const policies = useMemo(() => extractRows(policiesCmd?.output) ?? [], [policiesCmd]);
  const rows = useMemo(() => extractRows(rowsCmd?.output) ?? [], [rowsCmd]);
  const total = extractTotal(rowsCmd?.output);
  const pk = useMemo(() => columns.find((c: any) => c.is_primary)?.name ?? "id", [columns]);
  const headers = useMemo(() => {
    const fromColumns = columns.map((c: any) => c.name as string);
    const fromRows = rows.length ? Object.keys(rows[0]) : [];
    const all = fromColumns.length ? fromColumns : fromRows;
    return all.filter((name) => !hidden.includes(name));
  }, [columns, rows, hidden]);
  const columnInfo = useMemo(() => Object.fromEntries(columns.map((c: any) => [c.name, c])), [columns]);
  const currentTable = tables.find((t: any) => t.name === table);

  const runOnce = (key: string, fn: () => Promise<unknown>) => {
    if (!hasAgent) return;
    if (queued.current.has(key)) return;
    queued.current.add(key);
    void fn().then((r) => { push(r); query.refetch(); }).catch((e: any) => toast.error(e?.message ?? "تعذّر تنفيذ الطلب عبر الوكيل"));
  };

  useEffect(() => {
    if (!databaseId || !hasAgent) return;
    // نطلب دائماً قائمة محدّثة للمخططات والجداول حتى لا تُستخدم نتيجة قديمة من السجل.
    runOnce(`schemas:${databaseId}`, () => catalog({ data: { databaseId, mode: "schemas" } }));
    runOnce(`tables:${databaseId}:${schema}`, () => catalog({ data: { databaseId, mode: "tables", schema } }));
  }, [databaseId, schema]);

  useEffect(() => {
    if (!databaseId || !table || !hasAgent) return;
    if (!columnsCmd) runOnce(`cols:${schema}.${table}`, () => catalog({ data: { databaseId, mode: "columns", schema, table } }));
    if (!rowsCmd) runOnce(`rows:${schema}.${table}`, () => rowsFn({ data: { databaseId, schema, table, page, pageSize } }));
  }, [databaseId, schema, table, columnsCmd, rowsCmd]);

  const refreshTables = useMutation({
    mutationFn: () => catalog({ data: { databaseId, mode: "tables", schema } }),
    onSuccess: (r: any) => { push(r); toast.success("تم تحديث قائمة الجداول"); query.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const refreshRows = useMutation({
    mutationFn: (next?: { page?: number }) => rowsFn({
      data: { databaseId, schema, table, page: next?.page ?? page, pageSize, sort, filters: filters.filter((f) => f.column) },
    }),
    onSuccess: (r: any) => { push(r); toast.success("تم تحديث الصفوف"); query.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveChanges = useMutation({
    mutationFn: () => writeFn({
      data: {
        databaseId, schema, table, pk, confirm: true,
        inserts, deletes,
        updates: Object.entries(edits).map(([id, values]) => ({ pk: id, values })),
      },
    }),
    onSuccess: (r: any) => {
      push(r);
      toast.success("تم حفظ التغييرات وتسجيلها");
      setEdits({}); setInserts([]); setDeletes([]); setSelected([]);
      query.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const ddl = useMutation({
    mutationFn: (payload: any) => ddlFn({ data: { databaseId, confirm: true, schema, ...payload } }),
    onSuccess: (r: any) => { push(r); toast.success("تم تنفيذ تغيير البنية"); query.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const importCsv = useMutation({
    mutationFn: (csv: string) => csvFn({ data: { databaseId, schema, table, csv, confirm: true } }),
    onSuccess: (r: any) => { push(r); toast.success("تم تنفيذ الاستيراد"); query.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const pendingCount = Object.keys(edits).length + inserts.length + deletes.length;
  const visibleTables = tables
    .filter((t: any) => {
      const term = tableSearch.trim().toLowerCase();
      if (!term) return true;
      return String(t.name).toLowerCase().includes(term) || tableCode(schema, t.name).toLowerCase().includes(term);
    })
    .sort((a: any, b: any) => Number(favorites.includes(b.name)) - Number(favorites.includes(a.name)));

  const openTable = (name: string) => {
    setOpenTables((prev) => prev.includes(name) ? prev : [...prev, name]);
    setTable(name); setPage(1); setSelected([]); setEdits({}); setInserts([]); setDeletes([]); setHidden([]); setFilters([]); setSort(null);
  };
  const closeTable = (name: string) => {
    const next = openTables.filter((item) => item !== name);
    setOpenTables(next);
    if (table === name) openTable(next.at(-1) ?? "");
  };
  const filteredRows = useMemo(() => {
    const term = quickSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row: any) => Object.values(row).some((value) => formatValue(value).toLowerCase().includes(term)));
  }, [rows, quickSearch]);
  const cellValue = (row: any, key: string) => {
    const id = String(row[pk]);
    if (edits[id] && key in edits[id]) return edits[id][key];
    return row[key];
  };
  const setCell = (row: any, key: string, value: string) => {
    const id = String(row[pk]);
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), [key]: value } }));
  };

  if (!hasAgent) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        هذه القاعدة غير مرتبطة بسيرفر عليه وكيل TVCC، لذلك لا يمكن قراءة الجداول أو تعديلها.
        اربط القاعدة بسيرفر يعمل عليه الوكيل من تبويب «الإعدادات»، ثم عُد إلى محرر الجداول.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">محرر الجداول</h2>
          <p className="text-sm text-muted-foreground">إدارة مخططات وجداول قاعدة البيانات من مساحة واحدة.</p>
        </div>
        <Badge variant="outline" className="gap-2 border-success/40 text-success"><span className="size-1.5 rounded-full bg-success" />متصل</Badge>
      </div>

      <div className={`grid min-h-[72vh] overflow-hidden rounded-md border bg-card ${catalogCollapsed ? "lg:grid-cols-[52px_minmax(0,1fr)]" : "lg:grid-cols-[250px_minmax(0,1fr)]"}`}>
        <aside className="flex min-h-0 flex-col border-l bg-sidebar/40">
          <div className="flex items-center gap-2 border-b p-2">
            {!catalogCollapsed && <div className="flex min-w-0 flex-1 items-center gap-2"><Database className="size-4 text-primary" /><span className="truncate text-sm font-semibold">قاعدة البيانات</span></div>}
            <Button size="icon" variant="ghost" className="size-8 shrink-0" title={catalogCollapsed ? "إظهار الجداول" : "طي قائمة الجداول"} onClick={() => setCatalogCollapsed((value) => !value)}>
              {catalogCollapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
            </Button>
          </div>
          {catalogCollapsed ? (
            <div className="flex flex-col items-center gap-2 p-2">
              <NewTableDialog compact onCreate={(payload) => ddl.mutate({ kind: "create_table", ...payload })} pending={ddl.isPending} />
              <Button size="icon" variant="ghost" className="size-8" title="تحديث الجداول" onClick={() => refreshTables.mutate()}><RefreshCw className="size-4" /></Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 border-b p-2">
                <Select value={schema} onValueChange={(value) => { setSchema(value); setTable(""); setOpenTables([]); }}>
                  <SelectTrigger className="h-9 font-mono text-xs" dir="ltr"><SelectValue /></SelectTrigger>
                  <SelectContent>{schemas.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                </Select>
                <NewTableDialog fullWidth onCreate={(payload) => ddl.mutate({ kind: "create_table", ...payload })} pending={ddl.isPending} />
                <div className="flex gap-1">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="بحث الجداول" className="h-9 pr-8 text-xs" />
                  </div>
                  <Button size="icon" variant="outline" className="size-9" title="تحديث الجداول" onClick={() => refreshTables.mutate()} disabled={refreshTables.isPending}>{refreshTables.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}</Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{visibleTables.length} جدولاً</p>
                {visibleTables.length ? visibleTables.map((item: any) => (
                  <button key={item.name} onClick={() => openTable(item.name)} className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-right text-xs transition-colors hover:bg-sidebar-accent ${table === item.name ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"}`}>
                    <span className="min-w-0 flex-1 truncate font-mono" dir="ltr">{item.name}</span>
                    {item.rls_enabled ? <Shield className="size-3 text-success" /> : item.kind === "table" ? <ShieldAlert className="size-3 text-warning" /> : null}
                    <Star className={`size-3 opacity-0 group-hover:opacity-100 ${favorites.includes(item.name) ? "fill-primary text-primary opacity-100" : "text-muted-foreground"}`} onClick={(e) => { e.stopPropagation(); setFavorites((prev) => prev.includes(item.name) ? prev.filter((n) => n !== item.name) : [...prev, item.name]); }} />
                  </button>
                )) : <p className="p-4 text-center text-xs text-muted-foreground">{tablesCmd ? "لا توجد جداول" : "بانتظار قائمة الجداول…"}</p>}

              </div>
              <div className="border-t p-2"><AgentHint command={tablesCmd} /></div>
            </>
          )}
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex h-9 items-end overflow-x-auto border-b bg-muted/20 px-1 pt-1" dir="ltr">
            {openTables.map((name) => (
              <button key={name} onClick={() => openTable(name)} className={`group flex h-8 min-w-28 max-w-48 items-center gap-1.5 border-l px-2 text-[11px] ${table === name ? "border-t-2 border-t-primary bg-card text-foreground" : "bg-muted/20 text-muted-foreground hover:bg-muted/50"}`}>
                <Table2 className="size-3 shrink-0" /><span className="flex-1 truncate text-left font-mono">{name}</span>
                <X className="size-3 opacity-50 hover:text-destructive hover:opacity-100" onClick={(e) => { e.stopPropagation(); closeTable(name); }} />
              </button>
            ))}
            <Button size="icon" variant="ghost" className="mb-0.5 ml-1 size-7 shrink-0" title="فتح جدول" onClick={() => setCatalogCollapsed(false)}><Plus className="size-3.5" /></Button>
          </div>

          {!table ? (
            <div className="grid min-h-[60vh] place-items-center p-8 text-center">
              <div><Rows3 className="mx-auto mb-3 size-10 text-muted-foreground/40" /><p className="font-medium">اختر جدولاً لعرض بياناته</p><p className="mt-1 text-sm text-muted-foreground">استخدم قائمة الجداول لفتح عدة تبويبات.</p></div>
            </div>
          ) : (
            <Tabs defaultValue="data" className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1">
                <TabsList className="h-7"><TabsTrigger value="data" className="h-6 text-[11px] px-2">البيانات</TabsTrigger><TabsTrigger value="columns" className="h-6 text-[11px] px-2">الأعمدة</TabsTrigger><TabsTrigger value="policies" className="h-6 text-[11px] px-2">السياسات</TabsTrigger></TabsList>
                <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">{schema}.{table}</Badge>
                {currentTable?.size && <Badge variant="secondary" className="text-[10px]">{currentTable.size}</Badge>}
              </div>

              <TabsContent value="data" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                <div className="flex flex-wrap items-center gap-1.5 border-b px-2 py-1">
                  <div className="relative min-w-36 flex-1">
                    <Search className="absolute right-2 top-2 size-3 text-muted-foreground" />
                    <Input value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)} placeholder="ابحث في الصفوف المعروضة…" className="h-7 pr-7 text-[11px]" />
                  </div>
                  <FiltersMenu filters={filters} setFilters={setFilters} headers={columns.map((c: any) => c.name)} onApply={() => { setPage(1); refreshRows.mutate({ page: 1 }); }} />
                  <Select value={sort ? `${sort.column}:${sort.dir}` : "none"} onValueChange={(value) => { if (value === "none") return setSort(null); const [column, dir] = value.split(":"); if (column) setSort({ column, dir: dir as "asc" | "desc" }); }}>
                    <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue placeholder="الترتيب" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">بدون ترتيب</SelectItem>{columns.flatMap((c: any) => [<SelectItem key={`${c.name}:asc`} value={`${c.name}:asc`}>{c.name} ↑</SelectItem>, <SelectItem key={`${c.name}:desc`} value={`${c.name}:desc`}>{c.name} ↓</SelectItem>])}</SelectContent>
                  </Select>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7 text-[11px] px-2"><Columns3 className="size-3" />الأعمدة</Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-80 overflow-y-auto"><DropdownMenuLabel>إظهار/إخفاء</DropdownMenuLabel>{columns.map((c: any) => <DropdownMenuCheckboxItem key={c.name} checked={!hidden.includes(c.name)} onCheckedChange={(checked) => setHidden((prev) => checked ? prev.filter((n) => n !== c.name) : [...prev, c.name])}>{c.name}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => catalog({ data: { databaseId, mode: "policies", schema, table } }).then((r) => { push(r); query.refetch(); })}><ShieldCheck className="size-3" />RLS · {policies.length}</Button>
                  <Button size="icon" variant="ghost" className="size-7" title="تحديث" onClick={() => refreshRows.mutate({})}>{refreshRows.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}</Button>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-7"><MoreHorizontal className="size-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel>إجراءات البيانات</DropdownMenuLabel><DropdownMenuCheckboxItem checked={false} onCheckedChange={() => downloadText(`${schema}.${table}.csv`, toCsv(rows, headers))}>تصدير CSV</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu>
                  <Button size="sm" className="h-7 bg-success text-success-foreground hover:bg-success/90 text-[11px] px-2" onClick={() => setInserts((prev) => [...prev, {}])}><Plus className="size-3" />إدراج</Button>
                </div>

                {pendingCount > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-primary/40 bg-primary/5 px-2 py-1 text-[11px]"><Badge className="text-[10px]">{pendingCount} تغيير</Badge><span className="text-muted-foreground">تعديل {Object.keys(edits).length} · إضافة {inserts.length} · حذف {deletes.length}</span><Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => { setEdits({}); setInserts([]); setDeletes([]); }}><Undo2 className="size-3" />تراجع</Button><Button size="sm" className="mr-auto h-6 text-[11px] px-2" onClick={() => saveChanges.mutate()} disabled={saveChanges.isPending}>{saveChanges.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}حفظ</Button></div>}

                <div className="min-h-0 flex-1 overflow-auto bg-background/30">
                  <table className="w-max min-w-full border-collapse text-[11px]" dir="ltr">
                    <thead className="sticky top-0 z-10 bg-card"><tr>{<th className="sticky left-0 z-20 w-8 border-b border-r bg-card px-1 py-1"><Checkbox checked={filteredRows.length > 0 && selected.length === filteredRows.length} onCheckedChange={(checked) => setSelected(checked ? filteredRows.map((r: any) => String(r[pk])) : [])} /></th>}{headers.map((key) => <th key={key} className="min-w-28 whitespace-nowrap border-b border-r px-2 py-1 text-left font-medium"><button className="flex w-full items-center gap-1" onClick={() => setSort((prev) => prev?.column === key && prev.dir === "asc" ? { column: key, dir: "desc" } : { column: key, dir: "asc" })}>{columnInfo[key]?.is_primary && <KeyRound className="size-2.5 text-primary" />}<span>{key}</span><span className="font-normal text-muted-foreground">{columnInfo[key]?.type}</span>{sort?.column === key && (sort.dir === "asc" ? <ArrowUpAZ className="size-2.5" /> : <ArrowDownAZ className="size-2.5" />)}</button></th>)}<th className="w-8 border-b px-1 py-1" /></tr></thead>
                    <tbody>{filteredRows.map((row: any, index: number) => { const id = String(row[pk]); const removed = deletes.includes(id); return <tr key={id || index} className={`group hover:bg-muted/30 ${removed ? "opacity-40 line-through" : ""}`}><td className="sticky left-0 border-b border-r bg-card px-1 py-1"><Checkbox checked={selected.includes(id)} onCheckedChange={(checked) => setSelected((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id))} /></td>{headers.map((key) => <td key={key} className="max-w-56 border-b border-r p-0"><input className={`h-6 w-full min-w-28 truncate bg-transparent px-1.5 font-mono outline-none focus:bg-muted ${edits[id] && key in edits[id] ? "bg-primary/10" : ""}`} value={formatValue(cellValue(row, key))} onDoubleClick={(e) => e.currentTarget.select()} onChange={(e) => setCell(row, key, e.target.value)} /></td>)}<td className="border-b px-0.5"><div className="flex"><Button size="icon" variant="ghost" className="size-6" title="نسخ الصف" onClick={() => setInserts((prev) => [...prev, { ...row }])}><Copy className="size-3" /></Button><Button size="icon" variant="ghost" className="size-6" title="فتح الصف" onClick={() => setDrawerRow(row)}><Eye className="size-3" /></Button></div></td></tr>; })}
                    {inserts.map((row, index) => <tr key={`new-${index}`} className="bg-success/5"><td className="sticky left-0 border-b border-r bg-card px-1 py-1"><Badge variant="secondary" className="text-[9px] px-1">جديد</Badge></td>{headers.map((key) => <td key={key} className="border-b border-r p-0"><input className="h-6 w-full min-w-28 bg-transparent px-1.5 font-mono outline-none focus:bg-muted" value={String(row[key] ?? "")} onChange={(e) => setInserts((prev) => prev.map((r, i) => i === index ? { ...r, [key]: e.target.value } : r))} /></td>)}<td className="border-b p-0.5"><Button size="icon" variant="ghost" className="size-6" onClick={() => setInserts((prev) => prev.filter((_, i) => i !== index))}><X className="size-3" /></Button></td></tr>)}
                    {!filteredRows.length && !inserts.length && <tr><td colSpan={headers.length + 2} className="h-56 text-center"><Rows3 className="mx-auto mb-2 size-8 text-muted-foreground/40" /><p className="text-sm font-medium">هذا الجدول فارغ</p><div className="mt-3 flex justify-center gap-2"><ImportCsvDialog onImport={(csv) => importCsv.mutate(csv)} pending={importCsv.isPending} /><Button size="sm" className="h-7 text-[11px]" onClick={() => setInserts([{}])}><Plus className="size-3" />إدراج صف</Button></div></td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t px-2 py-1 text-[11px] text-muted-foreground">
                  <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}><SelectTrigger className="h-7 w-20 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{[25, 50, 100, 200, 500].map((n) => <SelectItem key={n} value={String(n)}>{n} صف</SelectItem>)}</SelectContent></Select>
                  <span>صفحة {page}{total !== null ? ` من ${Math.max(1, Math.ceil(total / pageSize))}` : ""}</span><span>{total !== null ? `${total} سجل` : `${filteredRows.length} ظاهر`}</span>
                  <div className="mr-auto flex gap-1"><Button size="icon" variant="outline" className="size-7" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); refreshRows.mutate({ page: next }); }}><ChevronRight className="size-3.5" /></Button><Button size="icon" variant="outline" className="size-7" disabled={rows.length < pageSize} onClick={() => { const next = page + 1; setPage(next); refreshRows.mutate({ page: next }); }}><ChevronLeft className="size-3.5" /></Button></div>
                </div>
              </TabsContent>

              <TabsContent value="columns" className="m-0 space-y-3 overflow-auto p-3"><div className="flex gap-2"><AddColumnDialog onAdd={(column) => ddl.mutate({ kind: "add_column", table, column })} pending={ddl.isPending} /><Button size="sm" variant="outline" onClick={() => ddl.mutate({ kind: "enable_rls", table, rls: true })}><ShieldCheck className="size-4" />تفعيل RLS</Button></div><div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead><tr className="border-b text-right"><th className="p-3">العمود</th><th className="p-3">النوع</th><th className="p-3">مطلوب</th><th className="p-3">الافتراضي</th><th className="p-3">علاقة</th></tr></thead><tbody>{columns.map((c: any) => <tr key={c.name} className="border-b"><td className="p-3 font-mono text-xs" dir="ltr">{c.is_primary ? "🔑 " : ""}{c.name}</td><td className="p-3 font-mono text-xs" dir="ltr">{c.type}</td><td className="p-3">{c.not_null ? "نعم" : "—"}</td><td className="p-3 font-mono text-xs" dir="ltr">{c.default_value ?? "—"}</td><td className="p-3 font-mono text-xs" dir="ltr">{c.foreign_ref ?? "—"}</td></tr>)}</tbody></table></div></TabsContent>
              <TabsContent value="policies" className="m-0 space-y-3 overflow-auto p-3"><div className="flex gap-2"><NewPolicyDialog table={table} onCreate={(policy) => ddl.mutate({ kind: "create_policy", table, policy })} pending={ddl.isPending} /><Button size="sm" variant="outline" onClick={() => catalog({ data: { databaseId, mode: "policies", schema, table } }).then((r) => { push(r); query.refetch(); })}><RefreshCw className="size-4" />قراءة السياسات</Button></div>{currentTable?.rls_enabled === false && <div className="flex items-center gap-3 rounded border border-warning/50 bg-warning/5 p-3 text-sm"><ShieldAlert className="size-5 text-warning" />حماية الصفوف غير مفعّلة لهذا الجدول.</div>}<div className="overflow-x-auto rounded border"><table className="w-full text-sm"><thead><tr className="border-b text-right"><th className="p-3">السياسة</th><th className="p-3">العملية</th><th className="p-3">الأدوار</th><th className="p-3">الشرط</th></tr></thead><tbody>{policies.map((p: any) => <tr key={p.name} className="border-b"><td className="p-3">{p.name}</td><td className="p-3">{p.command}</td><td className="p-3 font-mono text-xs">{p.roles ?? "—"}</td><td className="max-w-md truncate p-3 font-mono text-xs">{p.qual ?? p.with_check ?? "—"}</td></tr>)}</tbody></table></div></TabsContent>
            </Tabs>
          )}
        </section>
      </div>

      {selected.length > 0 && <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-md border bg-popover px-4 py-2 shadow-lg"><span className="text-sm">تم تحديد {selected.length}</span><Button size="sm" variant="outline" onClick={() => setDeletes((prev) => Array.from(new Set([...prev, ...selected])))}><Trash2 className="size-4" />إضافة للحذف</Button><Button size="sm" variant="ghost" onClick={() => setSelected([])}>إلغاء</Button></div>}
      <Sheet open={Boolean(drawerRow)} onOpenChange={(open) => !open && setDrawerRow(null)}><SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl"><SheetHeader><SheetTitle>تفاصيل الصف</SheetTitle></SheetHeader><div className="mt-4 space-y-3">{drawerRow && Object.entries(drawerRow).map(([key, value]) => <div key={key} className="rounded border p-2"><p className="text-xs text-muted-foreground" dir="ltr">{key}</p><pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs" dir="ltr">{formatValue(value, true)}</pre></div>)}</div></SheetContent></Sheet>
    </div>
  );
}

function formatValue(value: unknown, pretty = false) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, pretty ? 2 : 0);
  return String(value);
}

function AgentHint({ command }: { command?: AgentCommand }) {
  if (!command) return null;
  const at = command.completed_at ?? command.created_at;
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={commandTone(command.status)}>{command.status}</Badge>
      {command.status === "pending" && <Loader2 className="size-3 animate-spin" />}
      <span>{new Date(at).toLocaleString("ar")}</span>
      {typeof command.exit_code === "number" && command.exit_code !== 0 && (
        <span className="text-destructive">فشل ({command.exit_code}) {String(parseOutput(command.output)?.error ?? "").slice(0, 120)}</span>
      )}
    </span>
  );
}

function FiltersMenu({ filters, setFilters, headers, onApply }: {
  filters: FilterRow[]; setFilters: (rows: FilterRow[]) => void; headers: string[]; onApply: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Filter className="size-4" />فلترة{filters.length ? ` (${filters.length})` : ""}</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>شروط الفلترة</DialogTitle><DialogDescription>تُطبَّق الشروط على الخادم عند جلب الصفوف.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          {filters.map((row, index) => (
            <div key={index} className="flex gap-2">
              <Select value={row.column} onValueChange={(value) => setFilters(filters.map((f, i) => i === index ? { ...f, column: value } : f))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="العمود" /></SelectTrigger>
                <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={row.op} onValueChange={(value) => setFilters(filters.map((f, i) => i === index ? { ...f, op: value } : f))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{OPS.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={row.value} onChange={(e) => setFilters(filters.map((f, i) => i === index ? { ...f, value: e.target.value } : f))} placeholder="القيمة" dir="ltr" />
              <Button size="icon" variant="ghost" onClick={() => setFilters(filters.filter((_, i) => i !== index))}><X className="size-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setFilters([...filters, { column: headers[0] ?? "", op: "eq", value: "" }])}><Plus className="size-4" />شرط</Button>
        </div>
        <DialogFooter><Button onClick={onApply}>تطبيق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTableDialog({ onCreate, pending, compact = false, fullWidth = false }: { onCreate: (payload: any) => void; pending: boolean; compact?: boolean; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rls, setRls] = useState(true);
  const [realtime, setRealtime] = useState(false);
  const [dataApi, setDataApi] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [columns, setColumns] = useState<any[]>([
    { name: "id", type: "uuid", primary: true, unique: true, default: "gen_random_uuid()", nullable: false },
    { name: "created_at", type: "timestamptz", primary: false, unique: false, default: "now()", nullable: false },
  ]);
  const patchColumn = (index: number, patch: Record<string, unknown>) => setColumns((prev) => prev.map((column, i) => i === index ? { ...column, ...patch } : column));
  const create = () => { onCreate({ table: name, description, columns, rls, realtime, dataApi }); setOpen(false); setConfirmed(false); };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size={compact ? "icon" : "sm"} className={fullWidth ? "w-full" : ""} title="إنشاء جدول جديد"><Plus className="size-4" />{!compact && "جدول جديد"}</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-h-[92vh] max-w-5xl overflow-y-auto">
      <DialogHeader><DialogTitle>إنشاء جدول جديد</DialogTitle><DialogDescription>حدّد بنية الجدول وخصائص الوصول، ثم راجعها قبل الإنشاء.</DialogDescription></DialogHeader>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>اسم الجدول</Label><Input value={name} onChange={(e) => setName(e.target.value)} dir="ltr" placeholder="table_name" /></div><div><Label>الوصف</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف اختياري" /></div></div>
          <div className="overflow-x-auto rounded border"><table className="min-w-[760px] w-full text-xs" dir="ltr"><thead><tr className="border-b bg-muted/30 text-left"><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Default value</th><th className="p-2 text-center">Primary</th><th className="p-2 text-center">Nullable</th><th className="p-2 text-center">Unique</th><th className="w-10 p-2" /></tr></thead><tbody>{columns.map((col, index) => <tr key={index} className="border-b"><td className="p-1.5"><Input className="h-9 min-w-32" value={col.name} onChange={(e) => patchColumn(index, { name: e.target.value })} /></td><td className="p-1.5"><Select value={col.type} onValueChange={(value) => patchColumn(index, { type: value })}><SelectTrigger className="h-9 min-w-32"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></td><td className="p-1.5"><Input className="h-9 min-w-40" value={col.default ?? ""} onChange={(e) => patchColumn(index, { default: e.target.value })} /></td><td className="p-2 text-center"><Checkbox checked={Boolean(col.primary)} onCheckedChange={(value) => patchColumn(index, { primary: Boolean(value) })} /></td><td className="p-2 text-center"><Checkbox checked={Boolean(col.nullable)} onCheckedChange={(value) => patchColumn(index, { nullable: Boolean(value) })} /></td><td className="p-2 text-center"><Checkbox checked={Boolean(col.unique)} onCheckedChange={(value) => patchColumn(index, { unique: Boolean(value) })} /></td><td className="p-1"><Button size="icon" variant="ghost" className="size-8" disabled={columns.length <= 1} onClick={() => setColumns((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="size-3.5" /></Button></td></tr>)}</tbody></table></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setColumns((prev) => [...prev, { name: "", type: "text", nullable: true, primary: false, unique: false, default: "" }])}><Plus className="size-4" />إضافة عمود</Button><Button size="sm" variant="outline" disabled><KeyRound className="size-4" />إضافة مفتاح أجنبي</Button><Button size="sm" variant="outline" disabled><Upload className="size-4" />استيراد CSV</Button></div>
        </div>
        <aside className="space-y-3"><div className="rounded border p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">حماية الصفوف RLS</p><p className="text-xs text-muted-foreground">تقييد الوصول بسياسات واضحة.</p></div><Switch checked={rls} onCheckedChange={setRls} /></div>{rls && <p className="mt-3 rounded bg-warning/10 p-2 text-xs text-warning">أنشئ سياسات وصول بعد إنشاء الجدول.</p>}</div><div className="flex items-center justify-between rounded border p-3"><div><p className="text-sm font-medium">Realtime</p><p className="text-xs text-muted-foreground">بث تغييرات الصفوف.</p></div><Switch checked={realtime} onCheckedChange={setRealtime} /></div><div className="flex items-center justify-between rounded border p-3"><div><p className="text-sm font-medium">الوصول عبر Data API</p><p className="text-xs text-muted-foreground">إتاحة الجدول للتطبيق.</p></div><Switch checked={dataApi} onCheckedChange={setDataApi} /></div><label className="flex items-start gap-2 rounded border border-primary/40 bg-primary/5 p-3 text-xs"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} /><span>راجعت اسم الجدول والأعمدة وأؤكد إنشاءه دون المساس بأي جدول موجود.</span></label></aside>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button disabled={pending || !name.trim() || columns.some((column) => !column.name.trim()) || !confirmed} onClick={create}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}حفظ الجدول</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AddColumnDialog({ onAdd, pending }: { onAdd: (column: any) => void; pending: boolean }) {
  const [column, setColumn] = useState<any>({ name: "", type: "text", nullable: true, default: "" });
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" />عمود جديد</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إضافة عمود</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input dir="ltr" placeholder="اسم العمود" value={column.name} onChange={(e) => setColumn({ ...column, name: e.target.value })} />
          <Select value={column.type} onValueChange={(value) => setColumn({ ...column, type: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Input dir="ltr" placeholder="قيمة افتراضية (اختياري)" value={column.default} onChange={(e) => setColumn({ ...column, default: e.target.value })} />
          <div className="flex items-center gap-2"><Switch checked={column.nullable} onCheckedChange={(value) => setColumn({ ...column, nullable: value })} /><Label>يسمح بالفراغ</Label></div>
        </div>
        <DialogFooter><Button disabled={pending || !column.name} onClick={() => onAdd(column)}>إضافة</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPolicyDialog({ table, onCreate, pending }: { table: string; onCreate: (policy: any) => void; pending: boolean }) {
  const [policy, setPolicy] = useState({ name: "", command: "SELECT", template: "own_rows", ownerColumn: "user_id" });
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm"><ShieldCheck className="size-4" />سياسة جديدة</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>سياسة وصول لـ {table}</DialogTitle><DialogDescription>اختر قالباً جاهزاً بدل كتابة SQL.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Input dir="ltr" placeholder="اسم السياسة" value={policy.name} onChange={(e) => setPolicy({ ...policy, name: e.target.value })} />
          <Select value={policy.command} onValueChange={(value) => setPolicy({ ...policy, command: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={policy.template} onValueChange={(value) => setPolicy({ ...policy, template: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="own_rows">صفوف المستخدم نفسه فقط</SelectItem>
              <SelectItem value="admin_only">المدير فقط</SelectItem>
              <SelectItem value="public_read">قراءة عامة</SelectItem>
            </SelectContent>
          </Select>
          {policy.template === "own_rows" && (
            <Input dir="ltr" placeholder="عمود المالك (user_id)" value={policy.ownerColumn} onChange={(e) => setPolicy({ ...policy, ownerColumn: e.target.value })} />
          )}
        </div>
        <DialogFooter><Button disabled={pending || !policy.name} onClick={() => onCreate(policy)}>إنشاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvDialog({ onImport, pending }: { onImport: (csv: string) => void; pending: boolean }) {
  const [csv, setCsv] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Upload className="size-4" />استيراد CSV</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader><DialogTitle>استيراد بيانات CSV</DialogTitle><DialogDescription>السطر الأول أسماء الأعمدة.</DialogDescription></DialogHeader>
        <Input type="file" accept=".csv,text/csv" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) setCsv(await file.text());
        }} />
        <Textarea dir="ltr" rows={8} className="font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="id,name" />
        <DialogFooter><Button disabled={pending || !csv.trim()} onClick={() => onImport(csv)}>استيراد عبر الوكيل</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
