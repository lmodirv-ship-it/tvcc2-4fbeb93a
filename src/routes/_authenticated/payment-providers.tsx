import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Save, Copy, RefreshCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-providers")({
  component: PaymentProvidersPage,
  head: () => ({ meta: [{ title: "مزودو الدفع — TVCC" }] }),
});

const DEFAULT_PROVIDER = "https://hnpay-ai.lovable.app";

function PaymentProvidersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pingState, setPingState] = useState<Record<string, "idle" | "ok" | "fail" | "loading">>({});

  const { data: websites, isLoading } = useQuery({
    queryKey: ["payment-providers", "websites"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("websites")
        .select("id, domain, name, payments_provider_url, is_active, status")
        .order("domain", { ascending: true });
      if (error) throw error;
      return data as Array<{
        id: string; domain: string; name: string;
        payments_provider_url: string | null; is_active: boolean; status: string;
      }>;
    },
  });

  const { data: subs } = useQuery({
    queryKey: ["payment-providers", "subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("website_id, status, plan_name")
        .eq("status", "active");
      if (error) throw error;
      return data as Array<{ website_id: string | null; status: string; plan_name: string }>;
    },
  });

  const subsByWebsite = useMemo(() => {
    const map = new Map<string, number>();
    (subs ?? []).forEach((s) => {
      if (!s.website_id) return;
      map.set(s.website_id, (map.get(s.website_id) ?? 0) + 1);
    });
    return map;
  }, [subs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return websites ?? [];
    return (websites ?? []).filter((w) => w.domain.toLowerCase().includes(q) || w.name?.toLowerCase().includes(q));
  }, [websites, search]);

  const stats = useMemo(() => {
    const total = websites?.length ?? 0;
    const linked = (websites ?? []).filter((w) => (w.payments_provider_url ?? "").length > 0).length;
    const onDefault = (websites ?? []).filter((w) => (w.payments_provider_url ?? "") === DEFAULT_PROVIDER).length;
    return { total, linked, onDefault };
  }, [websites]);

  const save = async (id: string) => {
    const value = (pending[id] ?? "").trim() || DEFAULT_PROVIDER;
    setSavingId(id);
    const { error } = await (supabase as any).from("websites").update({ payments_provider_url: value }).eq("id", id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    setPending((p) => { const n = { ...p }; delete n[id]; return n; });
    qc.invalidateQueries({ queryKey: ["payment-providers", "websites"] });
  };

  const applyDefaultToAll = async () => {
    if (!confirm(`ربط جميع (${websites?.length ?? 0}) المواقع بـ ${DEFAULT_PROVIDER}؟`)) return;
    const { error } = await (supabase as any).from("websites").update({ payments_provider_url: DEFAULT_PROVIDER }).not("id", "is", null);
    if (error) return toast.error(error.message);
    toast.success("تم الربط الشامل");
    qc.invalidateQueries({ queryKey: ["payment-providers", "websites"] });
  };

  const ping = async (id: string, url: string) => {
    setPingState((s) => ({ ...s, [id]: "loading" }));
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      await fetch(url, { method: "HEAD", mode: "no-cors", signal: ac.signal });
      clearTimeout(t);
      setPingState((s) => ({ ...s, [id]: "ok" }));
    } catch {
      setPingState((s) => ({ ...s, [id]: "fail" }));
    }
  };

  const copyWebhook = (siteId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/public/notifications/ingest?site_id=${siteId}`;
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط Webhook");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" /> مزودو الدفع
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة مزود الدفع لكل موقع وحالة الاتصال وإعدادات Webhook — المزود الافتراضي:{" "}
            <a href={DEFAULT_PROVIDER} target="_blank" rel="noreferrer" className="text-primary underline">
              hnpay-ai.lovable.app
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={DEFAULT_PROVIDER} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 ml-1" /> فتح hnpay-ai
            </a>
          </Button>
          <Button onClick={applyDefaultToAll} className="bg-primary">
            <RefreshCw className="w-4 h-4 ml-1" /> ربط الجميع بالمزود الافتراضي
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "إجمالي المواقع", value: stats.total },
          { label: "مرتبطة بمزود", value: stats.linked },
          { label: "على المزود الافتراضي", value: stats.onDefault },
        ].map((s) => (
          <Card key={s.label} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-3xl font-bold mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-4">
          <Input
            placeholder="بحث بالدومين أو الاسم…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary/40 max-w-md"
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((w) => {
            const current = w.payments_provider_url ?? "";
            const draft = pending[w.id] ?? current;
            const isDefault = current === DEFAULT_PROVIDER;
            const activeSubs = subsByWebsite.get(w.id) ?? 0;
            const ps = pingState[w.id] ?? "idle";
            return (
              <Card key={w.id} className="ring-1 ring-border bg-card/60">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <span dir="ltr" className="font-mono text-sm">{w.domain}</span>
                        {isDefault && <Badge className="bg-success/20 text-success border-success/40">hnpay-ai</Badge>}
                        {!w.is_active && <Badge variant="outline">موقوف</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{w.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">اشتراكات نشطة: {activeSubs}</Badge>
                      {ps === "ok" && <Badge className="bg-success/20 text-success border-success/40"><CheckCircle2 className="w-3 h-3 ml-1" /> متصل</Badge>}
                      {ps === "fail" && <Badge variant="destructive"><XCircle className="w-3 h-3 ml-1" /> فشل</Badge>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">رابط مزود الدفع</Label>
                      <Input
                        dir="ltr"
                        className="mt-1 bg-secondary/40 font-mono text-xs"
                        value={draft}
                        placeholder={DEFAULT_PROVIDER}
                        onChange={(e) => setPending((p) => ({ ...p, [w.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => ping(w.id, draft || DEFAULT_PROVIDER)}
                      disabled={ps === "loading"}
                    >
                      {ps === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span className="mr-1">اختبار</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPending((p) => ({ ...p, [w.id]: DEFAULT_PROVIDER }))}
                    >
                      افتراضي
                    </Button>
                    <Button
                      className="bg-primary"
                      onClick={() => save(w.id)}
                      disabled={savingId === w.id || draft === current}
                    >
                      {savingId === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span className="mr-1">حفظ</span>
                    </Button>
                  </div>

                  <div className="rounded-md border border-border/40 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-xs">
                        <div className="text-muted-foreground mb-1">Webhook للاستقبال من مزود الدفع</div>
                        <code dir="ltr" className="font-mono text-[11px] break-all">
                          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/notifications/ingest?site_id={w.id}
                        </code>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copyWebhook(w.id)}>
                        <Copy className="w-3 h-3 ml-1" /> نسخ
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!filtered.length && <div className="p-12 text-center text-muted-foreground">لا نتائج</div>}
        </div>
      )}
    </div>
  );
}