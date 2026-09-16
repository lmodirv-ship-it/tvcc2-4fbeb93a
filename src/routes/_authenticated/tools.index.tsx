import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Wrench } from "lucide-react";
import { listTools } from "@/lib/tools.functions";

export const Route = createFileRoute("/_authenticated/tools/")({
  head: () => ({
    meta: [
      { title: "مركز الأدوات — TVCC" },
      { name: "description", content: "سجل موحّد لأدوات إدارة السيرفرات والمواقع مفتوحة المصدر مع حالة التثبيت على كل سيرفر." },
      { property: "og:title", content: "مركز الأدوات — TVCC" },
      { property: "og:description", content: "سجل موحّد لأدوات إدارة السيرفرات والمواقع مفتوحة المصدر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  const fetchTools = useServerFn(listTools);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");

  const query = useQuery({ queryKey: ["tools-registry"], queryFn: () => fetchTools({ data: {} as any }) });
  const tools = query.data?.tools ?? [];

  const categories = useMemo<string[]>(
    () => Array.from(new Set(tools.map((t: any) => String(t.category ?? "")))).filter(Boolean),
    [tools],
  );
  const rows = useMemo(
    () =>
      tools.filter((t: any) => {
        const okCat = !cat || t.category === cat;
        const s = `${t.code} ${t.name} ${t.slug} ${t.category} ${t.role_desc ?? ""}`.toLowerCase();
        return okCat && (!q || s.includes(q.toLowerCase()));
      }),
    [tools, q, cat],
  );

  const exportCsv = () => {
    const head = ["المعرّف", "الأداة", "الفئة", "الترخيص", "المنفذ", "الصفحات", "سيرفرات مثبّتة"];
    const body = rows.map((t: any) => [
      t.code, t.name, t.category, t.license ?? "", t.default_port ?? "",
      t.pages.map((p: any) => p.page_label ?? p.page_path).join(" · "), t.installedCount,
    ]);
    const csv = [head, ...body].map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "tvcc-tools.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5 text-primary" /> مركز الأدوات المفتوحة
        </h1>
        <Badge variant="secondary">{tools.length} أداة</Badge>
        <div className="ms-auto flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="h-8 w-48" />
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="me-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={cat === "" ? "default" : "outline"} onClick={() => setCat("")}>الكل</Button>
        {categories.map((c) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">المعرّف</TableHead>
                  <TableHead className="text-start">الأداة</TableHead>
                  <TableHead className="text-start">الفئة</TableHead>
                  <TableHead className="text-start">الترخيص</TableHead>
                  <TableHead className="text-start">المنفذ</TableHead>
                  <TableHead className="text-start">الصفحات المرتبطة</TableHead>
                  <TableHead className="text-start">سيرفرات مثبّتة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell>
                      <Link to="/tools/$toolId" params={{ toolId: t.slug }} className="font-medium text-primary hover:underline">
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.role_desc}</div>
                    </TableCell>
                    <TableCell className="text-xs">{t.category}</TableCell>
                    <TableCell className="text-xs">{t.license ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{t.default_port ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {t.pages.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="me-1 text-[10px]">{p.page_label ?? p.page_path}</Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.installedCount ? "default" : "secondary"}>{t.installedCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">لا نتائج</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
