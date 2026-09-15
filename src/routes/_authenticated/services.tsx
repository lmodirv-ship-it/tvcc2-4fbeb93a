import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Boxes, Plus, Loader2, Trash2, Link2, Zap, Search, Network } from "lucide-react";
import { toast } from "sonner";
import { getServiceMatrix, publishServiceMesh } from "@/lib/service-mesh.functions";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: "الخدمات المتبادلة — TVCC" },
      { name: "description", content: "جدول مواقع مجموعة HN والخدمة التي يقدّمها كل موقع وترابطها مع باقي المواقع." },
    ],
  }),
});

const SERVICE_TYPES = [
  "payments","database","storage","ai","video","audio","streaming","archive",
  "notifications","security","console","orchestration","bridge","core",
  "analytics","automation","docs","explorer","search","ecommerce","invoicing",
  "realestate","builder","utility","chat",
] as const;

const TYPE_COLORS: Record<string, string> = {
  payments: "bg-success/20 text-success border-success/40",
  database: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  storage: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  ai: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40",
  video: "bg-pink-500/20 text-pink-400 border-pink-500/40",
  security: "bg-red-500/20 text-red-400 border-red-500/40",
};

type Service = {
  id: string; website_id: string; service_type: string; name: string;
  description: string | null; endpoint_url: string | null; status: string; is_public: boolean;
};

function ServicesPage() {
  const qc = useQueryClient();
  const matrixFn = useServerFn(getServiceMatrix);
  const publishFn = useServerFn(publishServiceMesh);

  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [nf, setNf] = useState({ service_type: "payments", name: "", description: "", endpoint_url: "" });

  const { data: matrix, isLoading } = useQuery({
    queryKey: ["srv", "matrix"],
    queryFn: () => matrixFn({ data: {} as never }) as any,
    refetchInterval: 60_000,
  });

  const { data: services } = useQuery({
    queryKey: ["srv", "services"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_services")
        .select("id, website_id, service_type, name, description, endpoint_url, status, is_public")
        .order("service_type");
      if (error) throw error;
      return data as Service[];
    },
  });

  const rows: any[] = matrix?.rows ?? [];
  const totals = matrix?.totals ?? { sites: 0, providers: 0, missing: 0, services: 0, deps: 0 };

  const groupOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => { if (r.group) set.set(r.group, r.group); });
    return Array.from(set.keys()).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (groupFilter !== "all" && r.group !== groupFilter) return false;
      if (onlyMissing && r.services.length > 0) return false;
      if (!ql) return true;
      return (
        String(r.domain).toLowerCase().includes(ql) ||
        String(r.name).toLowerCase().includes(ql) ||
        String(r.site_code ?? "").toLowerCase().includes(ql) ||
        r.services.some((s: any) => String(s.name).toLowerCase().includes(ql) || String(s.service_type).includes(ql))
      );
    });
  }, [rows, q, groupFilter, onlyMissing]);

  const selectedRow = rows.find((r) => r.id === selectedWebsite) ?? null;
  const consumedIds = new Set<string>();

  const { data: deps } = useQuery({
    queryKey: ["srv", "deps", selectedWebsite],
    enabled: Boolean(selectedWebsite),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_dependencies")
        .select("id, consumer_website_id, service_id")
        .eq("consumer_website_id", selectedWebsite);
      if (error) throw error;
      return data as any[];
    },
  });
  (deps ?? []).forEach((d) => consumedIds.add(d.service_id));

  const publish = useMutation({
    mutationFn: () => publishFn({ data: {} as never }) as any,
    onSuccess: (r: any) => {
      toast.success(`تم إنشاء ${r.created} خدمة وربط ${r.linked} علاقة عبر ${r.sites} موقعاً`);
      qc.invalidateQueries({ queryKey: ["srv"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذّر نشر نظام الخدمات"),
  });

  const addService = async () => {
    if (!selectedWebsite) return toast.error("اختر موقعاً أولاً");
    if (!nf.name.trim()) return toast.error("اسم الخدمة مطلوب");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("site_services").insert({
      owner_id: auth.user?.id,
      website_id: selectedWebsite,
      service_type: nf.service_type,
      name: nf.name.trim(),
      description: nf.description.trim() || null,
      endpoint_url: nf.endpoint_url.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة الخدمة");
    setNf({ service_type: "payments", name: "", description: "", endpoint_url: "" });
    setAddOpen(false);
    qc.invalidateQueries({ queryKey: ["srv"] });
  };

  const removeService = async (id: string) => {
    if (!confirm("حذف هذه الخدمة؟ سيؤثر على المواقع المستفيدة.")) return;
    const { error } = await (supabase as any).from("site_services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["srv"] });
  };

  const wireAll = async (serviceId: string, providerId: string, serviceName: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const list = rows
      .filter((w) => w.id !== providerId)
      .map((w) => ({
        owner_id: auth.user?.id,
        consumer_website_id: w.id,
        provider_website_id: providerId,
        service_id: serviceId,
        status: "active",
        notes: `wired: ${serviceName}`,
      }));
    const { error } = await (supabase as any)
      .from("service_dependencies")
      .upsert(list, { onConflict: "consumer_website_id,service_id", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`ربط ${list.length} موقع بـ ${serviceName}`);
    qc.invalidateQueries({ queryKey: ["srv"] });
  };

  const toggleDep = async (consumerId: string, serviceId: string, isActive: boolean) => {
    if (isActive) {
      const { error } = await (supabase as any).from("service_dependencies")
        .delete().eq("consumer_website_id", consumerId).eq("service_id", serviceId);
      if (error) return toast.error(error.message);
    } else {
      const service = services?.find((s) => s.id === serviceId);
      if (!service) return;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("service_dependencies").insert({
        owner_id: auth.user?.id,
        consumer_website_id: consumerId, provider_website_id: service.website_id,
        service_id: serviceId, status: "active",
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["srv"] });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Boxes className="w-7 h-7 text-primary" /> الخدمات المتبادلة
        </h1>
        <p className="text-muted-foreground mt-1">كل موقع يقدّم خدمة — وكل المواقع تستفيد من خدمات بعضها البعض</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { l: "مواقع المجموعة", v: totals.sites },
          { l: "مواقع مقدِّمة", v: totals.providers },
          { l: "بدون خدمة", v: totals.missing },
          { l: "الخدمات", v: totals.services },
          { l: "الترابطات", v: totals.deps },
        ].map((s) => (
          <Card key={s.l} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className="text-2xl font-bold mt-1">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input placeholder="ابحث بالموقع أو النطاق أو الخدمة…" value={q} onChange={(e) => setQ(e.target.value)}
                className="pr-9 bg-secondary/40" />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[200px] bg-secondary/40"><SelectValue placeholder="كل المجموعات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المجموعات</SelectItem>
                {groupOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={onlyMissing ? "default" : "outline"} onClick={() => setOnlyMissing(!onlyMissing)}>
              بدون خدمة
            </Button>
            <Button onClick={() => publish.mutate()} disabled={publish.isPending} className="bg-primary">
              {publish.isPending ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Network className="w-4 h-4 ml-1" />}
              نشر نظام الخدمات
            </Button>
          </div>

          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرمز</TableHead>
                  <TableHead className="text-right">الموقع</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">المجموعة</TableHead>
                  <TableHead className="text-right">الخدمة المقدَّمة</TableHead>
                  <TableHead className="text-right">مستفيدون</TableHead>
                  <TableHead className="text-right">يستفيد من</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    لا نتائج
                  </TableCell></TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}
                    onClick={() => setSelectedWebsite(r.id)}
                    className={`cursor-pointer ${selectedWebsite === r.id ? "bg-primary/10" : ""}`}>
                    <TableCell className="font-mono text-xs">{r.site_code ?? "—"}</TableCell>
                    <TableCell className="text-sm font-medium max-w-[180px] truncate">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{r.domain}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.group ?? "—"}</TableCell>
                    <TableCell>
                      {r.services.length === 0 ? (
                        <span className="text-[11px] text-warning">بدون خدمة</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.services.slice(0, 3).map((s: any) => (
                            <Badge key={s.id} className={`text-[10px] ${TYPE_COLORS[s.service_type] ?? "bg-secondary"}`}>
                              {s.service_type} · {s.name}
                            </Badge>
                          ))}
                          {r.services.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{r.services.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{r.consumers}</TableCell>
                    <TableCell className="tabular-nums text-xs">{r.consumes}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{r.status ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-[11px] text-muted-foreground">عرض {filtered.length} من {rows.length} موقعاً</div>
        </CardContent>
      </Card>

      {selectedRow && (
        <div className="space-y-4">
          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">الموقع المحدد · {selectedRow.group ?? "بدون مجموعة"}</div>
                  <div className="text-xl font-bold font-mono" dir="ltr">{selectedRow.domain}</div>
                </div>
                <Button onClick={() => setAddOpen(!addOpen)} className="bg-primary">
                  <Plus className="w-4 h-4 ml-1" /> إضافة خدمة
                </Button>
              </div>

              {addOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-lg bg-secondary/30 border border-primary/30">
                  <div>
                    <Label>نوع الخدمة</Label>
                    <Select value={nf.service_type} onValueChange={(v) => setNf({ ...nf, service_type: v })}>
                      <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>اسم الخدمة *</Label>
                    <Input className="mt-1 bg-secondary/40" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>الرابط</Label>
                    <Input dir="ltr" className="mt-1 bg-secondary/40 font-mono text-xs" value={nf.endpoint_url} onChange={(e) => setNf({ ...nf, endpoint_url: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>الوصف</Label>
                    <Textarea className="mt-1 bg-secondary/40" value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button onClick={addService} className="bg-primary">حفظ</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> الخدمات التي يقدّمها ({selectedRow.services.length})
              </div>
              {!selectedRow.services.length ? (
                <div className="text-xs text-muted-foreground p-4 text-center">لا خدمات — أضف الأولى أو انشر نظام الخدمات</div>
              ) : (
                <div className="space-y-2">
                  {selectedRow.services.map((s: any) => (
                    <div key={s.id} className="rounded-md border border-border/40 p-3 bg-secondary/20">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={TYPE_COLORS[s.service_type] ?? "bg-secondary"}>{s.service_type}</Badge>
                            <span className="font-semibold">{s.name}</span>
                          </div>
                          {s.endpoint_url && <code className="text-[10px] font-mono text-primary break-all mt-1 block" dir="ltr">{s.endpoint_url}</code>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => wireAll(s.id, selectedRow.id, s.name)}>
                            <Link2 className="w-3 h-3 ml-1" /> ربط الكل
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeService(s.id)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm font-semibold mb-3">الخدمات المتاحة من مواقع أخرى</div>
              <div className="max-h-[420px] overflow-y-auto space-y-1">
                {(services ?? []).filter((s) => s.website_id !== selectedRow.id).map((s) => {
                  const provider = rows.find((w) => w.id === s.website_id);
                  const active = consumedIds.has(s.id);
                  return (
                    <label key={s.id} className={`flex items-center gap-3 rounded-md p-2 text-xs cursor-pointer transition ${active ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/30 border border-transparent"}`}>
                      <input type="checkbox" checked={active} onChange={() => toggleDep(selectedRow.id, s.id, active)}
                        className="w-4 h-4 accent-primary" />
                      <Badge className={TYPE_COLORS[s.service_type] ?? "bg-secondary"}>{s.service_type}</Badge>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-[10px] mr-auto font-mono" dir="ltr">{provider?.domain}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
