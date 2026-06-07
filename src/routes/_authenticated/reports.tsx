import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart, Globe, Server, ShieldCheck, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const [websites, domains, ssl, notifications, recovery] = await Promise.all([
        supabase.from("websites").select("id", { count: "exact", head: true }),
        supabase.from("domains").select("id", { count: "exact", head: true }),
        supabase.from("ssl_certificates" as any).select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }),
        supabase.from("recovery_points").select("id", { count: "exact", head: true }),
      ]);
      return {
        websites: websites.count ?? 0,
        domains: domains.count ?? 0,
        ssl: ssl.count ?? 0,
        notifications: notifications.count ?? 0,
        recovery: recovery.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "المواقع", value: data?.websites ?? 0, icon: Globe },
    { label: "النطاقات", value: data?.domains ?? 0, icon: Server },
    { label: "شهادات SSL", value: data?.ssl ?? 0, icon: ShieldCheck },
    { label: "الإشعارات", value: data?.notifications ?? 0, icon: Bell },
    { label: "نقاط الاسترداد", value: data?.recovery ?? 0, icon: FileBarChart },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <FileBarChart className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-sm text-muted-foreground">ملخص شامل لحالة النظام</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <c.icon className="w-4 h-4" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
