import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight, RotateCcw, RefreshCw } from "lucide-react";
import { listServiceRequests, retryServiceRequest } from "@/lib/exchange.functions";

const TONE: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  routing: "bg-primary/15 text-primary",
  assigned: "bg-amber-500/15 text-amber-400",
  running: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
};
const LABEL: Record<string, string> = {
  received: "مستلَم",
  routing: "قيد التوجيه",
  assigned: "مُسنَد",
  running: "قيد التنفيذ",
  completed: "منجز",
  failed: "فاشل",
};

/** طلبات الخدمات المتبادلة بين مواقع المجموعة داخل مركز المهام. */
export function ServiceRequestsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listServiceRequests);
  const retry = useServerFn(retryServiceRequest);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => list({ data: {} as never }),
    refetchInterval: 10000,
  });

  const again = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: (r: any) =>
      r?.ok
        ? (toast.success(`أُرسل الطلب إلى ${r.provider}`), qc.invalidateQueries({ queryKey: ["service-requests"] }))
        : toast.error("لم يُعثر على موقع مسؤول عن الخدمة"),
    onError: (e: any) => toast.error(e?.message || "تعذّرت إعادة التوجيه"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">طلبات الخدمات المتبادلة</h3>
          </div>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => qc.invalidateQueries({ queryKey: ["service-requests"] })}
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الموقع الطالب</TableHead>
              <TableHead>الخدمة</TableHead>
              <TableHead>الموقع المنفّذ</TableHead>
              <TableHead>التوجيه</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows as any[]).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  لا توجد طلبات خدمات بعد.
                </TableCell>
              </TableRow>
            )}
            {(rows as any[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell dir="ltr" className="text-xs">{r.requester_domain || "—"}</TableCell>
                <TableCell className="text-xs">{r.service_key}{r.service_type ? ` · ${r.service_type}` : ""}</TableCell>
                <TableCell dir="ltr" className="text-xs">{r.provider_domain || "—"}</TableCell>
                <TableCell className="text-xs">{r.routed_by || "—"}</TableCell>
                <TableCell>
                  <Badge className={TONE[String(r.status)] || "bg-secondary"}>{LABEL[String(r.status)] || r.status}</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => again.mutate(r.id)} disabled={again.isPending}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
