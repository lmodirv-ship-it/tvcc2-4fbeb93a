import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, RefreshCw } from "lucide-react";
import { runHubExport, listHubExports } from "@/lib/exchange.functions";

const TONE: Record<string, string> = {
  success: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  pending: "bg-muted text-muted-foreground",
};

/** تصدير لائحة كل المواقع إلى مراكز المجموعة (cour.hnapps.store و srv.hn-groupe.org). */
export function ExchangePanel() {
  const qc = useQueryClient();
  const runExport = useServerFn(runHubExport);
  const listExports = useServerFn(listHubExports);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["hub-exports"],
    queryFn: () => listExports({ data: {} as never }),
    refetchInterval: 60000,
  });

  const start = useMutation({
    mutationFn: () => runExport({ data: {} as never }),
    onSuccess: (r: any) => {
      const ok = (r?.results ?? []).filter((x: any) => x.ok).length;
      toast.success(`تم تصدير ${r?.sites ?? 0} موقعاً إلى ${ok} مركز`);
      qc.invalidateQueries({ queryKey: ["hub-exports"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذّر التصدير"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">تصدير لائحة المواقع إلى مراكز المجموعة</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => qc.invalidateQueries({ queryKey: ["hub-exports"] })}
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> تحديث
            </button>
            <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? "جارٍ التصدير…" : "تصدير الآن"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-6">
          يتم التصدير تلقائياً كل يوم إلى <span dir="ltr">cour.hnapps.store</span> و
          <span dir="ltr"> srv.hn-groupe.org</span>، ثم تُزامَن الخدمات وتُعرَض هنا. أي موقع يطلب خدمة يُحوَّل
          طلبه إلى مركز المهام، ويحدّد HN SRV الموقع المسؤول، وتعود النتيجة عبر TVCC إلى الموقع الطالب.
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {(rows as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد عمليات تصدير بعد.</p>
          )}
          {(rows as any[]).map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-2 text-xs flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{r.hub_key}</div>
                <div dir="ltr" className="truncate text-muted-foreground">{r.hub_url}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">{r.sites_count} موقع</span>
                <Badge className={TONE[String(r.status)] || "bg-secondary"}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
