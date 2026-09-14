import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDbInsights } from "@/lib/dbsections.functions";

type Props = { databaseId: string; section: string; title?: string };

const toneClass = (tone?: string) =>
  tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : tone === "ok" ? "text-primary" : "";

function csvDownload(name: string, columns: string[], rows: Record<string, unknown>[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name}-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/** قراءة حيّة مباشرة من قاعدة TVCC الداخلية لقسم واحد. */
export function InsightView({ databaseId, section, title }: Props) {
  const fetchInsights = useServerFn(getDbInsights);
  const [filter, setFilter] = useState("");
  const query = useQuery({
    queryKey: ["db-insights", databaseId, section],
    queryFn: () => fetchInsights({ data: { databaseId, section } }),
    refetchInterval: section === "monitoring" ? 20_000 : false,
  });

  if (query.isLoading) {
    return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />جارٍ القراءة من القاعدة…</CardContent></Card>;
  }
  if (query.error) {
    return <Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive">{(query.error as Error).message}</CardContent></Card>;
  }
  const data = query.data;
  if (!data?.available) {
    return <Card><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><AlertTriangle className="size-4" />{data?.reason ?? "لا تتوفر قراءة مباشرة لهذا القسم."}</CardContent></Card>;
  }

  const q = filter.trim().toLowerCase();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="relative">
          <Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="بحث داخل النتائج" className="h-9 w-56 pr-9 text-xs" />
        </div>
        <Button size="sm" variant="outline" className="mr-auto" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}تحديث
        </Button>
      </div>

      {data.stats.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className={`mt-1 text-2xl font-bold ${toneClass(stat.tone)}`}>{String(stat.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data.groups.map((grp) => {
        const rows = q ? grp.rows.filter((row) => grp.columns.some((c) => String(row[c] ?? "").toLowerCase().includes(q))) : grp.rows;
        return (
          <Card key={grp.title}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 py-3">
              <div>
                <CardTitle className="text-base">{grp.title}</CardTitle>
                {grp.description && <p className="mt-1 text-xs text-muted-foreground">{grp.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rows.length ? "secondary" : "outline"}>{rows.length}</Badge>
                {rows.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => csvDownload(grp.title, grp.columns, rows)} aria-label="تصدير CSV">
                    <Download className="size-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-primary" />لا توجد نتائج في هذا القسم.</p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-right">
                        {grp.columns.map((c) => <th key={c} className="whitespace-nowrap p-2.5 text-xs font-medium text-muted-foreground">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 300).map((row, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/40">
                          {grp.columns.map((c) => (
                            <td key={c} className="max-w-[360px] truncate p-2.5 font-mono text-xs" dir="ltr" title={String(row[c] ?? "")}>
                              {String(row[c] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
