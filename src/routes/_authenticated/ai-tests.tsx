import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { History, Loader2, Trash2, Download, Search, Brain } from "lucide-react";
import { toast } from "sonner";
import { listModelTests, deleteModelTest } from "@/lib/ai-hub.functions";

export const Route = createFileRoute("/_authenticated/ai-tests")({
  component: AiTestsPage,
  head: () => ({
    meta: [
      { title: "سجل اختبارات النماذج — TVCC" },
      { name: "description", content: "راجع آخر اختبارات كل نموذج ذكاء اصطناعي: الوقت وزمن الاستجابة وعدد التوكِنز والنتيجة." },
      { property: "og:title", content: "سجل اختبارات النماذج — TVCC" },
      { property: "og:description", content: "الوقت وزمن الاستجابة وعدد التوكِنز ونتيجة كل اختبار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AiTestsPage() {
  const qc = useQueryClient();
  const fetchTests = useServerFn(listModelTests);
  const remove = useServerFn(deleteModelTest);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ai-tests"],
    queryFn: () => fetchTests({ data: { limit: 300 } }),
  });

  const rows = (data ?? []) as any[];
  const filtered = useMemo(
    () => rows.filter((r) => !q || `${r.model_label} ${r.prompt} ${r.answer ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-tests-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><History className="w-6 h-6 text-primary" /> سجل اختبارات النماذج</h1>
          <p className="text-sm text-muted-foreground mt-1">كل اختبار مع وقته وزمن استجابته وعدد التوكِنز والنتيجة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportJson}><Download className="w-4 h-4 ml-1" /> تصدير</Button>
          <Button asChild><Link to="/ai-models"><Brain className="w-4 h-4 ml-1" /> النماذج</Link></Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في السجل..." className="pr-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد اختبارات بعد.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوقت</TableHead>
                  <TableHead>النموذج</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الاستجابة</TableHead>
                  <TableHead>التوكِنز</TableHead>
                  <TableHead>الإعدادات</TableHead>
                  <TableHead>النتيجة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("ar")}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.model_label}</div>
                      <div className="text-muted-foreground">{r.provider_label ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={r.status === "success"
                          ? "bg-success/20 text-success border-success/40"
                          : "bg-destructive/20 text-destructive border-destructive/40"}
                      >
                        {r.status === "success" ? "نجح" : "فشل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.latency_ms ?? "—"}ms</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.total_tokens ?? "—"}
                      {r.prompt_tokens != null ? ` (${r.prompt_tokens}/${r.completion_tokens ?? 0})` : ""}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground ltr text-left whitespace-nowrap">
                      t={r.settings?.temperature ?? "—"} · p={r.settings?.top_p ?? "—"} · max={r.settings?.max_tokens ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[26rem]">
                      <div className="text-muted-foreground line-clamp-2">{r.prompt}</div>
                      <div className="line-clamp-3 whitespace-pre-wrap">{r.answer || r.error_message || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          await remove({ data: { id: r.id } });
                          qc.invalidateQueries({ queryKey: ["ai-tests"] });
                          toast.success("تم الحذف");
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
