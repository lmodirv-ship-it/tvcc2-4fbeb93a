import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ssl")({
  component: SSLPage,
  head: () => ({ meta: [{ title: "مراقبة SSL — TVCC" }] }),
});

function SSLPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ssl-domains"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("domains").select("*").order("ssl_expires_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const days = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
  const stats = (data || []).reduce((a: any, d: any) => {
    const dl = days(d.ssl_expires_at);
    if (dl === null) a.unknown++;
    else if (dl < 0) a.expired++;
    else if (dl < 15) a.critical++;
    else if (dl < 30) a.warn++;
    else a.ok++;
    return a;
  }, { ok: 0, warn: 0, critical: 0, expired: 0, unknown: 0 });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary" /> مراقبة شهادات SSL
        </h1>
        <p className="text-muted-foreground mt-1">تتبع تواريخ انتهاء جميع شهادات SSL لمواقعك</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={CheckCircle2} color="success" label="سليمة" value={stats.ok} hint="< 30 يوم" />
        <StatCard icon={AlertTriangle} color="warning" label="تنبيه" value={stats.warn} hint="15–30 يوم" />
        <StatCard icon={AlertTriangle} color="destructive" label="عاجل" value={stats.critical} hint="< 15 يوم" />
        <StatCard icon={XCircle} color="destructive" label="منتهية" value={stats.expired} hint="" />
        <StatCard icon={ShieldCheck} color="muted" label="غير محدد" value={stats.unknown} hint="" />
      </div>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-0">
          {isLoading ? <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          : !data?.length ? <div className="p-12 text-center text-muted-foreground">أضف دومينات في "مدير النطاقات" لرؤيتها هنا</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">الدومين</TableHead>
                <TableHead className="text-right">حالة SSL</TableHead>
                <TableHead className="text-right">ينتهي SSL</TableHead>
                <TableHead className="text-right">الأيام المتبقية</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((d) => {
                  const dl = days(d.ssl_expires_at);
                  const variant = dl === null ? "outline" : dl < 0 ? "destructive" : dl < 15 ? "destructive" : dl < 30 ? "outline" : "secondary";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{d.domain}</TableCell>
                      <TableCell><Badge variant="outline">{d.ssl_status}</Badge></TableCell>
                      <TableCell className="text-xs" dir="ltr">{d.ssl_expires_at ? new Date(d.ssl_expires_at).toLocaleDateString("ar") : "—"}</TableCell>
                      <TableCell>{dl === null ? "—" : <Badge variant={variant as any}>{dl < 0 ? "منتهية" : `${dl} يوم`}</Badge>}</TableCell>
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
