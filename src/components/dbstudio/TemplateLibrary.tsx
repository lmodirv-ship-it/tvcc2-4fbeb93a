import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Boxes, CheckCircle2, Download, Layers3, Loader2, Play, RefreshCw, Search, ShieldCheck, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  applyTemplate, extractTemplate, getEditorCommands, inspectTemplateDiff, listDbTemplates, previewTemplate,
} from "@/lib/dbstudio.functions";
import { type AgentCommand, commandTone, extractRows, findCommand, parseOutput } from "./agent-result";

const POLICY_LABEL: Record<string, string> = {
  own_rows: "خاص بالمالك",
  public_read: "قراءة عامة",
  admin_only: "للمدراء فقط",
  public_read_own_write: "قراءة عامة · كتابة للمالك",
};

export function TemplateLibrary({ databaseId, hasAgent = true }: { databaseId: string; hasAgent?: boolean }) {
  const listFn = useServerFn(listDbTemplates);
  const previewFn = useServerFn(previewTemplate);
  const applyFn = useServerFn(applyTemplate);
  const diffFn = useServerFn(inspectTemplateDiff);
  const extractFn = useServerFn(extractTemplate);
  const commandsFn = useServerFn(getEditorCommands);

  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState("");
  const [schema, setSchema] = useState("public");
  const [prefix, setPrefix] = useState("");
  const [rls, setRls] = useState(true);
  const [seeds, setSeeds] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [sql, setSql] = useState("");
  const [existing, setExisting] = useState<string[] | null>(null);

  const templates = useQuery({ queryKey: ["db-templates"], queryFn: () => listFn() });
  const commands = useQuery({
    queryKey: ["db-template-commands", databaseId],
    queryFn: () => commandsFn({ data: { databaseId } }) as Promise<AgentCommand[]>,
    refetchInterval: 6000,
    enabled: Boolean(databaseId) && hasAgent,
  });
  const lastApply = findCommand(commands.data ?? [], "pg_ddl", (args) => args["kind"] === "apply_template");
  const lastDiff = findCommand(commands.data ?? [], "pg_meta", (args) => Boolean(args["template_id"]));
  const lastExtract = findCommand(commands.data ?? [], "pg_meta", (args) => args["mode"] === "extract_template");

  const list = (templates.data ?? []) as any[];
  const active = list.find((tpl) => tpl.id === activeId);
  const visible = useMemo(
    () => list.filter((tpl) => !search || `${tpl.name} ${tpl.description} ${tpl.category}`.includes(search)),
    [list, search],
  );

  const selectTemplate = (tpl: any) => {
    setActiveId(tpl.id);
    setPicked(tpl.tables.map((row: any) => row.name));
    setSql("");
    setExisting(null);
  };

  const options = () => ({
    databaseId, templateId: activeId, schema, prefix: prefix || undefined, rls, seeds,
    tables: picked.length && active && picked.length !== active.tables.length ? picked : undefined,
  });

  const preview = useMutation({
    mutationFn: () => previewFn({ data: options() }),
    onSuccess: (result: any) => setSql(result.sql),
    onError: (e: any) => toast.error(e.message),
  });
  const apply = useMutation({
    mutationFn: () => applyFn({ data: { ...options(), confirm: true } }),
    onSuccess: () => { toast.success("أُرسل النموذج إلى الوكيل للتنفيذ"); commands.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const diff = useMutation({
    mutationFn: () => diffFn({ data: { databaseId, templateId: activeId, schema, prefix: prefix || undefined } }),
    onSuccess: (result: any) => { setExisting(result.expected); toast.success("طُلبت قائمة الجداول الحالية"); commands.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const extract = useMutation({
    mutationFn: () => extractFn({ data: { databaseId, schema } }),
    onSuccess: () => { toast.success("طُلبت بنية القاعدة لاستخراج نموذج"); commands.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const presentTables = useMemo(() => {
    const rows = extractRows(lastDiff?.output) ?? [];
    return new Set(rows.map((row: any) => String(row.name ?? row.table_name ?? "")));
  }, [lastDiff]);

  if (!hasAgent) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        هذه القاعدة غير مرتبطة بسيرفر عليه وكيل TVCC، لذلك لا يمكن تطبيق النماذج. اربطها بسيرفر أولاً من تبويب «الإعدادات».
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">نماذج الجداول</h2>
          <p className="text-muted-foreground">مجموعات جداول جاهزة لأغلب المواقع — معاينة كاملة قبل التنفيذ، ثم تطبيق عبر وكيل TVCC مع تسجيل في سجل التدقيق.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => extract.mutate()} disabled={extract.isPending}><Download className="size-4" />استخرج نموذجاً من هذه القاعدة</Button>
          <Button variant="outline" size="icon" aria-label="تحديث" onClick={() => commands.refetch()}><RefreshCw className="size-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">المكتبة</CardTitle>
            <div className="relative"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في النماذج" /></div>
          </CardHeader>
          <CardContent className="max-h-[620px] space-y-2 overflow-auto p-3">
            {templates.isLoading && <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin" /></div>}
            {visible.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => selectTemplate(tpl)}
                className={`w-full rounded-lg border p-3 text-right transition ${activeId === tpl.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{tpl.name}</span>
                  <Badge variant="secondary">{tpl.tableCount} جدول</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
                <span className="mt-2 inline-block text-[11px] text-muted-foreground">{tpl.category}</span>
              </button>
            ))}
            {!templates.isLoading && !visible.length && <p className="p-4 text-center text-sm text-muted-foreground">لا نتائج.</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!active ? (
            <Card><CardContent className="grid min-h-52 place-items-center p-6 text-center text-muted-foreground">اختر نموذجاً من المكتبة لعرض جداوله وخياراته.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="size-4 text-primary" />{active.name}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1"><span className="text-xs text-muted-foreground">المخطط</span><Input value={schema} onChange={(e) => setSchema(e.target.value)} dir="ltr" /></label>
                    <label className="space-y-1"><span className="text-xs text-muted-foreground">بادئة الأسماء (اختياري)</span><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} dir="ltr" placeholder="shop" /></label>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">حماية الصفوف RLS</span><Switch checked={rls} onCheckedChange={setRls} /></div>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span className="text-sm">بيانات تجريبية</span><Switch checked={seeds} onCheckedChange={setSeeds} /></div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">تخطّي الجداول الموجودة (create if not exists)</span>
                    <Switch checked={skipExisting} onCheckedChange={setSkipExisting} disabled />
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border text-right">
                        <th className="p-2"><input type="checkbox" checked={picked.length === active.tables.length} onChange={(e) => setPicked(e.target.checked ? active.tables.map((r: any) => r.name) : [])} /></th>
                        <th className="p-2">الجدول</th><th className="p-2">الوصف</th><th className="p-2">أعمدة</th><th className="p-2">الحماية</th><th className="p-2">العلاقات</th><th className="p-2">الحالة</th>
                      </tr></thead>
                      <tbody>
                        {active.tables.map((row: any) => {
                          const finalName = `${prefix ? `${prefix.replace(/_?$/, "_")}` : ""}${row.name}`;
                          const exists = presentTables.has(finalName);
                          return (
                            <tr key={row.name} className="border-b border-border/60">
                              <td className="p-2"><input type="checkbox" checked={picked.includes(row.name)} onChange={(e) => setPicked((prev) => e.target.checked ? [...prev, row.name] : prev.filter((n) => n !== row.name))} /></td>
                              <td className="p-2 font-mono text-xs" dir="ltr">{finalName}</td>
                              <td className="p-2">{row.title}</td>
                              <td className="p-2">{row.columns}</td>
                              <td className="p-2"><Badge variant="outline">{POLICY_LABEL[row.policy] ?? row.policy}</Badge></td>
                              <td className="p-2 font-mono text-[11px] text-muted-foreground" dir="ltr">{row.relations.join(" · ") || "—"}</td>
                              <td className="p-2">{existing === null ? "—" : exists ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3" />موجود</span> : <span className="inline-flex items-center gap-1 text-xs text-primary"><Sparkles className="size-3" />سيُنشأ</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}><Boxes className="size-4" />معاينة الأوامر</Button>
                    <Button variant="outline" onClick={() => diff.mutate()} disabled={diff.isPending}><ShieldCheck className="size-4" />فحص التوافق</Button>
                    <Button
                      onClick={() => { if (window.confirm(`سيتم إنشاء ${picked.length} جدولاً في المخطط ${schema}. متابعة؟`)) apply.mutate(); }}
                      disabled={apply.isPending || !picked.length}
                    >
                      {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}تطبيق عبر الوكيل
                    </Button>
                  </div>
                  {!rls && <p className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="size-4" />تعطيل حماية الصفوف يجعل الجداول مكشوفة — لا يُنصح به.</p>}
                </CardContent>
              </Card>

              {sql && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">معاينة الأوامر</CardTitle></CardHeader>
                  <CardContent><pre dir="ltr" className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-mono text-xs">{sql}</pre></CardContent>
                </Card>
              )}

              <ResultCard title="نتيجة التطبيق" command={lastApply} />
              <ResultCard title="نتيجة فحص التوافق" command={lastDiff} />
              <ResultCard title="نتيجة الاستخراج" command={lastExtract} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, command }: { title: string; command?: AgentCommand }) {
  if (!command) return null;
  const payload = parseOutput(command.output);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant={commandTone(command.status)}>{command.status}</Badge>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-muted-foreground">{new Date(command.created_at).toLocaleString("ar")}</p>
        {payload
          ? <pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-mono text-xs">{typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}</pre>
          : <p className="text-sm text-muted-foreground">بانتظار تنفيذ الوكيل…</p>}
      </CardContent>
    </Card>
  );
}
