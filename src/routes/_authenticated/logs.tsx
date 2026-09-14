import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollText, RefreshCw, Loader2, Download, Server, Globe } from "lucide-react";
import { getUnifiedLogs } from "@/lib/logs.functions";

export const Route = createFileRoute("/_authenticated/logs")({
  component: LogsPage,
  head: () => ({
    meta: [
      { title: "مركز السجلات — TVCC" },
      { name: "description", content: "سجل موحّد لكل الأحداث: الأوامر، العمليات، التنبيهات، الإشعارات، التخزين وفحوصات المواقع في مكان واحد." },
      { property: "og:title", content: "مركز السجلات — TVCC" },
      { property: "og:description", content: "كل أحداث المنصة والسيرفرات والمواقع في تدفّق واحد قابل للتصفية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SOURCES = [
  { key: "all", label: "الكل" },
  { key: "commands", label: "أوامر السيرفر" },
  { key: "operations", label: "العمليات" },
  { key: "alerts", label: "التنبيهات" },
  { key: "health", label: "فحص المواقع" },
  { key: "storage", label: "التخزين" },
  { key: "notifications", label: "الإشعارات" },
  { key: "activity", label: "النشاط" },
  { key: "security", label: "السجل الأمني" },
];

const LEVEL_STYLE: Record<string, string> = {
  error: "border-destructive/50 text-destructive",
  warning: "border-amber-500/50 text-amber-500",
  success: "border-emerald-500/50 text-emerald-500",
  info: "border-border text-muted-foreground",
};

function when(at: string) {
  const d = new Date(at);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 48) return `قبل ${h} س`;
  return d.toLocaleDateString("ar");
}

function LogsPage() {
  const fetchLogs = useServerFn(getUnifiedLogs);
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["unified-logs"],
    queryFn: () => fetchLogs(),
    refetchInterval: 20000,
  });

  const entries = (data?.entries ?? []).filter((e) => {
    if (source !== "all" && e.source !== source) return false;
    if (!q.trim()) return true;
    const hay = `${e.title} ${e.detail} ${e.source}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const exportCsv = () => {
    const rows = [["time", "source", "level", "title", "detail"], ...entries.map((e) => [e.at, e.source, e.level, e.title, e.detail])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tvcc-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = data?.counts ?? { total: 0, error: 0, warning: 0, success: 0, info: 0 };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ScrollText className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">مركز السجلات</h1>
            <p className="text-sm text-muted-foreground">كل أحداث المنصة والسيرفرات والمواقع في تدفّق واحد</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!entries.length}>
            <Download className="h-4 w-4 me-1" /> تصدير CSV
          </Button>
          <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <RefreshCw className="h-4 w-4 me-1" />} تحديث
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "الإجمالي", value: counts["total"] },
          { label: "أخطاء", value: counts["error"] },
          { label: "تحذيرات", value: counts["warning"] },
          { label: "ناجحة", value: counts["success"] },
          { label: "معلومات", value: counts["info"] },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="p-4">
              <div className="text-2xl font-bold leading-none">{s.value ?? 0}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SOURCES.map((s) => (
          <Button key={s.key} size="sm" variant={source === s.key ? "default" : "outline"} onClick={() => setSource(s.key)}>
            {s.label}
          </Button>
        ))}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في السجلات…" className="h-9 w-full md:w-64" />
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">لا توجد سجلات مطابقة بعد.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start gap-3 p-3 hover:bg-muted/40">
                  <Badge variant="outline" className={LEVEL_STYLE[e.level]}>{e.source}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    {e.detail && <div className="mt-0.5 break-words text-xs text-muted-foreground">{e.detail}</div>}
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {e.serverId && data?.serverNames?.[e.serverId] && (
                        <span className="inline-flex items-center gap-1"><Server className="h-3 w-3" />{data.serverNames[e.serverId]}</span>
                      )}
                      {e.websiteId && data?.websiteNames?.[e.websiteId] && (
                        <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{data.websiteNames[e.websiteId]}</span>
                      )}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{when(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
