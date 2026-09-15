import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Loader2, Search, RefreshCw, Activity, FileDown, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { listSiteTransfers, createSiteTransferTask } from "@/lib/site-transfers.functions";

const fmtSize = (n: number) => {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(1)} ${u[i]}`;
};

const statusStyle = (s?: string | null) =>
  s === "success" || s === "online"
    ? "bg-success/20 text-success border-success/40"
    : s === "pending" || s === "running"
      ? "bg-muted text-muted-foreground border-border"
      : s
        ? "bg-destructive/20 text-destructive border-destructive/40"
        : "bg-muted text-muted-foreground border-border";

const ALL_KEY = "tvcc.siteTransfers.allActive";

export function SiteTransfersTable() {
  const qc = useQueryClient();
  const load = useServerFn(listSiteTransfers);
  const createTask = useServerFn(createSiteTransferTask);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [allActive, setAllActive] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(ALL_KEY) === "1") setAllActive(true);
  }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["site-transfers"],
    queryFn: () => load({ data: {} as any }),
    refetchInterval: 120_000,
  });

  const rows = ((data as any)?.rows ?? []) as any[];
  const filtered = useMemo(
    () => rows.filter((r) => !q || `${r.site_code} ${r.domain} ${r.name}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const run = async (websiteId: string, direction: "export" | "import") => {
    setBusy(`${websiteId}-${direction}`);
    try {
      await createTask({ data: { websiteId, direction } });
      toast.success(direction === "export" ? "تم إنشاء مهمة تصدير" : "تم إنشاء مهمة استيراد");
      qc.invalidateQueries({ queryKey: ["site-transfers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const activateAll = async () => {
    if (running) return;
    setAllActive(true);
    localStorage.setItem(ALL_KEY, "1");
    setRunning(true);
    const targets = filtered;
    setProgress({ done: 0, total: targets.length });
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < targets.length; i++) {
      try {
        await createTask({ data: { websiteId: targets[i].id, direction: "export" } });
        ok += 1;
      } catch {
        fail += 1;
      }
      setProgress({ done: i + 1, total: targets.length });
    }
    setRunning(false);
    setProgress(null);
    qc.invalidateQueries({ queryKey: ["site-transfers"] });
    toast.success(`تم تفعيل الكل — ${ok} مهمة${fail ? ` · ${fail} فشلت` : ""}`);
  };

  const deactivateAll = () => {
    setAllActive(false);
    localStorage.removeItem(ALL_KEY);
    toast.info("تم تعطيل وضع «تفعيل الكل» يدوياً");
  };

  const exportCsv = () => {
    const head = ["site_code", "domain", "name", "size_bytes", "uptime_7d", "checks_7d", "first", "current", "last_copy_at", "tasks"];
    const csv = [
      head.join(","),
      ...filtered.map((r) =>
        [r.site_code, r.domain, `"${String(r.name ?? "").replace(/"/g, '""')}"`, r.size_bytes, r.uptime_7d ?? "", r.checks_7d, r.first_status ?? "", r.current_status ?? "", r.last_copy_at ?? "", r.tasks_count].join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `site-transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3 flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-sm flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" /> جدول المواقع — التصدير والاستيراد والحجم والتفاعل
          <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالمعرف أو النطاق..." className="h-8 pr-8 text-xs w-52" />
          </div>
          <Button size="sm" variant="outline" className="h-8" onClick={() => refetch()}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv}>
            <FileDown className="w-3.5 h-3.5 ml-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">لا توجد مواقع مطابقة.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">المعرف</TableHead>
                <TableHead className="text-xs">الموقع</TableHead>
                <TableHead className="text-xs">الحجم</TableHead>
                <TableHead className="text-xs">التفاعل (7 أيام)</TableHead>
                <TableHead className="text-xs">النسخة الأولى</TableHead>
                <TableHead className="text-xs">النسخة الحالية</TableHead>
                <TableHead className="text-xs">آخر نسخة</TableHead>
                <TableHead className="text-xs">المهام</TableHead>
                <TableHead className="text-xs">تصدير / استيراد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-[11px] font-mono whitespace-nowrap">{r.site_code}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground ltr text-left">{r.domain}</div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap tabular-nums">{fmtSize(Number(r.size_bytes))}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Activity className="w-3 h-3 text-primary" />
                      {r.uptime_7d === null ? "—" : `${r.uptime_7d}%`}
                      <span className="text-muted-foreground">({r.checks_7d})</span>
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${statusStyle(r.first_status)}`}>{r.first_status ?? "لا توجد"}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${statusStyle(r.current_status)}`}>{r.current_status ?? "لا توجد"}</Badge></TableCell>
                  <TableCell className="text-[11px] whitespace-nowrap">{r.last_copy_at ? new Date(r.last_copy_at).toLocaleString("ar") : "—"}</TableCell>
                  <TableCell className="text-[11px] whitespace-nowrap">
                    {r.tasks_count}
                    {r.last_task && (
                      <Badge variant="outline" className={`ms-1 text-[10px] ${statusStyle(r.last_task.status)}`}>
                        {r.last_task.direction === "export" ? "تصدير" : "استيراد"} · {r.last_task.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        title={r.ready ? "جاهز للتشغيل التلقائي" : !r.has_agent ? "لا يوجد وكيل متصل على سيرفر الموقع" : !r.has_destination ? "لا توجد وجهة نسخ مفعّلة" : "الموقع غير مفعّل"}
                        className={`h-7 text-[11px] ${r.ready ? "border-success/50 bg-success/15 text-success hover:bg-success/25" : "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25"}`}
                        disabled={busy === `${r.id}-export`}
                        onClick={() => run(r.id, "export")}
                      >
                        {busy === `${r.id}-export` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 ml-1" />} تصدير
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title={r.ready ? "جاهز للتشغيل التلقائي" : !r.has_agent ? "لا يوجد وكيل متصل على سيرفر الموقع" : !r.has_destination ? "لا توجد وجهة نسخ مفعّلة" : "الموقع غير مفعّل"}
                        className={`h-7 text-[11px] ${r.ready ? "border-success/50 bg-success/15 text-success hover:bg-success/25" : "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25"}`}
                        disabled={busy === `${r.id}-import`}
                        onClick={() => run(r.id, "import")}
                      >
                        {busy === `${r.id}-import` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 ml-1" />} استيراد
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
