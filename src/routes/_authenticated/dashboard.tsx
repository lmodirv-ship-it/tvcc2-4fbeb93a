import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Users, CreditCard, Database, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "لوحة التحكم — TVCC" }] }),
});

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [w, c, s, d] = await Promise.all([
        supabase.from("websites").select("id,name,domain,status", { count: "exact" }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id,price", { count: "exact" }),
        supabase.from("databases").select("id", { count: "exact", head: true }),
      ]);
      return {
        websites: w.count || 0,
        clients: c.count || 0,
        subscriptions: s.count || 0,
        databases: d.count || 0,
        recentWebsites: w.data?.slice(0, 5) || [],
        totalRevenue: s.data?.reduce((sum, x) => sum + Number(x.price || 0), 0) || 0,
      };
    },
  });

  const { data: activity } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const cards = [
    { label: "إجمالي المواقع", value: stats?.websites ?? 0, sub: "جميع المواقع", icon: Globe, color: "primary" },
    { label: "العملاء", value: stats?.clients ?? 0, sub: "إجمالي العملاء", icon: Users, color: "success" },
    { label: "الاشتراكات", value: stats?.subscriptions ?? 0, sub: "اشتراك نشط", icon: CreditCard, color: "warning" },
    { label: "قواعد البيانات", value: stats?.databases ?? 0, sub: "قاعدة مرتبطة", icon: Database, color: "primary-glow" },
  ] as const;

  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    primary: { bg: "bg-primary/15", text: "text-primary", ring: "ring-primary/40" },
    success: { bg: "bg-success/15", text: "text-success", ring: "ring-success/40" },
    warning: { bg: "bg-warning/15", text: "text-warning", ring: "ring-warning/40" },
    "primary-glow": { bg: "bg-primary/10", text: "text-primary-glow", ring: "ring-primary/40" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على كل مواقعك ومواردك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const cc = colorMap[c.color];
          return (
            <Card key={c.label} className={`relative overflow-hidden ring-1 ${cc.ring}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs ${cc.text}`}>{c.label}</p>
                    <p className="text-3xl font-bold mt-2">{c.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{c.sub}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${cc.bg} flex items-center justify-center`}>
                    <c.icon className={`w-6 h-6 ${cc.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" /> آخر المواقع
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentWebsites?.length ? (
              <ul className="space-y-3">
                {stats.recentWebsites.map((w: any) => (
                  <li key={w.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.domain}</div>
                    </div>
                    <Badge variant={w.status === "online" ? "default" : "secondary"}>{w.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد مواقع بعد</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" /> آخر العمليات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity?.length ? (
              <ul className="space-y-3">
                {activity.map((a: any) => (
                  <li key={a.id} className="text-sm">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.entity_type} · {new Date(a.created_at).toLocaleString("ar")}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لا يوجد نشاط</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
