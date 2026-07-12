import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { pingVideoStudio, requestVideo } from "@/lib/video-studio.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Video, Radio, Loader2, Send, ExternalLink, Copy, RefreshCw, Film, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/video-studio")({
  component: VideoStudioPage,
  head: () => ({ meta: [{ title: "استوديو الفيديو — TVCC" }] }),
});

const STUDIO_URL = "https://site-to-vid-magic.lovable.app";

function VideoStudioPage() {
  const qc = useQueryClient();
  const ping = useServerFn(pingVideoStudio);
  const req = useServerFn(requestVideo);
  const [pinging, setPinging] = useState(false);
  const [sending, setSending] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: string; ms: number } | null>(null);
  const [form, setForm] = useState({ target_site: "", prompt: "" });

  const { data: rows } = useQuery({
    queryKey: ["video-requests"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("video_requests")
        .select("*").order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as any[];
    },
    refetchInterval: 8000,
  });

  const webhook = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/video/ingest`;

  const doPing = async () => {
    setPinging(true);
    try { const r = await ping(); setPingResult({ status: r.status, ms: r.ms }); toast.success(`الاستوديو ${r.status} (${r.ms}ms)`); }
    catch (e: any) { toast.error(e?.message ?? "فشل الاتصال"); }
    setPinging(false);
  };

  const submit = async () => {
    if (!form.prompt.trim()) return toast.error("اكتب وصف الشرح المطلوب");
    setSending(true);
    try {
      const r = await req({ data: { target_site: form.target_site.trim() || undefined, prompt: form.prompt.trim(), channel: "hn-nawat" } });
      toast[r.delivered ? "success" : "warning"](r.delivered ? "تم إرسال الطلب إلى الاستوديو" : "تم حفظ الطلب — لكن تعذّر التسليم الفوري");
      setForm({ target_site: "", prompt: "" });
      qc.invalidateQueries({ queryKey: ["video-requests"] });
    } catch (e: any) { toast.error(e?.message ?? "فشل الإرسال"); }
    setSending(false);
  };

  const stats = {
    total: rows?.length ?? 0,
    ready: rows?.filter((r) => r.status === "ready").length ?? 0,
    processing: rows?.filter((r) => r.status === "processing" || r.status === "pending").length ?? 0,
    failed: rows?.filter((r) => r.status === "failed").length ?? 0,
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Film className="w-7 h-7 text-primary" /> استوديو الفيديو
          </h1>
          <p className="text-muted-foreground mt-1">
            بوابة الشروحات المرئية — يرسل الطلبات إلى <code className="text-primary font-mono" dir="ltr">site-to-vid-magic.lovable.app</code> ويستقبل النتائج تلقائيًا في قناة <code className="text-primary font-mono" dir="ltr">hn-nawat</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={doPing} disabled={pinging}>
            {pinging ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <RefreshCw className="w-4 h-4 ml-1" />}
            فحص الاستوديو
          </Button>
          <a href={STUDIO_URL} target="_blank" rel="noreferrer">
            <Button variant="outline"><ExternalLink className="w-4 h-4 ml-1" /> فتح الاستوديو</Button>
          </a>
        </div>
      </div>

      <Card className="ring-1 ring-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Radio className={`w-7 h-7 ${pingResult?.status === "online" ? "text-success animate-pulse" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="text-xs text-muted-foreground">الاستوديو المرتبط</div>
            <a href={STUDIO_URL} target="_blank" rel="noreferrer" className="text-lg font-bold font-mono text-primary hover:underline" dir="ltr">{STUDIO_URL}</a>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={pingResult?.status === "online" ? "bg-success/20 text-success border-success/40" : "bg-secondary"}>
                {pingResult?.status ?? "غير مفحوص"}
              </Badge>
              {pingResult && <span className="text-[10px] text-muted-foreground">{pingResult.ms}ms</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Webhook:</span>
            <code dir="ltr" className="font-mono text-primary bg-secondary/40 rounded px-2 py-1">{webhook}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(webhook); toast.success("نُسخ"); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "الطلبات", v: stats.total },
          { l: "جاهزة", v: stats.ready, c: "text-success" },
          { l: "قيد المعالجة", v: stats.processing, c: "text-primary" },
          { l: "فاشلة", v: stats.failed, c: "text-destructive" },
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
        <Card className="ring-1 ring-primary/40 bg-card/60 h-fit">
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> اطلب شرحًا فيديو
            </div>
            <div>
              <Label>رابط الموقع (اختياري)</Label>
              <Input dir="ltr" className="mt-1 bg-secondary/40 font-mono" value={form.target_site}
                onChange={(e) => setForm({ ...form, target_site: e.target.value })} placeholder="https://example.com" />
            </div>
            <div>
              <Label>وصف الشرح *</Label>
              <Textarea rows={5} className="mt-1 bg-secondary/40" value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="مثال: شرح مبسّط لخطوات التسجيل في الموقع مع صوت عربي…" />
            </div>
            <Button onClick={submit} disabled={sending} className="w-full bg-primary">
              {sending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Send className="w-4 h-4 ml-1" />}
              إرسال إلى الاستوديو
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              يُرسل الطلب عبر tvcc، ويعود الفيديو تلقائيًا إلى قناة hn-nawat.
            </p>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-border bg-card/60">
          <CardContent className="p-5">
            <div className="text-sm font-semibold mb-3">آخر الطلبات</div>
            {!rows?.length ? (
              <div className="text-xs text-muted-foreground text-center p-8">لا توجد طلبات بعد</div>
            ) : (
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.id} className="rounded-md border border-border/40 p-3 bg-secondary/20">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={
                            r.status === "ready" ? "bg-success/20 text-success border-success/40" :
                            r.status === "processing" ? "bg-primary/20 text-primary border-primary/40" :
                            r.status === "failed" ? "bg-destructive/20 text-destructive border-destructive/40" :
                            "bg-secondary"
                          }>{r.status}</Badge>
                          {r.target_site && <span className="text-xs font-mono text-primary truncate max-w-[300px]" dir="ltr">{r.target_site}</span>}
                          <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</span>
                        </div>
                        <div className="text-xs mt-1 line-clamp-2">{r.prompt}</div>
                        {r.error_message && <div className="text-[10px] text-destructive mt-1">{r.error_message}</div>}
                      </div>
                      {r.video_url && (
                        <a href={r.video_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline"><PlayCircle className="w-3 h-3 ml-1" /> تشغيل</Button>
                        </a>
                      )}
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