import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { pingCore, broadcastDirective } from "@/lib/core-hub.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Radio, Loader2, Send, Zap, CheckCircle2, XCircle, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/core-hub")({
  component: CoreHubPage,
  head: () => ({ meta: [{ title: "النواة المركزية — TVCC" }] }),
});

const CORE_URL = "https://hn-nwt.lovable.app";

function CoreHubPage() {
  const qc = useQueryClient();
  const ping = useServerFn(pingCore);
  const broadcast = useServerFn(broadcastDirective);
  const [pinging, setPinging] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", body: "", directive_type: "instruction",
    scope: "all", target_service_type: "payments", priority: "normal",
    target_website_ids: [] as string[],
  });

  const { data: cfg } = useQuery({
    queryKey: ["core-hub", "cfg"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("core_hub_config").select("*").maybeSingle();
      return data;
    },
  });

  const { data: directives } = useQuery({
    queryKey: ["core-hub", "directives"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("core_directives")
        .select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: websites } = useQuery({
    queryKey: ["core-hub", "websites"],
    queryFn: async () => {
      const { data } = await supabase.from("websites").select("id, domain").eq("is_active", true).order("domain");
      return data ?? [];
    },
  });

  const { data: serviceTypes } = useQuery({
    queryKey: ["core-hub", "svc-types"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("site_services").select("service_type");
      return Array.from(new Set((data ?? []).map((x: any) => x.service_type))) as string[];
    },
  });

  const stats = useMemo(() => {
    const list = directives ?? [];
    return {
      total: list.length,
      delivered: list.filter((d) => d.status === "delivered").length,
      broadcasting: list.filter((d) => d.status === "broadcasting").length,
      failed: list.filter((d) => d.status === "failed" || d.status === "partial").length,
    };
  }, [directives]);

  const doPing = async () => {
    setPinging(true);
    try {
      const r = await ping();
      toast.success(`النواة ${r.status === "online" ? "متصلة ✓" : r.status} (${r.ms}ms)`);
      qc.invalidateQueries({ queryKey: ["core-hub", "cfg"] });
    } catch (e: any) { toast.error(e?.message ?? "فشل الاتصال"); }
    setPinging(false);
  };

  const createDirective = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("العنوان والمحتوى مطلوبان");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await (supabase as any).from("core_directives").insert({
      owner_id: user.id,
      title: form.title.trim(),
      body: form.body.trim(),
      directive_type: form.directive_type,
      scope: form.scope,
      target_service_type: form.scope === "service_type" ? form.target_service_type : null,
      target_website_ids: form.scope === "specific_sites" ? form.target_website_ids : [],
      priority: form.priority,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء التعليمة");
    setForm({ ...form, title: "", body: "" });
    qc.invalidateQueries({ queryKey: ["core-hub", "directives"] });
    // Auto-broadcast
    await doBroadcast(data.id);
  };

  const doBroadcast = async (id: string) => {
    setSending(id);
    try {
      const r = await broadcast({ data: { directiveId: id } });
      toast.success(`تم البث → ${r.delivered}/${r.total} موقع`);
      qc.invalidateQueries({ queryKey: ["core-hub", "directives"] });
    } catch (e: any) { toast.error(e?.message ?? "فشل البث"); }
    setSending(null);
  };

  const connStatus = cfg?.connection_status ?? "unknown";
  const statusColor = connStatus === "online" ? "bg-success/20 text-success border-success/40"
    : connStatus === "warning" ? "bg-warning/20 text-warning border-warning/40"
    : connStatus === "offline" ? "bg-destructive/20 text-destructive border-destructive/40"
    : "bg-secondary text-muted-foreground";

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" /> النواة المركزية
          </h1>
          <p className="text-muted-foreground mt-1">
            مركز الأوامر — يبث التعليمات من <code className="text-primary font-mono" dir="ltr">hn-nwt.lovable.app</code> إلى كل المواقع
          </p>
        </div>
        <Button onClick={doPing} disabled={pinging} className="bg-primary">
          {pinging ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <RefreshCw className="w-4 h-4 ml-1" />}
          فحص الاتصال
        </Button>
      </div>

      {/* Connection card */}
      <Card className="ring-1 ring-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Radio className={`w-7 h-7 ${connStatus === "online" ? "text-success animate-pulse" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-muted-foreground">النواة المرتبطة</div>
            <a href={CORE_URL} target="_blank" rel="noreferrer" className="text-lg font-bold font-mono text-primary hover:underline" dir="ltr">
              {cfg?.core_url ?? CORE_URL}
            </a>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusColor}>{connStatus}</Badge>
              {cfg?.last_ping_ms != null && <span className="text-[10px] text-muted-foreground">{cfg.last_ping_ms}ms</span>}
              {cfg?.last_sync_at && <span className="text-[10px] text-muted-foreground">آخر مزامنة: {new Date(cfg.last_sync_at).toLocaleString("ar")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="text-xs">Webhook: <code dir="ltr" className="font-mono text-primary">{cfg?.webhook_path ?? "/api/public/core/ingest"}</code></span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "التعليمات", v: stats.total },
          { l: "مُسلَّمة", v: stats.delivered, c: "text-success" },
          { l: "قيد البث", v: stats.broadcasting, c: "text-primary" },
          { l: "فاشلة/جزئية", v: stats.failed, c: "text-destructive" },
        ].map((s) => (
          <Card key={s.l} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className={`text-2xl font-bold mt-1 ${s.c ?? ""}`}>{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        {/* Composer */}
        <Card className="ring-1 ring-primary/40 bg-card/60 h-fit">
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> بث تعليمة جديدة
            </div>
            <div>
              <Label>العنوان *</Label>
              <Input className="mt-1 bg-secondary/40" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: تفعيل SSL على جميع المواقع" />
            </div>
            <div>
              <Label>المحتوى / القاعدة *</Label>
              <Textarea rows={4} className="mt-1 bg-secondary/40" value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="التعليمات التي ستُرسل إلى المواقع…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>النوع</Label>
                <Select value={form.directive_type} onValueChange={(v) => setForm({ ...form, directive_type: v })}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instruction">تعليمة</SelectItem>
                    <SelectItem value="rule">قاعدة</SelectItem>
                    <SelectItem value="update">تحديث</SelectItem>
                    <SelectItem value="feature">ميزة</SelectItem>
                    <SelectItem value="broadcast">إعلان عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="normal">عادية</SelectItem>
                    <SelectItem value="high">مرتفعة</SelectItem>
                    <SelectItem value="critical">حرجة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>النطاق</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المواقع</SelectItem>
                  <SelectItem value="service_type">حسب نوع الخدمة</SelectItem>
                  <SelectItem value="specific_sites">مواقع محددة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "service_type" && (
              <div>
                <Label>نوع الخدمة</Label>
                <Select value={form.target_service_type} onValueChange={(v) => setForm({ ...form, target_service_type: v })}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(serviceTypes ?? []).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "specific_sites" && (
              <div>
                <Label>المواقع ({form.target_website_ids.length})</Label>
                <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border/40 bg-secondary/30 p-2 space-y-1">
                  {(websites ?? []).map((w) => {
                    const checked = form.target_website_ids.includes(w.id);
                    return (
                      <label key={w.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/40 rounded p-1">
                        <input type="checkbox" checked={checked} className="accent-primary"
                          onChange={() => setForm({
                            ...form,
                            target_website_ids: checked
                              ? form.target_website_ids.filter((x) => x !== w.id)
                              : [...form.target_website_ids, w.id],
                          })} />
                        <span className="font-mono" dir="ltr">{w.domain}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <Button onClick={createDirective} className="w-full bg-primary">
              <Zap className="w-4 h-4 ml-1" /> إنشاء وبثّ
            </Button>
          </CardContent>
        </Card>

        {/* Directives log */}
        <Card className="ring-1 ring-border bg-card/60">
          <CardContent className="p-5">
            <div className="text-sm font-semibold mb-3">سجل التعليمات المُرسلة</div>
            {!directives?.length ? (
              <div className="text-xs text-muted-foreground text-center p-8">لا توجد تعليمات بعد — أنشئ الأولى</div>
            ) : (
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {directives.map((d) => (
                  <div key={d.id} className="rounded-md border border-border/40 p-3 bg-secondary/20">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{d.directive_type}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${d.priority === "critical" ? "border-destructive text-destructive" : d.priority === "high" ? "border-warning text-warning" : ""}`}>{d.priority}</Badge>
                          <Badge className={
                            d.status === "delivered" ? "bg-success/20 text-success border-success/40" :
                            d.status === "broadcasting" ? "bg-primary/20 text-primary border-primary/40" :
                            d.status === "partial" ? "bg-warning/20 text-warning border-warning/40" :
                            d.status === "failed" ? "bg-destructive/20 text-destructive border-destructive/40" :
                            "bg-secondary"
                          }>{d.status}</Badge>
                          <span className="font-semibold text-sm">{d.title}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.body}</div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success" />{d.delivered_count}</span>
                          <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" />{d.failed_count}</span>
                          <span>النطاق: {d.scope}{d.target_service_type ? ` (${d.target_service_type})` : ""}</span>
                          {d.broadcast_at && <span>{new Date(d.broadcast_at).toLocaleString("ar")}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" disabled={sending === d.id}
                        onClick={() => doBroadcast(d.id)}>
                        {sending === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 ml-1" /> إعادة بث</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}