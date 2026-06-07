import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/deployments")({
  component: DeploymentsPage,
  head: () => ({ meta: [{ title: "النشر — TVCC" }] }),
});

function DeploymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["deployment_jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deployment_jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const badge = (s: string) => {
    const map: Record<string, string> = {
      queued: "bg-muted text-muted-foreground",
      running: "bg-primary/20 text-primary",
      success: "bg-success/20 text-success",
      failed: "bg-destructive/20 text-destructive",
    };
    return <Badge className={map[s] || ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div dir="rtl">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Rocket className="w-7 h-7 text-primary" /> مركز النشر
        </h1>
        <p className="text-muted-foreground mt-1">كل تطبيق جماعي يصبح مهمة قابلة للتتبع</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
      ) : !data?.length ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground" dir="rtl">
          <Rocket className="w-12 h-12 mx-auto mb-3 opacity-40" />
          لا توجد مهام بعد. أنشئ مهمة من صفحة القوالب بالضغط على "تطبيق".
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((j: any) => (
            <Card key={j.id}>
              <CardContent className="p-4 flex items-center justify-between" dir="rtl">
                <div>
                  <div className="font-bold">{j.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {j.scope_type} · {j.target_count} موقع · {new Date(j.created_at).toLocaleString("ar")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    نجاح: {j.success_count} / فشل: {j.error_count}
                  </div>
                  {badge(j.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
