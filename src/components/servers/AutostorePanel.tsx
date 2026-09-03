import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HardDriveDownload, RefreshCw } from "lucide-react";
import { runAutostore, getAutostoreStatus } from "@/lib/autostore.functions";

const STATUS_TONE: Record<string, string> = {
  done: "bg-emerald-500/15 text-emerald-400",
  success: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
  error: "bg-destructive/15 text-destructive",
  pending: "bg-amber-500/15 text-amber-400",
};

/** التخزين التلقائي للمواقع على هذا السيرفر + مزامنة كل مهام الوكيل. */
export function AutostorePanel({ serverId }: { serverId: string }) {
  const qc = useQueryClient();
  const run = useServerFn(runAutostore);
  const status = useServerFn(getAutostoreStatus);
  const [storagePath, setStoragePath] = useState("/srv/tvcc-storage/sites");
  const [targetHost, setTargetHost] = useState("");

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["autostore", serverId],
    queryFn: () => status({ data: { serverId } }),
    refetchInterval: 15000,
  });

  const start = useMutation({
    mutationFn: () =>
      run({ data: { serverId, storagePath: storagePath || undefined, targetHost: targetHost || undefined } }),
    onSuccess: (r: any) => {
      toast.success(`تم جدولة ${r.queued} مهمة تخزين تلقائي (${r.domains.length} موقع)`);
      qc.invalidateQueries({ queryKey: ["autostore", serverId] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذّر تشغيل التخزين التلقائي"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">التخزين التلقائي للمواقع</h3>
          </div>
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? "جارٍ الإرسال…" : "تشغيل التخزين التلقائي الآن"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">مسار التخزين</Label>
            <Input value={storagePath} onChange={(e) => setStoragePath(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">خادم الوجهة (اختياري)</Label>
            <Input
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              placeholder="root@192.168.100.66"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>آخر مهام التخزين والمزامنة</span>
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => qc.invalidateQueries({ queryKey: ["autostore", serverId] })}
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(rows as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد مهام تخزين بعد.</p>
          )}
          {(rows as any[]).map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-2 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {r.action}
                  {r.args?.domain ? ` · ${r.args.domain}` : ""}
                </span>
                <Badge className={STATUS_TONE[String(r.status)] || "bg-secondary"}>{r.status}</Badge>
              </div>
              {(r.output || r.error_message) && (
                <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                  {String(r.output || r.error_message).slice(0, 600)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
