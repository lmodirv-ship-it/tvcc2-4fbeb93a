import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, RefreshCw, Loader2, Globe, CheckCircle2, WifiOff, XCircle,
  ChevronDown, Filter, Link2, MoreHorizontal, Activity, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, CheckCircle, AlertCircle, Database as DbIcon,
} from "lucide-react";
import { verifyIssueRegister } from "@/lib/hn-rls.functions";
import { runHealthCheckAll } from "@/lib/health-check.functions";
import { importSupabaseProjects } from "@/lib/supabase-import.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/websites")({
  component: WebsitesPage,
  head: () => ({ meta: [{ title: "المواقع — TVCC" }] }),
});

type StatusKey = "all" | "online" | "offline" | "warning";

function WebsitesPage() {
  const qc = useQueryClient();
  const runCheckFn = useServerFn(runHealthCheckAll);
  const importSbFn = useServerFn(importSupabaseProjects);
  const verifyIssueRegisterFn = useServerFn(verifyIssueRegister);
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const { data: websites, isLoading } = useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("websites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: databases } = useQuery({
    queryKey: ["databases-list"],
    queryFn: async () => (await supabase.from("databases").select("website_id,name")).data || [],
  });

  const { data: storages } = useQuery({
    queryKey: ["storages-list"],
    queryFn: async () => (await supabase.from("storages").select("website_id,name,used_gb")).data || [],
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("website_id,full_name")).data || [],
  });

  const enriched = useMemo(() => {
    return (websites || []).map((w) => ({
      ...w,
      db: databases?.find((d) => d.website_id === w.id),
      storage: storages?.find((s) => s.website_id === w.id),
      client: clients?.find((c) => c.website_id === w.id),
    }));
  }, [websites, databases, storages, clients]);

  const filtered = enriched.filter((w) => {
    const q = search.toLowerCase();
    const matchQ = !q || w.name.toLowerCase().includes(q) || w.domain.toLowerCase().includes(q);
    const matchS = status === "all" || w.status === status;
    return matchQ && matchS;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleAll = () => {
    if (pageData.every((w) => selected.has(w.id))) {
      const ns = new Set(selected);
      pageData.forEach((w) => ns.delete(w.id));
      setSelected(ns);
    } else {
      const ns = new Set(selected);
      pageData.forEach((w) => ns.add(w.id));
      setSelected(ns);
    }
  };

  const toggleOne = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    const { error } = await supabase.from("websites").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`تم حذف ${ids.length} موقع`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["websites"] });
  };

  const bulkToggleActive = async (active: boolean) => {
    const ids = Array.from(selected);
    const { error } = await supabase.from("websites").update({ is_active: active }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`تم ${active ? "تفعيل" : "تعطيل"} ${ids.length} موقع`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["websites"] });
  };

  const verifyWebsite = async (id: string, domain: string) => {
    toast.loading("جاري التحقق من ملكية النطاق...", { id: `verify-${id}` });
    try {
      const res = await verifyIssueRegisterFn({ data: { websiteId: id } });
      if (!res.verified) {
        toast.error(`لم يتم التحقق من ملكية ${domain} — لم يُعثر على سجل _tvcc`, { id: `verify-${id}` });
      } else {
        toast.success(
          `تم التحقق عبر ${res.method} — ${res.issuedNow ? "أُصدرت" : "سارية"} شهادة HN.RLS ${res.certificate?.serial}` +
            (res.registration?.status === "registered" ? " وتم تسجيل المشروع" : " (تسجيل المشروع بانتظار المزامنة)"),
          { id: `verify-${id}`, duration: 6000 }
        );
      }
      qc.invalidateQueries({ queryKey: ["websites"] });
      qc.invalidateQueries({ queryKey: ["hn-certificates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إتمام التحقق", { id: `verify-${id}` });
    }
  };


  const total = websites?.length || 0;
  const online = websites?.filter((w) => w.status === "online").length || 0;
  const offline = websites?.filter((w) => w.status === "offline").length || 0;
  const paused = websites?.filter((w) => !w.is_active || w.status === "warning").length || 0;

  const statCards = [
    { label: "إجمالي المواقع", value: total, sub: "جميع المواقع", icon: Globe, ring: "ring-primary/40", text: "text-primary", bg: "bg-primary/15" },
    { label: "المواقع المتصلة", value: online, sub: `من أصل ${total} موقع`, icon: CheckCircle2, ring: "ring-success/40", text: "text-success", bg: "bg-success/15" },
    { label: "المواقع غير متصلة", value: offline, sub: `من أصل ${total} موقع`, icon: WifiOff, ring: "ring-warning/40", text: "text-warning", bg: "bg-warning/15" },
    { label: "المواقع المتوقفة", value: paused, sub: `من أصل ${total} موقع`, icon: XCircle, ring: "ring-destructive/40", text: "text-destructive", bg: "bg-destructive/15" },
  ];

  const fmtGb = (g?: number | string | null) => {
    if (g === null || g === undefined) return "—";
    const n = typeof g === "string" ? Number(g) : g;
    if (!n) return "0 GB";
    return `${n.toFixed(1)} GB`;
  };

  const timeAgo = (iso?: string | null) => {
    if (!iso) return "لم يُفحص";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `منذ ${m} دقيقة`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} ساعة`;
    return `منذ ${Math.floor(h / 24)} يوم`;
  };

  const statusBadge = (w: typeof enriched[number]) => {
    if (!w.is_active) return <Badge className="bg-destructive/20 text-destructive border-destructive/40">متوقف</Badge>;
    if (w.status === "online") return <Badge className="bg-success/20 text-success border-success/40">متصل</Badge>;
    if (w.status === "offline") return <Badge className="bg-warning/20 text-warning border-warning/40">غير متصل</Badge>;
    return <Badge variant="outline">{w.status}</Badge>;
  };

  const statusDot = (w: typeof enriched[number]) => {
    if (!w.is_active) return "bg-destructive";
    if (w.status === "online") return "bg-success";
    if (w.status === "offline") return "bg-warning";
    return "bg-muted-foreground";
  };

  // Donut chart values
  const pctOnline = total ? (online / total) * 100 : 0;
  const pctOffline = total ? (offline / total) * 100 : 0;
  const pctPaused = total ? (paused / total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <span className="text-foreground font-medium">المواقع</span>
        <span>/</span>
        <Link to="/dashboard" className="hover:text-foreground">الرئيسية</Link>
        <span>/</span>
        <Globe className="w-4 h-4 text-primary" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <Card key={c.label} className={`ring-1 ${c.ring} bg-card/60`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="text-right">
                  <p className={`text-xs ${c.text}`}>{c.label}</p>
                  <p className="text-3xl font-bold mt-2">{c.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.sub}</p>
                </div>
                <div className={`w-14 h-14 rounded-full ${c.bg} flex items-center justify-center ring-2 ${c.ring}`}>
                  <c.icon className={`w-6 h-6 ${c.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap" dir="rtl">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Input
                  placeholder="بحث في المواقع..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 bg-secondary/40"
                />
                <Filter className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
                <SelectTrigger className="w-40 bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="online">متصل</SelectItem>
                  <SelectItem value="offline">غير متصل</SelectItem>
                  <SelectItem value="warning">متوقف</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["websites"] })}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={selected.size === 0}>
                    إجراءات جماعية <ChevronDown className="w-4 h-4 mr-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => bulkToggleActive(true)}>تفعيل</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkToggleActive(false)}>تعطيل</DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">حذف</DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف {selected.size} موقع نهائياً.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={bulkDelete}>تأكيد</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary"><Plus className="w-4 h-4 ml-1" /> إضافة موقع</Button>
                </DialogTrigger>
                <AddWebsiteDialog onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["websites"] }); }} />
              </Dialog>
              <Button
                variant="outline"
                disabled={importing}
                onClick={async () => {
                  setImporting(true);
                  try {
                    const r = await importSbFn();
                    if (!r.ok) toast.error(r.error || "فشل الاستيراد");
                    else {
                      toast.success(`تم استيراد ${r.imported} مشروع (تخطي ${r.skipped} موجود مسبقاً من أصل ${r.total})`);
                      qc.invalidateQueries({ queryKey: ["websites"] });
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "خطأ غير معروف");
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                {importing ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <DbIcon className="w-4 h-4 ml-1" />}
                استيراد من Supabase
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pageData.length > 0 && pageData.every((w) => selected.has(w.id))}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="text-right">الموقع</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر فحص</TableHead>
                  <TableHead className="text-right">قاعدة البيانات</TableHead>
                  <TableHead className="text-right">التخزين</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
                ) : pageData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد مواقع</TableCell></TableRow>
                ) : (
                  pageData.map((w) => (
                    <TableRow key={w.id} className="border-border/40">
                      <TableCell>
                        <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggleOne(w.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className={`w-4 h-4 ${w.status === "online" ? "text-success" : w.status === "offline" ? "text-warning" : "text-destructive"}`} />
                          <span className={`font-medium ${w.status === "online" ? "text-success" : w.status === "offline" ? "text-warning" : "text-destructive"}`}>
                            {w.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{w.domain}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusDot(w)}`} />
                          {statusBadge(w)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{timeAgo(w.last_checked_at)}</TableCell>
                      <TableCell className="text-sm">{w.db?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border-2 border-primary/40 border-t-primary animate-none" />
                          <span className="text-sm">{fmtGb(w.storage?.used_gb)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.client?.full_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8" title="ربط">
                            <Link2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs border-primary/40 text-primary hover:bg-primary/10"
                            onClick={() => verifyWebsite(w.id, w.domain)}
                          >
                            تحقق
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="w-8 h-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => bulkToggleActive(!w.is_active)}>
                                {w.is_active ? "تعطيل" : "تفعيل"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={async () => {
                                  await supabase.from("websites").delete().eq("id", w.id);
                                  toast.success("تم الحذف");
                                  qc.invalidateQueries({ queryKey: ["websites"] });
                                }}
                              >
                                <Trash2 className="w-3 h-3 ml-1" /> حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2" dir="rtl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>عرض {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, filtered.length)} من {filtered.length} نتيجة</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="w-8 h-8" disabled={page === 1} onClick={() => setPage(1)}><ChevronsRight className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="w-8 h-8" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronRight className="w-4 h-4" /></Button>
              {Array.from({ length: totalPages }).slice(0, 3).map((_, i) => {
                const n = i + 1;
                return (
                  <Button key={n} size="icon" variant={page === n ? "default" : "ghost"} className="w-8 h-8" onClick={() => setPage(n)}>{n}</Button>
                );
              })}
              <Button size="icon" variant="ghost" className="w-8 h-8" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="w-8 h-8" disabled={page === totalPages} onClick={() => setPage(totalPages)}><ChevronsLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick check */}
        <Card>
          <CardContent className="p-5">
            <div className="text-right text-sm font-semibold mb-4">فحص سريع</div>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-24 h-24 rounded-full bg-primary/10 ring-2 ring-primary/40 flex items-center justify-center">
                <Activity className="w-10 h-10 text-primary" />
              </div>
              <div className="text-success text-sm font-medium">جميع الأنظمة تعمل بشكل جيد</div>
              <div className="text-xs text-muted-foreground">
                {lastCheck ? `آخر فحص شامل: ${new Date(lastCheck).toLocaleTimeString("ar")}` : "لم يتم إجراء فحص بعد"}
              </div>
              <Button
                className="w-full mt-2 bg-primary"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  const t = toast.loading("جاري فحص جميع المواقع...");
                  try {
                    const res = await runCheckFn();
                    setLastCheck(res.checked_at);
                    toast.success(
                      `اكتمل الفحص: ${res.summary.online} متصل · ${res.summary.warning} تحذير · ${res.summary.offline} غير متصل`,
                      { id: t },
                    );
                    qc.invalidateQueries({ queryKey: ["websites"] });
                  } catch (e: any) {
                    toast.error(e?.message || "فشل الفحص", { id: t });
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                {checking ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Activity className="w-4 h-4 ml-2" />}
                فحص شامل الآن
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Last operations */}
        <Card>
          <CardContent className="p-5">
            <div className="text-right text-sm font-semibold mb-4">آخر العمليات</div>
            <ul className="space-y-3 text-sm">
              {[
                { icon: CheckCircle, color: "text-success", text: "تم التحقق من موقع future.com بنجاح", time: "منذ 3 دقائق" },
                { icon: Plus, color: "text-primary", text: "تم إضافة موقع جديد: newsite.com", time: "منذ 25 دقيقة" },
                { icon: AlertCircle, color: "text-destructive", text: "فشل التحقق من موقع store.com", time: "منذ 35 دقيقة" },
                { icon: DbIcon, color: "text-primary", text: "تم تحديث قاعدة البيانات: db_tech", time: "منذ ساعة" },
                { icon: Trash2, color: "text-destructive", text: "تم حذف موقع: oldsite.com", time: "منذ ساعتين" },
              ].map((op, i) => (
                <li key={i} className="flex items-center justify-between gap-3" dir="rtl">
                  <div className="flex items-center gap-2">
                    <op.icon className={`w-4 h-4 ${op.color}`} />
                    <span>{op.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{op.time}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Distribution donut */}
        <Card>
          <CardContent className="p-5">
            <div className="text-right text-sm font-semibold mb-4">توزيع حالة المواقع</div>
            <div className="flex items-center justify-around gap-4">
              <Donut online={pctOnline} offline={pctOffline} paused={pctPaused} total={total} />
              <div className="space-y-2 text-sm">
                <LegendDot color="bg-success" label="متصل" value={online} pct={pctOnline} />
                <LegendDot color="bg-warning" label="غير متصل" value={offline} pct={pctOffline} />
                <LegendDot color="bg-destructive" label="متوقف" value={paused} pct={pctPaused} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LegendDot({ color, label, value, pct }: { color: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center gap-2" dir="rtl">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value} ({pct.toFixed(1)}%)</span>
    </div>
  );
}

function Donut({ online, offline, paused, total }: { online: number; offline: number; paused: number; total: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const s1 = (online / 100) * c;
  const s2 = (offline / 100) * c;
  const s3 = (paused / 100) * c;
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.3 0.03 265)" strokeWidth="14" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.68 0.18 155)" strokeWidth="14"
          strokeDasharray={`${s1} ${c}`} strokeDashoffset="0" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.78 0.16 75)" strokeWidth="14"
          strokeDasharray={`${s2} ${c}`} strokeDashoffset={-s1} />
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.62 0.24 25)" strokeWidth="14"
          strokeDasharray={`${s3} ${c}`} strokeDashoffset={-(s1 + s2)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-[10px] text-muted-foreground">إجمالي</div>
      </div>
    </div>
  );
}

function AddWebsiteDialog({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("websites").insert({ owner_id: user.id, name, domain, description });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إضافة الموقع");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>إضافة موقع جديد</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>اسم الموقع</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>الدومين</Label><Input required placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
        <div className="space-y-2"><Label>الوصف (اختياري)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
