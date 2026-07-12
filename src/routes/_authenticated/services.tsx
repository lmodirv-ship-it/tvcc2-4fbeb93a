import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Boxes, Plus, Loader2, Trash2, Link2, Zap, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
  head: () => ({ meta: [{ title: "الخدمات المتبادلة — TVCC" }] }),
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

type Website = { id: string; domain: string; name: string };
type Service = {
  id: string; website_id: string; service_type: string; name: string;
  description: string | null; endpoint_url: string | null; status: string; is_public: boolean;
};
type Dependency = {
  id: string; consumer_website_id: string; provider_website_id: string;
  service_id: string; status: string;
};

function ServicesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [nf, setNf] = useState({ service_type: "payments", name: "", description: "", endpoint_url: "" });

  const { data: websites } = useQuery({
    queryKey: ["srv", "websites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("websites").select("id, domain, name").order("domain");
      if (error) throw error;
      return data as Website[];
    },
  });

  const { data: services, isLoading } = useQuery({
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

  const { data: deps } = useQuery({
    queryKey: ["srv", "deps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_dependencies")
        .select("id, consumer_website_id, provider_website_id, service_id, status");
      if (error) throw error;
      return data as Dependency[];
    },
  });

  const websiteById = useMemo(() => new Map((websites ?? []).map((w) => [w.id, w])), [websites]);
  const servicesByWebsite = useMemo(() => {
    const m = new Map<string, Service[]>();
    (services ?? []).forEach((s) => {
      if (!m.has(s.website_id)) m.set(s.website_id, []);
      m.get(s.website_id)!.push(s);
    });
    return m;
  }, [services]);

  const consumedByWebsite = useMemo(() => {
    const m = new Map<string, Dependency[]>();
    (deps ?? []).forEach((d) => {
      if (!m.has(d.consumer_website_id)) m.set(d.consumer_website_id, []);
      m.get(d.consumer_website_id)!.push(d);
    });
    return m;
  }, [deps]);

  const stats = useMemo(() => ({
    sites: websites?.length ?? 0,
    services: services?.length ?? 0,
    deps: deps?.length ?? 0,
    providers: new Set((services ?? []).map((s) => s.website_id)).size,
  }), [websites, services, deps]);

  const filteredWebsites = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (websites ?? []).filter((w) => {
      if (ql && !w.domain.toLowerCase().includes(ql) && !(w.name ?? "").toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [websites, q]);

  const addService = async () => {
    if (!selectedWebsite) return toast.error("اختر موقعاً أولاً");
    if (!nf.name.trim()) return toast.error("اسم الخدمة مطلوب");
    const { error } = await (supabase as any).from("site_services").insert({
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
    qc.invalidateQueries({ queryKey: ["srv", "services"] });
  };

  const removeService = async (id: string) => {
    if (!confirm("حذف هذه الخدمة؟ سيؤثر على المواقع المستفيدة.")) return;
    const { error } = await (supabase as any).from("site_services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["srv"] });
  };

  const wireAll = async (serviceId: string, providerId: string, serviceName: string) => {
    if (!websites) return;
    const rows = websites
      .filter((w) => w.id !== providerId)
      .map((w) => ({ consumer_website_id: w.id, provider_website_id: providerId, service_id: serviceId, status: "active", notes: `wired: ${serviceName}` }));
    const { error } = await (supabase as any).from("service_dependencies").upsert(rows, { onConflict: "consumer_website_id,service_id", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`ربط ${rows.length} موقع بـ ${serviceName}`);
    qc.invalidateQueries({ queryKey: ["srv", "deps"] });
  };

  const toggleDep = async (consumerId: string, serviceId: string, isActive: boolean) => {
    if (isActive) {
      const { error } = await (supabase as any).from("service_dependencies")
        .delete().eq("consumer_website_id", consumerId).eq("service_id", serviceId);
      if (error) return toast.error(error.message);
    } else {
      const service = services?.find((s) => s.id === serviceId);
      if (!service) return;
      const { error } = await (supabase as any).from("service_dependencies").insert({
        consumer_website_id: consumerId, provider_website_id: service.website_id,
        service_id: serviceId, status: "active",
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["srv", "deps"] });
  };

  const selected = selectedWebsite ? websiteById.get(selectedWebsite) : null;
  const selectedServices = selectedWebsite ? servicesByWebsite.get(selectedWebsite) ?? [] : [];
  const selectedConsumed = selectedWebsite ? consumedByWebsite.get(selectedWebsite) ?? [] : [];
  const consumedIds = new Set(selectedConsumed.map((d) => d.service_id));

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Boxes className="w-7 h-7 text-primary" /> الخدمات المتبادلة
        </h1>
        <p className="text-muted-foreground mt-1">كل موقع يقدّم خدمة — وكل المواقع تستفيد من خدمات بعضها البعض</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "المواقع", v: stats.sites },
          { l: "الخدمات", v: stats.services },
          { l: "الموفّرون", v: stats.providers },
          { l: "الترابطات", v: stats.deps },
        ].map((s) => (
          <Card key={s.l} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className="text-2xl font-bold mt-1">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Sites list */}
        <Card className="ring-1 ring-border bg-card/60 h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input dir="ltr" placeholder="ابحث عن موقع…" value={q} onChange={(e) => setQ(e.target.value)}
                className="pr-9 bg-secondary/40" />
            </div>
            <div className="max-h-[600px] overflow-y-auto space-y-1">
              {isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />}
              {filteredWebsites.map((w) => {
                const sc = servicesByWebsite.get(w.id)?.length ?? 0;
                const cc = consumedByWebsite.get(w.id)?.length ?? 0;
                const active = selectedWebsite === w.id;
                return (
                  <button key={w.id} onClick={() => setSelectedWebsite(w.id)}
                    className={`w-full text-right rounded-md p-2 transition text-sm ${active ? "bg-primary/15 border border-primary/40" : "hover:bg-secondary/40 border border-transparent"}`}>
                    <div className="font-mono text-xs" dir="ltr">{w.domain}</div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>يقدّم {sc}</span><span>·</span><span>يستفيد من {cc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <div className="space-y-4">
          {!selected ? (
            <Card className="ring-1 ring-border bg-card/60">
              <CardContent className="p-12 text-center text-muted-foreground">اختر موقعاً من القائمة لعرض خدماته وترابطاته</CardContent>
            </Card>
          ) : (
            <>
              <Card className="ring-1 ring-border bg-card/60">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">الموقع المحدد</div>
                      <div className="text-xl font-bold font-mono" dir="ltr">{selected.domain}</div>
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

              {/* Services offered */}
              <Card className="ring-1 ring-border bg-card/60">
                <CardContent className="p-5">
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> الخدمات التي يقدّمها ({selectedServices.length})
                  </div>
                  {!selectedServices.length ? (
                    <div className="text-xs text-muted-foreground p-4 text-center">لا خدمات — أضف الأولى</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedServices.map((s) => {
                        const consumers = (deps ?? []).filter((d) => d.service_id === s.id).length;
                        return (
                          <div key={s.id} className="rounded-md border border-border/40 p-3 bg-secondary/20">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={TYPE_COLORS[s.service_type] ?? "bg-secondary"}>{s.service_type}</Badge>
                                  <span className="font-semibold">{s.name}</span>
                                  <Badge variant="outline" className="text-[10px]">مستفيدون: {consumers}</Badge>
                                </div>
                                {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
                                {s.endpoint_url && <code className="text-[10px] font-mono text-primary break-all mt-1 block" dir="ltr">{s.endpoint_url}</code>}
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => wireAll(s.id, s.website_id, s.name)}>
                                  <Link2 className="w-3 h-3 ml-1" /> ربط الكل
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => removeService(s.id)}>
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Services consumed */}
              <Card className="ring-1 ring-border bg-card/60">
                <CardContent className="p-5">
                  <div className="text-sm font-semibold mb-3">الخدمات المتاحة من مواقع أخرى</div>
                  <div className="max-h-[500px] overflow-y-auto space-y-1">
                    {(services ?? []).filter((s) => s.website_id !== selected.id).map((s) => {
                      const provider = websiteById.get(s.website_id);
                      const active = consumedIds.has(s.id);
                      return (
                        <label key={s.id} className={`flex items-center gap-3 rounded-md p-2 text-xs cursor-pointer transition ${active ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/30 border border-transparent"}`}>
                          <input type="checkbox" checked={active} onChange={() => toggleDep(selected.id, s.id, active)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}