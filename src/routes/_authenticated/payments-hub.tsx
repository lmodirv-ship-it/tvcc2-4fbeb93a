import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wallet, RefreshCw, ExternalLink, Send, Loader2, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";

const HNPAY = "https://hnpay-ai.lovable.app";

export const Route = createFileRoute("/_authenticated/payments-hub")({
  component: PaymentsHubPage,
  head: () => ({ meta: [{ title: "بوابة الدفع الموحدة — TVCC" }] }),
});

function PaymentsHubPage() {
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "fail" | "loading">("idle");

  const { data: events, isLoading } = useQuery({
    queryKey: ["payment-events"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payment_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 8000,
  });

  const stats = {
    total: events?.length ?? 0,
    delivered: (events ?? []).reduce((s, e) => s + (e.fanout_delivered ?? 0), 0),
    failed: (events ?? []).reduce((s, e) => s + (e.fanout_failed ?? 0), 0),
    revenue: (events ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0),
  };

  const ping = async () => {
    setStatus("loading");
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      await fetch(HNPAY, { method: "HEAD", mode: "no-cors", signal: ac.signal });
      clearTimeout(t);
      setStatus("ok");
    } catch { setStatus("fail"); }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${origin}/api/public/payments/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_type: "subscription.activated",
          provider: "hnpay-ai",
          external_id: `test_${Date.now()}`,
          amount: 29,
          currency: "USD",
          subscription: { plan_name: "Pro", status: "active" },
          metadata: { test: true, source: "payments-hub-ui" },
        }),
      });
      const j = await res.json();
      if (j.ok) toast.success(`تم النشر: ${j.fanout?.delivered}/${j.fanout?.total}`);
      else toast.error(j.error || "فشل");
      qc.invalidateQueries({ queryKey: ["payment-events"] });
    } catch (e: any) {
      toast.error(e?.message ?? "فشل");
    } finally { setTesting(false); }
  };

  const copyIngest = () => {
    const url = `${window.location.origin}/api/public/payments/ingest`;
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط الاستقبال");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" /> بوابة الدفع الموحدة
          </h1>
          <p className="text-muted-foreground mt-1">
            استقبال الأحداث الفورية من{" "}
            <a href={HNPAY} target="_blank" rel="noreferrer" className="text-primary underline">hnpay-ai.lovable.app</a>{" "}
            ونشرها لحظياً على جميع مواقع مجموعة HN.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <a href={HNPAY} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 ml-1" /> فتح hnpay-ai</a>
          </Button>
          <Button variant="outline" onClick={ping} disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="mr-1">اختبار الاتصال</span>
            {status === "ok" && <CheckCircle2 className="w-3 h-3 mr-2 text-success" />}
            {status === "fail" && <XCircle className="w-3 h-3 mr-2 text-destructive" />}
          </Button>
          <Button onClick={runTest} disabled={testing} className="bg-primary">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="mr-1">بث حدث تجريبي</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "أحداث مستلمة", v: stats.total },
          { l: "نشر ناجح", v: stats.delivered, color: "text-success" },
          { l: "نشر فاشل", v: stats.failed, color: "text-destructive" },
          { l: "إجمالي الإيرادات", v: `${stats.revenue.toFixed(2)} USD` },
        ].map((s) => (
          <Card key={s.l} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className={`text-2xl font-bold mt-1 ${s.color ?? ""}`}>{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-5 space-y-3">
          <div className="text-sm font-semibold">Webhook الاستقبال من hnpay-ai</div>
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              readOnly
              dir="ltr"
              className="font-mono text-xs bg-secondary/40"
              value={typeof window !== "undefined" ? `${window.location.origin}/api/public/payments/ingest` : ""}
            />
            <Button variant="outline" onClick={copyIngest}><Copy className="w-4 h-4 ml-1" /> نسخ</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            POST JSON. الحقول المدعومة: <code dir="ltr">event_type, external_id, amount, currency, site_domain | website_id, subscription:{"{plan_name,status,starts_at,ends_at}"}</code>
          </p>
        </CardContent>
      </Card>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">آخر الأحداث المستلمة</div>
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-primary" /></div>
          ) : !events?.length ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد أحداث بعد — جرّب بث حدث تجريبي</div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between border border-border/40 rounded-md p-3 bg-secondary/20 flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className="bg-primary/15 text-primary border-primary/30">{e.event_type}</Badge>
                    <span className="text-xs text-muted-foreground">{e.provider}</span>
                    {e.amount != null && <span className="text-sm font-semibold">{e.amount} {e.currency}</span>}
                    {e.external_id && <code dir="ltr" className="text-[11px] text-muted-foreground">{e.external_id}</code>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{e.fanout_delivered}/{e.fanout_total} نشر</Badge>
                    {e.fanout_failed > 0 && <Badge variant="destructive">{e.fanout_failed} فشل</Badge>}
                    <span className="text-[11px] text-muted-foreground">{new Date(e.received_at).toLocaleString("ar")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}