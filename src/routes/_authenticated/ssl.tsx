import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ssl")({
  component: SSLPage,
  head: () => ({ meta: [{ title: "مراقبة SSL — TVCC" }] }),
});

type SSLCert = {
  id: string;
  domain: string;
  issuer: string | null;
  valid_to: string | null;
  status: string;
  auto_renew: boolean;
  last_checked_at: string | null;
  website_id: string | null;
};

function SSLPage() {
  const qc = useQueryClient();

  const { data: certs, isLoading } = useQuery({
    queryKey: ["ssl-certificates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ssl_certificates")
        .select("*")
        .order("valid_to", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as SSLCert[];
    },
  });

  const { data: domains } = useQuery({
    queryKey: ["ssl-domains-fallback"],
    queryFn: async () =>
      (await supabase.from("domains").select("id, domain, ssl_status, ssl_expires_at, website_id")).data ?? [],
  });

  const syncFromDomains = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !domains?.length) return toast.info("لا توجد دومينات للمزامنة");
    const rows = domains
      .filter((d) => d.ssl_expires_at || d.ssl_status)
      .map((d) => ({
        owner_id: user.id,
        domain: d.domain,
        domain_id: d.id,
        website_id: d.website_id,
        valid_to: d.ssl_expires_at,
        status: d.ssl_status || "unknown",
        days_until_expiry: d.ssl_expires_at
          ? Math.ceil((new Date(d.ssl_expires_at).getTime() - Date.now()) / 86400000)
          : null,
        last_checked_at: new Date().toISOString(),
      }));
    if (!rows.length) return toast.info("لا توجد بيانات SSL للدومينات");
    const { error } = await supabase.from("ssl_certificates").upsert(rows, { onConflict: "domain" });
    if (error) return toast.error(error.message);
    toast.success(`تمت مزامنة ${rows.length} شهادة`);
    qc.invalidateQueries({ queryKey: ["ssl-certificates"] });
  };

  const days = (d: string | null) =>
    d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

  const list = certs ?? [];
  const stats = list.reduce(
    (a, c) => {
      const dl = days(c.valid_to);
      if (dl === null) a.unknown++;
      else if (dl < 0) a.expired++;
      else if (dl < 15) a.critical++;
      else if (dl < 30) a.warn++;
      else a.ok++;
      return a;
    },
    { ok: 0, warn: 0, critical: 0, expired: 0, unknown: 0 },
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Button onClick={syncFromDomains} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> مزامنة من النطاقات
        </Button>
        <div className="text-right">
          <h1 className="text-3xl font-bold flex items-center gap-2 justify-end">
            <ShieldCheck className="w-7 h-7 text-primary" /> مراقبة شهادات SSL
          </h1>
          <p className="text-muted-foreground mt-1">تتبع تواريخ انتهاء جميع شهادات SSL لمواقعك</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={CheckCircle2} color="success" label="سليمة" value={stats.ok} hint="> 30 يوم" />
        <StatCard icon={AlertTriangle} color="warning" label="تنبيه" value={stats.warn} hint="15–30 يوم" />
        <StatCard icon={AlertTriangle} color="destructive" label="عاجل" value={stats.critical} hint="< 15 يوم" />
        <StatCard icon={XCircle} color="destructive" label="منتهية" value={stats.expired} hint="" />
        <StatCard icon={ShieldCheck} color="muted" label="غير محدد" value={stats.unknown} hint="" />
      </div>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : !list.length ? (
            <div className="p-12 text-center text-muted-foreground">
              لا توجد شهادات SSL مسجّلة بعد. اضغط "مزامنة من النطاقات" لاستيراد البيانات من مدير النطاقات.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الدومين</TableHead>
                  <TableHead className="text-right">المُصدِر</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">ينتهي في</TableHead>
                  <TableHead className="text-right">الأيام المتبقية</TableHead>
                  <TableHead className="text-right">تجديد تلقائي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => {
                  const dl = days(c.valid_to);
                  const variant =
                    dl === null ? "outline"
                    : dl < 0 ? "destructive"
                    : dl < 15 ? "destructive"
                    : dl < 30 ? "outline"
                    : "secondary";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{c.domain}</TableCell>
                      <TableCell className="text-xs">{c.issuer ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell className="text-xs" dir="ltr">
                        {c.valid_to ? new Date(c.valid_to).toLocaleDateString("ar") : "—"}
                      </TableCell>
                      <TableCell>
                        {dl === null ? "—" : (
                          <Badge variant={variant as any}>
                            {dl < 0 ? "منتهية" : `${dl} يوم`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.auto_renew ? (
                          <Badge className="bg-success/15 text-success">مفعّل</Badge>
                        ) : (
                          <Badge variant="outline">غير مفعّل</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, hint }: any) {
  const cls: any = {
    success: "ring-success/30 bg-success/5 text-success",
    warning: "ring-warning/30 bg-warning/5 text-warning",
    destructive: "ring-destructive/30 bg-destructive/5 text-destructive",
    muted: "ring-border bg-muted/30 text-muted-foreground",
  };
  return (
    <Card className={`ring-1 ${cls[color]}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="w-7 h-7" />
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
