import { useMemo, useState, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Globe, Search, Loader2, AlertTriangle, Wand2, History } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export type FormRender = (api: {
  values: Record<string, any>;
  setVal: (k: string, v: any) => void;
}) => ReactNode;

export interface BulkEditorProps {
  title: string;
  subtitle?: string;
  icon: any;
  settingKey: string;
  actionLabel?: string;
  renderForm: FormRender;
  /** Optional initial values */
  initial?: Record<string, any>;
}

export function BulkEditor({
  title, subtitle, icon: Icon, settingKey, actionLabel = "تطبيق التغيير", renderForm, initial = {},
}: BulkEditorProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [applying, setApplying] = useState(false);

  const { data: websites } = useQuery({
    queryKey: ["websites"],
    queryFn: async () => (await supabase.from("websites").select("*").order("created_at", { ascending: false })).data || [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("id,full_name,website_id")).data || [],
  });
  const { data: subs } = useQuery({
    queryKey: ["subs-list"],
    queryFn: async () => (await supabase.from("subscriptions").select("website_id,plan_name,status")).data || [],
  });
  const { data: recent } = useQuery({
    queryKey: ["editor-activity", settingKey],
    queryFn: async () => (await supabase.from("activity_log")
      .select("*").eq("entity_type", "editor")
      .order("created_at", { ascending: false }).limit(6)).data || [],
  });

  const enriched = useMemo(() => (websites || []).map((w) => ({
    ...w,
    client: clients?.find((c) => c.website_id === w.id)?.full_name || "—",
    sub: subs?.find((s) => s.website_id === w.id)?.plan_name || "—",
  })), [websites, clients, subs]);

  const clientOptions = useMemo(
    () => Array.from(new Set((clients || []).map((c) => c.full_name).filter(Boolean))),
    [clients]
  );
  const subOptions = useMemo(
    () => Array.from(new Set((subs || []).map((s) => s.plan_name).filter(Boolean))),
    [subs]
  );

  const filtered = enriched.filter((w) => {
    const q = search.toLowerCase();
    const matchQ = !q || w.name.toLowerCase().includes(q) || w.domain.toLowerCase().includes(q);
    return matchQ
      && (clientFilter === "all" || w.client === clientFilter)
      && (statusFilter === "all" || w.status === statusFilter)
      && (subFilter === "all" || w.sub === subFilter);
  });

  const toggleAll = () => {
    if (filtered.every((w) => selected.has(w.id))) {
      const ns = new Set(selected);
      filtered.forEach((w) => ns.delete(w.id));
      setSelected(ns);
    } else {
      const ns = new Set(selected);
      filtered.forEach((w) => ns.add(w.id));
      setSelected(ns);
    }
  };
  const toggleOne = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const setVal = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));
  const selectedSites = enriched.filter((w) => selected.has(w.id));
  const valuesReady = Object.values(values).some((v) => v !== "" && v !== undefined && v !== null);

  const apply = async () => {
    if (selected.size === 0) return toast.error("اختر موقعاً على الأقل");
    setApplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const rows = Array.from(selected).map((wid) => ({
        website_id: wid, owner_id: user.id, setting_key: settingKey, value: values,
      }));
      const { error } = await supabase.from("website_settings").upsert(rows, { onConflict: "website_id,setting_key" });
      if (error) throw error;
      await supabase.from("activity_log").insert({
        owner_id: user.id, action: `bulk_${settingKey}`, entity_type: "editor",
        details: { change: title, sites: Array.from(selected), values },
      });
      toast.success(`تم تطبيق التغيير على ${selected.size} موقع`);
      setValues(initial);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["editor-activity", settingKey] });
    } catch (e: any) {
      toast.error(e?.message || "فشل التطبيق");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
          <span>/</span>
          <Link to="/editor" className="hover:text-foreground">المحرر</Link>
          <span>/</span>
          <span className="text-foreground">{title}</span>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <h1 className="text-2xl font-bold">{title}</h1>
            <Icon className="w-6 h-6 text-primary" />
          </div>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sites table */}
        <Card className="lg:col-span-2 bg-card/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{selected.size} محدّد</Badge>
              <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> اختيار المواقع</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="relative col-span-2 md:col-span-1">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 h-9" />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="العميل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل العملاء</SelectItem>
                  {clientOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="online">متصل</SelectItem>
                  <SelectItem value="offline">غير متصل</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subFilter} onValueChange={setSubFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="الاشتراك" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الاشتراكات</SelectItem>
                  {subOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto border border-border/40 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((w) => selected.has(w.id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-right">الموقع</TableHead>
                    <TableHead className="text-right">الدومين</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد مواقع</TableCell></TableRow>
                  ) : filtered.map((w) => (
                    <TableRow key={w.id} className="border-border/40">
                      <TableCell><Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggleOne(w.id)} /></TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{w.domain}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          w.status === "online" ? "border-success/40 text-success" :
                          w.status === "offline" ? "border-destructive/40 text-destructive" : "border-warning/40 text-warning"
                        }>{w.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{w.client}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Form + preview */}
        <Card className="bg-card/60">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {title}</h2>
            <Separator />
            {renderForm({ values, setVal })}
            <Separator />
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4 text-warning" /> معاينة التغيير</div>
              <div className="text-muted-foreground text-xs">سيُطبَّق على <span className="text-foreground font-semibold">{selected.size}</span> موقع</div>
              {selectedSites.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedSites.slice(0, 6).map((s) => <Badge key={s.id} variant="secondary" className="text-[10px]">{s.name}</Badge>)}
                  {selectedSites.length > 6 && <Badge variant="secondary" className="text-[10px]">+{selectedSites.length - 6}</Badge>}
                </div>
              )}
              {valuesReady && (
                <pre className="text-[10px] bg-background/60 p-2 rounded overflow-auto max-h-32">{JSON.stringify(values, null, 2)}</pre>
              )}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={selected.size === 0 || !valuesReady || applying}>
                  {applying ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Wand2 className="w-4 h-4 ml-2" />}
                  {actionLabel}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد التطبيق الجماعي</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم تطبيق "{title}" على {selected.size} موقع. هذا الإجراء يُسجَّل في سجل العمليات.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={apply}>تأكيد التطبيق</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Recent */}
      <Card className="bg-card/60">
        <CardContent className="p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><History className="w-4 h-4 text-primary" /> آخر العمليات</h2>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">نوع التغيير</TableHead>
                <TableHead className="text-right">المواقع</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!recent || recent.length === 0) ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">لا توجد عمليات بعد</TableCell></TableRow>
              ) : recent.map((r) => {
                const det = (r.details || {}) as any;
                const count = Array.isArray(det.sites) ? det.sites.length : 0;
                return (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="text-sm">Admin</TableCell>
                    <TableCell className="text-sm">{det.change || r.action}</TableCell>
                    <TableCell><Badge variant="secondary">{count} موقع</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || "#3b82f6"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border/40 bg-transparent" />
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#3b82f6" className="flex-1 font-mono text-xs" />
      </div>
    </div>
  );
}
