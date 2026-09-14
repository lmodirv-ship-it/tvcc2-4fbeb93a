import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Check, Download, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getSiteCoverage } from "@/lib/topology.functions";
import type { SiteCoverageRow } from "@/lib/topology.functions";

const COLUMNS: { key: keyof SiteCoverageRow; label: string; kind: "text" | "bool" }[] = [
  { key: "site_code", label: "الرمز", kind: "text" },
  { key: "domain", label: "النطاق", kind: "text" },
  { key: "database", label: "قاعدة البيانات", kind: "text" },
  { key: "server", label: "السيرفر", kind: "text" },
  { key: "agent", label: "وكيل", kind: "bool" },
  { key: "ssl", label: "شهادة", kind: "bool" },
  { key: "storage", label: "تخزين", kind: "bool" },
  { key: "backup", label: "نسخ", kind: "bool" },
  { key: "alerts", label: "تنبيهات", kind: "bool" },
];

function Mark({ ok }: { ok: boolean }) {
  return ok
    ? <Check className="mx-auto size-4 text-primary" aria-label="مكتمل" />
    : <X className="mx-auto size-4 text-destructive" aria-label="ناقص" />;
}

/** جدول تغطية شامل لكل المواقع: ما المرتبط وما الناقص. */
export function SiteCoverage() {
  const fetchCoverage = useServerFn(getSiteCoverage);
  const query = useQuery({ queryKey: ["site-coverage"], queryFn: () => fetchCoverage(), refetchInterval: 60_000 });
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const rows = (query.data?.rows ?? []) as SiteCoverageRow[];
  const totals = query.data?.totals;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMissing && r.missing === 0) return false;
      if (!q) return true;
      return [r.site_code, r.name, r.domain, r.server, r.database].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, onlyMissing]);

  const exportCsv = () => {
    const header = COLUMNS.map((c) => c.label).concat("ناقص");
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = filtered.map((r) => COLUMNS.map((c) => {
      const v = r[c.key];
      return esc(c.kind === "bool" ? (v ? "نعم" : "لا") : (v ?? "—"));
    }).concat(esc(r.missing)).join(","));
    const csv = ["\uFEFF" + header.join(","), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `site-coverage-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (query.isLoading) {
    return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="size-4 animate-spin" />جارٍ حساب تغطية المواقع…</CardContent></Card>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["المواقع", totals?.sites ?? 0],
          ["مكتملة الربط", totals?.complete ?? 0],
          ["ناقصة", totals?.incomplete ?? 0],
          ["بلا قاعدة", totals?.noDatabase ?? 0],
          ["بلا سيرفر", totals?.noServer ?? 0],
          ["بلا نسخ", totals?.noBackup ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{String(value)}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالرمز أو النطاق" className="h-9 w-64 pr-9 text-xs" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
          <label htmlFor="only-missing" className="text-sm">أظهر الناقص فقط</label>
        </div>
        <Badge variant="secondary">{filtered.length} موقع</Badge>
        <div className="mr-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="size-4" />تصدير CSV</Button>
          <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}تحديث
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-right">
                  {COLUMNS.map((c) => <th key={String(c.key)} className={`whitespace-nowrap p-2.5 text-xs font-medium text-muted-foreground ${c.kind === "bool" ? "text-center" : ""}`}>{c.label}</th>)}
                  <th className="p-2.5 text-xs font-medium text-muted-foreground">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 400).map((r) => (
                  <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/40 ${r.missing > 3 ? "bg-destructive/5" : ""}`}>
                    {COLUMNS.map((c) => (
                      <td key={String(c.key)} className={`p-2.5 ${c.kind === "bool" ? "text-center" : "max-w-[220px] truncate font-mono text-xs"}`}>
                        {c.kind === "bool" ? <Mark ok={Boolean(r[c.key])} /> : (r[c.key] ? String(r[c.key]) : <span className="text-destructive">ناقص</span>)}
                      </td>
                    ))}
                    <td className="p-2.5">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/websites">فتح</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={COLUMNS.length + 1} className="p-6 text-center text-muted-foreground">لا توجد مواقع مطابقة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
