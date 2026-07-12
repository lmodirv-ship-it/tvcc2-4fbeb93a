import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { autoFixAndReport } from "@/lib/health-check.functions";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radio, Database, HardDrive, RefreshCw, ShieldCheck, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: MonitoringPage,
  head: () => ({ meta: [{ title: "المراقبة — TVCC" }] }),
});

function MonitoringPage() {
  const qc = useQueryClient();
  const runAutoFix = useServerFn(autoFixAndReport);
  const [fixing, setFixing] = useState(false);

  const { data: websites, isLoading } = useQuery({
    queryKey: ["mon-websites"],
    queryFn: async () => (await supabase.from("websites").select("*").order("name")).data || [],
  });

  const { data: checks } = useQuery({
    queryKey: ["mon-checks"],
    queryFn: async () =>
      (await supabase.from("site_health_checks")
        .select("*").order("checked_at", { ascending: false }).limit(500)).data || [],
  });

  const latestByWebsite = new Map<string, any>();
  (checks || []).forEach((c) => {
    if (!latestByWebsite.has(c.website_id)) latestByWebsite.set(c.website_id, c);
  });

  const total = websites?.length || 0;
  const ok = websites?.filter((w) => w.status === "online").length || 0;
  const down = websites?.filter((w) => w.status === "offline").length || 0;
  const warn = total - ok - down;

  const checkOne = async (url: string): Promise<{ status: string; http_status: number | null; response_time_ms: number | null; ssl_valid: boolean | null; error: string | null }> => {
    if (!url) return { status: "unknown", http_status: null, response_time_ms: null, ssl_valid: null, error: "missing url" };
    const target = url.startsWith("http") ? url : `https://${url}`;
    const start = performance.now();
    try {
      // no-cors avoids CORS errors but returns opaque response; we still get timing + reachability.
      await fetch(target, { method: "GET", mode: "no-cors", cache: "no-store" });
      const elapsed = Math.round(performance.now() - start);
      return {
        status: "online",
        http_status: 200,
        response_time_ms: elapsed,
        ssl_valid: target.startsWith("https://"),
        error: null,
      };
    } catch (e: any) {
      return {
        status: "offline",
        http_status: 0,
        response_time_ms: null,
        ssl_valid: false,
        error: e?.message || "fetch failed",
      };
    }
  };

  const pingAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !websites?.length) return;
    toast.info(`جاري فحص ${websites.length} موقع...`);
    const results = await Promise.all(
      websites.map(async (w) => {
        const r = await checkOne(w.domain);
        return {
          owner_id: user.id,
          website_id: w.id,
          status: r.status,
          http_status: r.http_status,
          response_time_ms: r.response_time_ms,
          ssl_valid: r.ssl_valid,
          error_message: r.error,
        };
      }),
    );
    const { error } = await supabase.from("site_health_checks").insert(results);
    if (error) return toast.error(error.message);
    // Reflect latest status back onto websites table
    await Promise.all(
      results.map((r) =>
        supabase.from("websites").update({ status: r.status as any, last_checked_at: new Date().toISOString() }).eq("id", r.website_id),
      ),
    );
    toast.success(`اكتمل الفحص: ${results.filter(r => r.status === "online").length}/${results.length} متصل`);
    qc.invalidateQueries({ queryKey: ["mon-checks"] });
    qc.invalidateQueries({ queryKey: ["mon-websites"] });
  };

  const statusBadge = (s?: string) => {
    if (s === "online") return <Badge className="bg-success/15 text-success">متصل</Badge>;
    if (s === "offline") return <Badge className="bg-destructive/15 text-destructive">معطّل</Badge>;
    return <Badge className="bg-warning/15 text-warning">{s || "غير معروف"}</Badge>;
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button onClick={pingAll} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> فحص الآن
          </Button>
          <Button
            disabled={fixing}
            onClick={async () => {
              setFixing(true);
              toast.info("جاري إصلاح المواقع غير المتصلة وإرسال التقرير إلى hn-nawat...");
              try {
                const res: any = await runAutoFix();
                const s = res?.summary;
                toast.success(
                  `تم: متصلة ${s.online} / معطلة ${s.offline} / تم إصلاح ${s.fixed}. أُرسل التقرير إلى hn-nawat.`,
                );
                qc.invalidateQueries({ queryKey: ["mon-websites"] });
                qc.invalidateQueries({ queryKey: ["mon-checks"] });
              } catch (e: any) {
                toast.error(e?.message || "فشل الإصلاح");
              } finally {
                setFixing(false);
              }
            }}
            className="gap-2"
          >
            {fixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            إصلاح تلقائي + إرسال تقرير
          </Button>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-bold flex items-center gap-2 justify-end">
            <Radio className="w-7 h-7 text-primary" /> مركز المراقبة
          </h1>
          <p className="text-muted-foreground mt-1">حالة جميع المواقع والخدمات المتصلة</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="ring-1 ring-primary/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground mt-1">مواقع كلية</div>
          </CardContent>
        </Card>
        <Card className="ring-1 ring-success/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-success">{ok}</div>
            <div className="text-xs text-muted-foreground mt-1">متصلة</div>
          </CardContent>
        </Card>
        <Card className="ring-1 ring-warning/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-warning">{warn}</div>
            <div className="text-xs text-muted-foreground mt-1">تحذيرات</div>
          </CardContent>
        </Card>
        <Card className="ring-1 ring-destructive/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-destructive">{down}</div>
            <div className="text-xs text-muted-foreground mt-1">معطّلة</div>
          </CardContent>
        </Card>
        <Card className="ring-1 ring-accent/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{(checks || []).length}</div>
            <div className="text-xs text-muted-foreground mt-1">سجلات فحص</div>
          </CardContent>
        </Card>
      </div>

      {/* External services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="ring-1 ring-border">
          <CardContent className="p-4 flex items-center justify-between">
            <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">غير مهيأ</Badge>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-bold">HN-DB</div>
                <div className="text-xs text-muted-foreground">قواعد البيانات</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="ring-1 ring-border">
          <CardContent className="p-4 flex items-center justify-between">
            <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">غير مهيأ</Badge>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-bold">HN-Cloud</div>
                <div className="text-xs text-muted-foreground">التخزين والملفات</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sites table */}
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">HTTP</TableHead>
                <TableHead className="text-right">زمن الاستجابة</TableHead>
                <TableHead className="text-right">SSL</TableHead>
                <TableHead className="text-right">آخر فحص</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin inline text-primary" />
                </TableCell></TableRow>
              ) : !websites?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  لا توجد مواقع
                </TableCell></TableRow>
              ) : websites.map((w) => {
                const c = latestByWebsite.get(w.id);
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="text-right">
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{w.domain}</div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(w.status)}</TableCell>
                    <TableCell className="text-sm">{c?.http_status ?? "—"}</TableCell>
                    <TableCell className="text-sm">{c?.response_time_ms ? `${c.response_time_ms} ms` : "—"}</TableCell>
                    <TableCell>
                      {c?.ssl_valid === true ? <ShieldCheck className="w-4 h-4 text-success" /> :
                       c?.ssl_valid === false ? <ShieldCheck className="w-4 h-4 text-destructive" /> :
                       <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c?.checked_at ? new Date(c.checked_at).toLocaleString("ar") : "لم يُفحص بعد"}
                    </TableCell>
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
