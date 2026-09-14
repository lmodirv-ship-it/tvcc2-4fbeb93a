import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownAZ, ArrowUpAZ, ChevronLeft, ChevronRight, Columns3, Download, Eye, Filter,
  KeyRound, Loader2, Plus, RefreshCw, Save, Search, ShieldAlert, ShieldCheck, Star,
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
  const tablesCmd = findCommand(commands, "pg_meta", (a) => a.mode === "tables" && a.schema === schema);
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
    if (!schemasCmd) runOnce(`schemas`, () => catalog({ data: { databaseId, mode: "schemas" } }));
    if (!tablesCmd) runOnce(`tables:${schema}`, () => catalog({ data: { databaseId, mode: "tables", schema } }));
  }, [databaseId, schema, schemasCmd, tablesCmd]);

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
    .filter((t: any) => !tableSearch || String(t.name).includes(tableSearch))
    .sort((a: any, b: any) => Number(favorites.includes(b.name)) - Number(favorites.includes(a.name)));

  const openTable = (name: string) => {
    setTable(name); setPage(1); setSelected([]); setEdits({}); setInserts([]); setDeletes([]); setHidden([]); setFilters([]); setSort(null);
  };
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">محرر الجداول</h2>
          <p className="text-muted-foreground">تصفّح وحرّر بيانات القاعدة الفعلية — كل عملية تمرّ عبر وكيل TVCC وتُسجَّل.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewTableDialog onCreate={(payload) => ddl.mutate({ kind: "create_table", ...payload })} pending={ddl.isPending} />
          <Button variant="outline" onClick={() => refreshTables.mutate()} disabled={refreshTables.isPending}>
            {refreshTables.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}تحديث الجداول
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <Select value={schema} onValueChange={(value) => { setSchema(value); setTable(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{schemas.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="بحث في الجداول" className="pr-9" />
          </div>
          <Card><CardContent className="max-h-[62vh] overflow-y-auto p-1">
            {visibleTables.length ? visibleTables.map((item: any) => (
              <button
                key={item.name}
                onClick={() => openTable(item.name)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted ${table === item.name ? "bg-secondary" : ""}`}
              >
                <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{item.name}</span>
                {item.rls_enabled === false && item.kind === "table" && (
                  <Badge variant="outline" className="border-destructive/50 px-1 text-[10px] text-destructive">غير محمي</Badge>
                )}
                <Star
                  className={`size-3.5 ${favorites.includes(item.name) ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
                  onClick={(e) => { e.stopPropagation(); setFavorites((prev) => prev.includes(item.name) ? prev.filter((n) => n !== item.name) : [...prev, item.name]); }}
                />
              </button>
            )) : <p className="p-3 text-center text-sm text-muted-foreground">{tablesCmd ? "بانتظار نتيجة الوكيل…" : "اضغط «تحديث الجداول»"}</p>}
          </CardContent></Card>
          <AgentHint command={tablesCmd} />
        </aside>

        <div className="min-w-0 space-y-3">
          {!table ? (
            <Card><CardContent className="grid min-h-60 place-items-center p-6 text-center text-muted-foreground">اختر جدولاً من القائمة لعرض بياناته.</CardContent></Card>
          ) : (
            <Tabs defaultValue="data">
              <div className="flex flex-wrap items-center gap-2">
                <TabsList>
                  <TabsTrigger value="data">البيانات</TabsTrigger>
                  <TabsTrigger value="columns">الأعمدة</TabsTrigger>
                  <TabsTrigger value="policies">السياسات</TabsTrigger>
                </TabsList>
                <span className="mr-auto font-mono text-sm text-muted-foreground" dir="ltr">{schema}.{table}</span>
                {currentTable && <Badge variant="outline">{currentTable.kind}</Badge>}
                {currentTable?.size && <Badge variant="secondary">{currentTable.size}</Badge>}
              </div>

              <TabsContent value="data" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => refreshRows.mutate({})} disabled={refreshRows.isPending}>
                    {refreshRows.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}تحديث الصفوف
                  </Button>
                  <FiltersMenu filters={filters} setFilters={setFilters} headers={columns.map((c: any) => c.name)} onApply={() => { setPage(1); refreshRows.mutate({ page: 1 }); }} />
                  <Select value={sort ? `${sort.column}:${sort.dir}` : "none"} onValueChange={(value) => {
                    if (value === "none") return setSort(null);
                    const [column, dir] = value.split(":");
                    setSort({ column: column!, dir: dir as "asc" | "desc" });
                  }}>
                    <SelectTrigger className="h-9 w-44"><SelectValue placeholder="الترتيب" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون ترتيب</SelectItem>
                      {columns.map((c: any) => [
                        <SelectItem key={`${c.name}:asc`} value={`${c.name}:asc`}>{c.name} ↑</SelectItem>,
                        <SelectItem key={`${c.name}:desc`} value={`${c.name}:desc`}>{c.name} ↓</SelectItem>,
                      ])}
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Columns3 className="size-4" />الأعمدة</Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-80 overflow-y-auto">
                      <DropdownMenuLabel>إظهار/إخفاء</DropdownMenuLabel>
                      {columns.map((c: any) => (
                        <DropdownMenuCheckboxItem
                          key={c.name}
                          checked={!hidden.includes(c.name)}
                          onCheckedChange={(checked) => setHidden((prev) => checked ? prev.filter((n) => n !== c.name) : [...prev, c.name])}
                        >{c.name}</DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                    <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{[25, 50, 100, 200, 500].map((n) => <SelectItem key={n} value={String(n)}>{n} صف</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => downloadText(`${schema}.${table}.csv`, toCsv(rows, headers))} disabled={!rows.length}>
                    <Download className="size-4" />تصدير CSV
                  </Button>
                  <ImportCsvDialog onImport={(csv) => importCsv.mutate(csv)} pending={importCsv.isPending} />
                  <Button size="sm" variant="outline" onClick={() => setInserts((prev) => [...prev, {}])}><Plus className="size-4" />صف جديد</Button>
                  <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => { setDeletes((prev) => Array.from(new Set([...prev, ...selected]))); setSelected([]); }}>
                    <Trash2 className="size-4" />حذف المحدد
                  </Button>
                </div>

                {pendingCount > 0 && (
                  <Card className="border-primary/50">
                    <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      <Badge>{pendingCount} تغيير بانتظار الحفظ</Badge>
                      <span className="text-muted-foreground">
                        تعديل {Object.keys(edits).length} · إضافة {inserts.length} · حذف {deletes.length}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => { setEdits({}); setInserts([]); setDeletes([]); }}><Undo2 className="size-4" />تراجع</Button>
                      <Button size="sm" className="mr-auto" onClick={() => saveChanges.mutate()} disabled={saveChanges.isPending}>
                        {saveChanges.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}حفظ عبر الوكيل
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card><CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-right">
                        <th className="w-10 p-2" />
                        {headers.map((key) => (
                          <th key={key} className="whitespace-nowrap p-2 font-medium">
                            <button className="flex items-center gap-1" onClick={() => setSort((prev) => prev?.column === key && prev.dir === "asc" ? { column: key, dir: "desc" } : { column: key, dir: "asc" })}>
                              {columnInfo[key]?.is_primary && <KeyRound className="size-3 text-primary" />}
                              <span dir="ltr">{key}</span>
                              {columnInfo[key]?.type && <span className="text-[10px] text-muted-foreground" dir="ltr">{columnInfo[key].type}</span>}
                              {sort?.column === key && (sort.dir === "asc" ? <ArrowUpAZ className="size-3" /> : <ArrowDownAZ className="size-3" />)}
                            </button>
                          </th>
                        ))}
                        <th className="w-10 p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row: any, index: number) => {
                        const id = String(row[pk]);
                        const removed = deletes.includes(id);
                        return (
                          <tr key={id || index} className={`border-b border-border/60 ${removed ? "opacity-40 line-through" : ""}`}>
                            <td className="p-2">
                              <Checkbox checked={selected.includes(id)} onCheckedChange={(checked) => setSelected((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id))} />
                            </td>
                            {headers.map((key) => (
                              <td key={key} className="max-w-[280px] p-1">
                                <input
                                  dir="ltr"
                                  className={`w-full truncate rounded bg-transparent px-1 py-1 font-mono text-xs outline-none focus:bg-muted ${edits[id] && key in edits[id] ? "bg-primary/10" : ""}`}
                                  value={formatValue(cellValue(row, key))}
                                  onChange={(e) => setCell(row, key, e.target.value)}
                                />
                              </td>
                            ))}
                            <td className="p-2"><Button size="icon" variant="ghost" onClick={() => setDrawerRow(row)}><Eye className="size-4" /></Button></td>
                          </tr>
                        );
                      })}
                      {inserts.map((row, index) => (
                        <tr key={`new-${index}`} className="border-b border-border/60 bg-primary/5">
                          <td className="p-2"><Badge variant="secondary" className="text-[10px]">جديد</Badge></td>
                          {headers.map((key) => (
                            <td key={key} className="p-1">
                              <input
                                dir="ltr"
                                className="w-full rounded bg-transparent px-1 py-1 font-mono text-xs outline-none focus:bg-muted"
                                value={String(row[key] ?? "")}
                                onChange={(e) => setInserts((prev) => prev.map((r, i) => i === index ? { ...r, [key]: e.target.value } : r))}
                              />
                            </td>
                          ))}
                          <td className="p-2"><Button size="icon" variant="ghost" onClick={() => setInserts((prev) => prev.filter((_, i) => i !== index))}><X className="size-4" /></Button></td>
                        </tr>
                      ))}
                      {!rows.length && !inserts.length && (
                        <tr><td colSpan={headers.length + 2} className="p-6 text-center text-muted-foreground">
                          {rowsCmd ? "بانتظار نتيجة الوكيل لهذا الجدول…" : "اضغط «تحديث الصفوف»."}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent></Card>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); refreshRows.mutate({ page: next }); }}><ChevronRight className="size-4" /></Button>
                  <span>صفحة {page}{total !== null ? ` · ${total} سجل` : ""}</span>
                  <Button size="icon" variant="outline" disabled={rows.length < pageSize} onClick={() => { const next = page + 1; setPage(next); refreshRows.mutate({ page: next }); }}><ChevronLeft className="size-4" /></Button>
                  <AgentHint command={rowsCmd} />
                  <AgentHint command={writeCmd} />
                </div>
              </TabsContent>

              <TabsContent value="columns" className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <AddColumnDialog onAdd={(column) => ddl.mutate({ kind: "add_column", table, column })} pending={ddl.isPending} />
                  <Button size="sm" variant="outline" onClick={() => ddl.mutate({ kind: "enable_rls", table, rls: true })}><ShieldCheck className="size-4" />تفعيل RLS</Button>
                  <Button size="sm" variant="outline" onClick={() => catalog({ data: { databaseId, mode: "columns", schema, table } }).then(() => query.refetch()).catch((e: any) => toast.error(e?.message ?? "تعذّر التنفيذ"))}><RefreshCw className="size-4" />تحديث</Button>
                </div>
                <Card><CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-right"><th className="p-3">العمود</th><th className="p-3">النوع</th><th className="p-3">مطلوب</th><th className="p-3">الافتراضي</th><th className="p-3">علاقة</th><th className="p-3">إجراءات</th></tr></thead>
                    <tbody>
                      {columns.map((c: any) => (
                        <tr key={c.name} className="border-b border-border/60">
                          <td className="p-3 font-mono text-xs" dir="ltr">{c.is_primary ? "🔑 " : ""}{c.name}</td>
                          <td className="p-3 font-mono text-xs" dir="ltr">{c.type}</td>
                          <td className="p-3">{c.not_null ? "نعم" : "—"}</td>
                          <td className="p-3 font-mono text-xs" dir="ltr">{c.default_value ?? "—"}</td>
                          <td className="p-3 font-mono text-xs" dir="ltr">{c.foreign_ref ?? "—"}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => ddl.mutate({ kind: "create_index", table, column: { name: c.name, type: c.type } })}>فهرس</Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`حذف العمود ${c.name}؟`)) ddl.mutate({ kind: "drop_column", table, column: { name: c.name, type: c.type } }); }}>حذف</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!columns.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">بانتظار قراءة الأعمدة من الوكيل…</td></tr>}
                    </tbody>
                  </table>
                </CardContent></Card>
                <AgentHint command={ddlCmd} />
              </TabsContent>

              <TabsContent value="policies" className="space-y-3">
                {currentTable?.rls_enabled === false && (
                  <Card className="border-destructive/50"><CardContent className="flex items-center gap-3 p-3 text-sm">
                    <ShieldAlert className="size-5 text-destructive" />
                    هذا الجدول بلا حماية صفوف (RLS) — أي مفتاح عام يستطيع قراءته.
                    <Button size="sm" className="mr-auto" onClick={() => ddl.mutate({ kind: "enable_rls", table, rls: true })}>تفعيل الآن</Button>
                  </CardContent></Card>
                )}
                <div className="flex flex-wrap gap-2">
                  <NewPolicyDialog table={table} onCreate={(policy) => ddl.mutate({ kind: "create_policy", table, policy })} pending={ddl.isPending} />
                  <Button size="sm" variant="outline" onClick={() => catalog({ data: { databaseId, mode: "policies", schema, table } }).then(() => query.refetch()).catch((e: any) => toast.error(e?.message ?? "تعذّر التنفيذ"))}><RefreshCw className="size-4" />قراءة السياسات</Button>
                </div>
                <Card><CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-right"><th className="p-3">السياسة</th><th className="p-3">العملية</th><th className="p-3">الأدوار</th><th className="p-3">الشرط</th></tr></thead>
                    <tbody>
                      {policies.map((p: any) => (
                        <tr key={p.name} className="border-b border-border/60">
                          <td className="p-3">{p.name}</td><td className="p-3">{p.command}</td>
                          <td className="p-3 font-mono text-xs" dir="ltr">{p.roles ?? "—"}</td>
                          <td className="max-w-md truncate p-3 font-mono text-xs" dir="ltr">{p.qual ?? p.with_check ?? "—"}</td>
                        </tr>
                      ))}
                      {!policies.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا سياسات مقروءة بعد.</td></tr>}
                    </tbody>
                  </table>
                </CardContent></Card>
                <AgentHint command={policiesCmd} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <Sheet open={Boolean(drawerRow)} onOpenChange={(open) => !open && setDrawerRow(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          <SheetHeader><SheetTitle>تفاصيل الصف</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            {drawerRow && Object.entries(drawerRow).map(([key, value]) => (
              <div key={key} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground" dir="ltr">{key}</p>
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs" dir="ltr">{formatValue(value, true)}</pre>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
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

function NewTableDialog({ onCreate, pending }: { onCreate: (payload: any) => void; pending: boolean }) {
  const [name, setName] = useState("");
  const [rls, setRls] = useState(true);
  const [columns, setColumns] = useState<any[]>([
    { name: "id", type: "uuid", primary: true, default: "gen_random_uuid()", nullable: false },
    { name: "created_at", type: "timestamptz", default: "now()", nullable: false },
  ]);
  return (
    <Dialog>
      <DialogTrigger asChild><Button><Plus className="size-4" />جدول جديد</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>إنشاء جدول جديد</DialogTitle><DialogDescription>يُنشأ مع صلاحيات الوصول وتفعيل حماية الصفوف.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} dir="ltr" placeholder="my_table" /></div>
          <div className="flex items-center gap-2"><Switch checked={rls} onCheckedChange={setRls} id="rls" /><Label htmlFor="rls">تفعيل حماية الصفوف (RLS) — موصى به</Label></div>
          <div className="space-y-2">
            {columns.map((col, index) => (
              <div key={index} className="flex flex-wrap gap-2">
                <Input className="w-36" dir="ltr" value={col.name} placeholder="اسم العمود" onChange={(e) => setColumns(columns.map((c, i) => i === index ? { ...c, name: e.target.value } : c))} />
                <Select value={col.type} onValueChange={(value) => setColumns(columns.map((c, i) => i === index ? { ...c, type: value } : c))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-36" dir="ltr" value={col.default ?? ""} placeholder="افتراضي" onChange={(e) => setColumns(columns.map((c, i) => i === index ? { ...c, default: e.target.value } : c))} />
                <label className="flex items-center gap-1 text-xs"><Checkbox checked={Boolean(col.primary)} onCheckedChange={(checked) => setColumns(columns.map((c, i) => i === index ? { ...c, primary: Boolean(checked) } : c))} />أساسي</label>
                <Button size="icon" variant="ghost" onClick={() => setColumns(columns.filter((_, i) => i !== index))}><X className="size-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setColumns([...columns, { name: "", type: "text" }])}><Plus className="size-4" />عمود</Button>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending || !name} onClick={() => onCreate({ table: name, columns, rls })}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}إنشاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
