import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, LayoutTemplate, Globe, Settings2, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { applyTemplate, seedStarterTemplates } from "@/lib/templates.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignStudio } from "@/components/design/DesignStudio";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
  head: () => ({ meta: [{ title: "القوالب — TVCC" }] }),
});

const TYPES = [
  { value: "store", label: "متجر" },
  { value: "news", label: "أخبار" },
  { value: "business", label: "أعمال" },
  { value: "blog", label: "مدونة" },
  { value: "general", label: "عام" },
];

function TemplatesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [linkOpen, setLinkOpen] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const applyTpl = useServerFn(applyTemplate);
  const seedTpl = useServerFn(seedStarterTemplates);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["site_templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("site_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: links } = useQuery({
    queryKey: ["wtl"],
    queryFn: async () => (await (supabase as any).from("website_template_links").select("*")).data || [],
  });

  const countFor = (tid: string) => links?.filter((l: any) => l.template_id === tid).length || 0;

  const del = async (id: string) => {
    if (!confirm("حذف القالب؟")) return;
    const { error } = await (supabase as any).from("site_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["site_templates"] });
    qc.invalidateQueries({ queryKey: ["wtl"] });
  };

  const apply = async (tpl: any, dryRun = false) => {
    const count = countFor(tpl.id);
    if (!count) return toast.error("لا توجد مواقع مرتبطة بهذا القالب");
    if (!dryRun && !confirm(`تطبيق إعدادات "${tpl.name}" على ${count} موقع؟`)) return;

    setBusy(tpl.id);
    try {
      const res: any = await applyTpl({ data: { template_id: tpl.id, dry_run: dryRun } });
      if (!res.ok) return toast.error(res.error || "فشل التطبيق");
      if (dryRun) {
        toast.info(`محاكاة: ${res.preview.keys.length} إعداد على ${res.preview.websites} موقع`);
        return;
      }
      toast.success(`تم تطبيق ${res.keys} إعداد على ${res.applied} موقع${res.failed ? ` (فشل ${res.failed})` : ""}`);
      qc.invalidateQueries({ queryKey: ["site_templates"] });
    } catch (e: any) {
      toast.error(e?.message || "خطأ غير متوقع");
    } finally {
      setBusy(null);
    }
  };

  const seed = async () => {
    setBusy("seed");
    try {
      const res: any = await seedTpl();
      if (!res.ok) return toast.error(res.error || "تعذّر الإنشاء");
      toast.success(res.created ? `تم إنشاء ${res.created} قالب جاهز` : "القوالب الجاهزة موجودة مسبقاً");
      qc.invalidateQueries({ queryKey: ["site_templates"] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-7 h-7 text-primary" /> القوالب
          </h1>
          <p className="text-muted-foreground mt-1">عدّل القالب مرة واحدة — يُطبَّق تلقائياً على كل المواقع المرتبطة</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary"><Plus className="w-4 h-4 ml-1" /> قالب جديد</Button>
          </DialogTrigger>
          <TemplateDialog
            initial={editing}
            onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["site_templates"] }); }}
          />
        </Dialog>
      </div>

      <Tabs defaultValue="templates" dir="rtl">
        <TabsList>
          <TabsTrigger value="templates">القوالب</TabsTrigger>
          <TabsTrigger value="design">استوديو التصميم</TabsTrigger>
        </TabsList>
        <TabsContent value="design" className="mt-4">
          <DesignStudio />
        </TabsContent>
        <TabsContent value="templates" className="mt-4 space-y-4">
      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
      ) : !templates?.length ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground">
          <LayoutTemplate className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <div className="mb-4">لا توجد قوالب بعد. القوالب هي مفتاح "غيّر مرة، طبّق في كل مكان".</div>
          <Button onClick={seed} disabled={busy === "seed"} className="bg-primary">
            {busy === "seed" ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
            إنشاء قوالب جاهزة
          </Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <Card key={t.id} className="ring-1 ring-border hover:ring-primary/40 transition">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between" dir="rtl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                      <LayoutTemplate className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-lg">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{TYPES.find((x) => x.value === t.template_type)?.label || t.template_type}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Globe className="w-3 h-3" /> {countFor(t.id)}
                  </Badge>
                </div>
                {t.description && <p className="text-sm text-muted-foreground line-clamp-2" dir="rtl">{t.description}</p>}
                <div className="flex gap-2 pt-2 border-t border-border/40">
                  <Button size="sm" className="flex-1 bg-primary" onClick={() => apply(t)} disabled={busy === t.id}>
                    {busy === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <Send className="w-3.5 h-3.5 ml-1" />} تطبيق
                  </Button>
                  <Button size="sm" variant="outline" title="محاكاة" onClick={() => apply(t, true)} disabled={busy === t.id}>
                    محاكاة
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setLinkOpen(t)}>
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>تعديل</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>
      </Tabs>

      {linkOpen && (
        <LinkSitesToTemplate template={linkOpen} onClose={() => { setLinkOpen(null); qc.invalidateQueries({ queryKey: ["wtl"] }); }} />
      )}
    </div>
  );
}

function TemplateDialog({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState(initial?.template_type || "general");
  const [settingsJson, setSettingsJson] = useState(
    JSON.stringify(initial?.default_settings || {}, null, 2)
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    let parsed: any;
    try { parsed = JSON.parse(settingsJson || "{}"); }
    catch { return toast.error("صيغة JSON غير صحيحة"); }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("غير مصرح"); }

    const payload = { name, description, template_type: type, default_settings: parsed, owner_id: user.id };
    const op = initial
      ? (supabase as any).from("site_templates").update(payload).eq("id", initial.id)
      : (supabase as any).from("site_templates").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "تم التحديث" : "تم الإنشاء");
    onDone();
  };

  return (
    <DialogContent dir="rtl" className="max-w-2xl">
      <DialogHeader><DialogTitle>{initial ? "تعديل قالب" : "قالب جديد"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>النوع</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>الوصف</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>الإعدادات الافتراضية (JSON)</Label>
          <Textarea
            value={settingsJson}
            onChange={(e) => setSettingsJson(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground mt-1">سيتم تطبيق هذه القيم على كل موقع مرتبط عند الضغط على "تطبيق"</p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}حفظ</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LinkSitesToTemplate({ template, onClose }: { template: any; onClose: () => void }) {
  const { data: websites } = useQuery({
    queryKey: ["websites-pick"],
    queryFn: async () => (await supabase.from("websites").select("id,name,domain")).data || [],
  });
  const { data: existing } = useQuery({
    queryKey: ["wtl", template.id],
    queryFn: async () => (await (supabase as any).from("website_template_links").select("website_id").eq("template_id", template.id)).data || [],
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  if (existing && !initialized) {
    setSelected(new Set(existing.map((e: any) => e.website_id)));
    setInitialized(true);
  }

  const toggle = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("غير مصرح");
    await (supabase as any).from("website_template_links").delete().eq("template_id", template.id);
    const rows = Array.from(selected).map((wid) => ({ template_id: template.id, website_id: wid, owner_id: user.id }));
    if (rows.length) {
      const { error } = await (supabase as any).from("website_template_links").insert(rows);
      if (error) return toast.error(error.message);
    }
    toast.success(`تم ربط ${rows.length} موقع`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>ربط المواقع بقالب {template.name}</DialogTitle></DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {websites?.length ? websites.map((w: any) => (
            <label key={w.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/40 cursor-pointer">
              <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggle(w.id)} />
              <div className="flex-1">
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-muted-foreground">{w.domain}</div>
              </div>
            </label>
          )) : <div className="text-center text-muted-foreground py-8">لا توجد مواقع</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save}>حفظ ({selected.size})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
