import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Layers, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  listPlatformPages,
  updatePlatformPage,
  bulkUpdatePlatformPages,
  createPlatformPage,
  deletePlatformPage,
  type PlatformPage,
} from "@/lib/platform-pages.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { PageInspector } from "./PageInspector";

export function PagesRegistryTable({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(listPlatformPages);
  const update = useServerFn(updatePlatformPage);
  const bulk = useServerFn(bulkUpdatePlatformPages);
  const create = useServerFn(createPlatformPage);
  const remove = useServerFn(deletePlatformPage);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-pages"],
    queryFn: () => load(),
  });

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"sort_order" | "code" | "name_ar" | "section">("sort_order");
  const [selected, setSelected] = useState<string[]>([]);
  const [inspected, setInspected] = useState<PlatformPage | null>(null);
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");

  const pages = data?.pages ?? [];
  const links = data?.links ?? [];

  const linkCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.page_id, (m.get(l.page_id) ?? 0) + 1);
    return m;
  }, [links]);

  const sections = useMemo(() => Array.from(new Set(pages.map((p) => p.section))).sort(), [pages]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages
      .filter((p) => (sectionFilter === "all" ? true : p.section === sectionFilter))
      .filter((p) =>
        !q ||
        p.code?.toLowerCase().includes(q) ||
        p.name_ar.toLowerCase().includes(q) ||
        p.route_path.toLowerCase().includes(q) ||
        p.section.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (sortKey === "sort_order") return a.sort_order - b.sort_order;
        return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "ar");
      });
  }, [pages, search, sectionFilter, sortKey]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-pages"] });
    qc.invalidateQueries({ queryKey: ["platform-page-rules"] });
  };

  const toggle = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<PlatformPage> }) => {
      await update({ data: input });
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "تعذر التحديث"),
  });

  const bulkApply = useMutation({
    mutationFn: async (patch: { enabled?: boolean; show_in_sidebar?: boolean; min_role?: string }) => {
      await bulk({ data: { ids: selected, patch } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم تطبيق التغيير على الصفحات المحددة");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر التطبيق"),
  });

  const addPage = useMutation({
    mutationFn: async () => {
      const path = newPath.trim();
      if (!path || !newName.trim()) throw new Error("أدخل المسار والاسم");
      await create({
        data: {
          route_path: path,
          page_key: path.replace(/^\//, "").replace(/\//g, "-") || "home",
          name_ar: newName.trim(),
        },
      });
    },
    onSuccess: () => {
      setNewPath("");
      setNewName("");
      invalidate();
      toast.success("تمت إضافة الصفحة");
    },
    onError: (e: any) => toast.error(e?.message || "تعذرت الإضافة"),
  });

  const delPage = useMutation({
    mutationFn: async (id: string) => {
      await remove({ data: { id } });
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم حذف الصفحة من السجل");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر الحذف"),
  });

  const copyRow = (p: PlatformPage) => {
    const text = [p.code, p.route_path, p.section, `الارتباطات: ${linkCount.get(p.id) ?? 0}`].join(" | ");
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ بيانات الصفحة");
  };

  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          الصفحات والوحدات ({pages.length})
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Input className="w-48" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="all">كل الأقسام</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
          >
            <option value="sort_order">ترتيب افتراضي</option>
            <option value="code">المعرّف</option>
            <option value="name_ar">الاسم</option>
            <option value="section">القسم</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => invalidate()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">محدد: {selected.length}</span>
            <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => bulkApply.mutate({ enabled: true })}>تفعيل المحدد</Button>
            <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => bulkApply.mutate({ enabled: false })}>تعطيل المحدد</Button>
            <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => bulkApply.mutate({ show_in_sidebar: true })}>إظهار في القائمة</Button>
            <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => bulkApply.mutate({ show_in_sidebar: false })}>إخفاء من القائمة</Button>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              defaultValue=""
              onChange={(e) => e.target.value && bulkApply.mutate({ min_role: e.target.value })}
            >
              <option value="">تطبيق دور...</option>
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <span className="mx-2 h-5 w-px bg-border" />
            <Input className="w-40" placeholder="/مسار-جديد" value={newPath} onChange={(e) => setNewPath(e.target.value)} />
            <Input className="w-40" placeholder="اسم الصفحة" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button size="sm" onClick={() => addPage.mutate()} disabled={addPage.isPending}>
              <Plus className="w-3.5 h-3.5 ml-1.5" />
              إضافة صفحة
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
          </div>
        )}
        {isError && <p className="text-sm text-destructive">تعذر تحميل سجل الصفحات.</p>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])}
                  />
                </TableHead>
                <TableHead>المعرّف</TableHead>
                <TableHead>اسم الصفحة</TableHead>
                <TableHead>المسار</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>مفعّلة</TableHead>
                <TableHead>في القائمة</TableHead>
                <TableHead>الدور الأدنى</TableHead>
                <TableHead>الارتباطات</TableHead>
                <TableHead>آخر تعديل</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={(v) =>
                        setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className="font-mono text-primary hover:underline"
                      onClick={() => setInspected(p)}
                    >
                      {p.code}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{p.name_ar}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.route_path}</TableCell>
                  <TableCell><Badge variant="secondary">{p.section}</Badge></TableCell>
                  <TableCell>
                    <Switch
                      checked={p.enabled}
                      disabled={!canEdit}
                      onCheckedChange={(v) => toggle.mutate({ id: p.id, patch: { enabled: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.show_in_sidebar}
                      disabled={!canEdit}
                      onCheckedChange={(v) => toggle.mutate({ id: p.id, patch: { show_in_sidebar: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={p.min_role}
                      disabled={!canEdit}
                      onChange={(e) => toggle.mutate({ id: p.id, patch: { min_role: e.target.value as AppRole } })}
                    >
                      {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{linkCount.get(p.id) ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("ar")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copyRow(p)} title="نسخ">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setInspected(p)}>تعديل</Button>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => delPage.mutate(p.id)} title="حذف">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    لا توجد صفحات مطابقة.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <PageInspector
        page={inspected}
        links={links}
        open={!!inspected}
        onOpenChange={(v) => !v && setInspected(null)}
        canEdit={canEdit}
      />
    </Card>
  );
}
