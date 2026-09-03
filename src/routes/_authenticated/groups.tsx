import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Loader2, FolderOpen, Globe, Settings2, Search, Download, Copy, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
  head: () => ({
    meta: [
      { title: "المجموعات — إدارة مجموعات المواقع | TVCC" },
      { name: "description", content: "نظّم مواقعك ضمن مجموعات في جدول واحد مع ربط جماعي وإضافة كل المواقع دفعة واحدة." },
      { property: "og:title", content: "المجموعات — TVCC" },
      { property: "og:description", content: "إدارة مجموعات المواقع والربط الجماعي في TVCC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#64748b"];

function GroupsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [linkOpen, setLinkOpen] = useState<any>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "count" | "date">("date");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const { data: groups, isLoading } = useQuery({
    queryKey: ["site_groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("site_groups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["wgm"],
    queryFn: async () => (await (supabase as any).from("website_group_members").select("*")).data || [],
  });

  const countFor = (gid: string) => members?.filter((m: any) => m.group_id === gid).length || 0;

  const rows = useMemo(() => {
    let list = (groups || []).filter((g: any) =>
      !q.trim() || `${g.name} ${g.description || ""}`.toLowerCase().includes(q.toLowerCase()));
    list = [...list].sort((a: any, b: any) => {
      if (sort === "name") return String(a.name).localeCompare(String(b.name), "ar");
      if (sort === "count") return countFor(b.id) - countFor(a.id);
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    return list;
  }, [groups, members, q, sort]);

  const totalLinks = members?.length || 0;

  const toggleRow = (id: string) => {
    const ns = new Set(checked);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setChecked(ns);
  };
  const toggleAll = () => {
    setChecked(checked.size === rows.length ? new Set() : new Set(rows.map((g: any) => g.id)));
  };

  const del = async (ids: string[]) => {
    if (!confirm(`حذف ${ids.length} مجموعة؟`)) return;
    const { error } = await (supabase as any).from("site_groups").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    setChecked(new Set());
    qc.invalidateQueries({ queryKey: ["site_groups"] });
    qc.invalidateQueries({ queryKey: ["wgm"] });
  };

  const exportCsv = () => {
    const head = ["الاسم", "الوصف", "اللون", "عدد المواقع", "تاريخ الإنشاء"];
    const body = rows.map((g: any) => [g.name, g.description || "", g.color, countFor(g.id), g.created_at || ""]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "groups.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-primary" /> المجموعات
          </h1>
          <p className="text-muted-foreground mt-1">نظّم مواقعك ضمن مجموعات لتطبيق التغييرات دفعة واحدة</p>
        </div>
        <div className="flex items-center gap-2">
          {checked.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => del(Array.from(checked))}>
              <Trash2 className="w-4 h-4 ml-1" /> حذف ({checked.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 ml-1" /> CSV</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary"><Plus className="w-4 h-4 ml-1" /> مجموعة جديدة</Button>
            </DialogTrigger>
            <GroupDialog
              key={editing?.id || "new"}
              initial={editing}
              onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["site_groups"] }); }}
            />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="عدد المجموعات" value={groups?.length || 0} />
        <StatCard label="إجمالي الارتباطات" value={totalLinks} />
        <StatCard label="مجموعات فارغة" value={(groups || []).filter((g: any) => countFor(g.id) === 0).length} />
        <StatCard label="محددة" value={checked.size} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-52">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المجموعات..." className="pr-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setSort(sort === "name" ? "count" : sort === "count" ? "date" : "name")}>
              <ArrowUpDown className="w-4 h-4 ml-1" />
              ترتيب: {sort === "name" ? "الاسم" : sort === "count" ? "عدد المواقع" : "الأحدث"}
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
          ) : !rows.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
              لا توجد مجموعات مطابقة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={checked.size === rows.length && rows.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-right">المجموعة</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">المواقع</TableHead>
                    <TableHead className="text-right">اللون</TableHead>
                    <TableHead className="text-right">أُنشئت</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((g: any) => (
                    <TableRow key={g.id} className="hover:bg-secondary/30">
                      <TableCell><Checkbox checked={checked.has(g.id)} onCheckedChange={() => toggleRow(g.id)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: `${g.color}25`, color: g.color }}>
                            <FolderOpen className="w-4 h-4" />
                          </span>
                          {g.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-64 truncate">{g.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" /> {countFor(g.id)}</Badge>
                      </TableCell>
                      <TableCell><span className="inline-block w-5 h-5 rounded-full" style={{ background: g.color }} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {g.created_at ? new Date(g.created_at).toLocaleDateString("ar") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setLinkOpen(g)}>
                            <Settings2 className="w-3.5 h-3.5 ml-1" /> ربط المواقع
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(g); setOpen(true); }}>تعديل</Button>
                          <Button size="sm" variant="ghost" title="نسخ المعرف"
                            onClick={() => { navigator.clipboard.writeText(g.id); toast.success("تم نسخ المعرف"); }}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => del([g.id])}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {linkOpen && (
        <LinkSitesDialog group={linkOpen} onClose={() => { setLinkOpen(null); qc.invalidateQueries({ queryKey: ["wgm"] }); }} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent></Card>
  );
}

function GroupDialog({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("غير مصرح"); }
    const payload = { name, description, color, owner_id: user.id };
    const op = initial
      ? (supabase as any).from("site_groups").update(payload).eq("id", initial.id)
      : (supabase as any).from("site_groups").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "تم التحديث" : "تم الإنشاء");
    onDone();
  };

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{initial ? "تعديل مجموعة" : "مجموعة جديدة"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>الاسم</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: المتاجر، الأخبار..." />
        </div>
        <div>
          <Label>الوصف</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>اللون</Label>
          <div className="flex gap-2 mt-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}حفظ</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LinkSitesDialog({ group, onClose }: { group: any; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: websites } = useQuery({
    queryKey: ["websites-pick"],
    queryFn: async () => (await supabase.from("websites").select("id,name,domain").order("name")).data || [],
  });
  const { data: existing } = useQuery({
    queryKey: ["wgm", group.id],
    queryFn: async () => (await (supabase as any).from("website_group_members").select("website_id").eq("group_id", group.id)).data || [],
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  if (existing && !initialized) {
    setSelected(new Set(existing.map((e: any) => e.website_id)));
    setInitialized(true);
  }

  const filtered = (websites || []).filter((w: any) =>
    !search.trim() || `${w.name} ${w.domain || ""}`.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const selectAll = () => setSelected(new Set((websites || []).map((w: any) => w.id)));
  const selectFiltered = () => {
    const ns = new Set(selected);
    filtered.forEach((w: any) => ns.add(w.id));
    setSelected(ns);
  };
  const clearAll = () => setSelected(new Set());

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("غير مصرح"); }
    await (supabase as any).from("website_group_members").delete().eq("group_id", group.id);
    const rows = Array.from(selected).map((wid) => ({ group_id: group.id, website_id: wid, owner_id: user.id }));
    if (rows.length) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await (supabase as any).from("website_group_members").insert(rows.slice(i, i + 500));
        if (error) { setSaving(false); return toast.error(error.message); }
      }
    }
    setSaving(false);
    toast.success(`تم ربط ${rows.length} موقع`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>ربط المواقع بـ {group.name}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث عن موقع..." className="pr-9" />
          </div>
          <Button size="sm" variant="outline" onClick={selectAll}>إضافة الكل ({websites?.length || 0})</Button>
          <Button size="sm" variant="outline" onClick={selectFiltered} disabled={!search.trim()}>إضافة نتائج البحث</Button>
          <Button size="sm" variant="ghost" onClick={clearAll}>إلغاء التحديد</Button>
        </div>

        <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-right">النطاق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((w: any) => (
                <TableRow key={w.id} className="cursor-pointer" onClick={() => toggle(w.id)}>
                  <TableCell><Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggle(w.id)} /></TableCell>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{w.domain || "—"}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">لا توجد مواقع</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}حفظ ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
