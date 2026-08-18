import { createFileRoute } from "@tanstack/react-router";
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
import { NotebookPen, Loader2, Download, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listOperations, deleteOperation } from "@/lib/server-ops.functions";

export const Route = createFileRoute("/_authenticated/operations")({
  component: OperationsPage,
  head: () => ({
    meta: [
      { title: "المذكّرة المرجعية للعمليات — TVCC" },
      { name: "description", content: "سجل مرجعي دائم لكل عملية على السيرفرات والمواقع: المدخلات والنتائج والحالة والوقت." },
      { property: "og:title", content: "المذكّرة المرجعية للعمليات — TVCC" },
      { property: "og:description", content: "كل عملية سيرفر أو موقع موثّقة بمدخلاتها ونتيجتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const statusStyle = (s: string) =>
  s === "success"
    ? "bg-success/20 text-success border-success/40"
    : s === "pending"
      ? "bg-muted text-muted-foreground border-border"
      : s === "warning"
        ? "bg-warning/20 text-warning border-warning/40"
        : "bg-destructive/20 text-destructive border-destructive/40";

function OperationsPage() {
  const qc = useQueryClient();
  const fetchOps = useServerFn(listOperations);
  const remove = useServerFn(deleteOperation);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["operations"],
    queryFn: () => fetchOps({ data: { limit: 500 } }),
    refetchInterval: 60000,
  });

  const rows = (data ?? []) as any[];
  const filtered = useMemo(
    () => rows.filter((r) => !q || `${r.title} ${r.operation} ${r.servers?.name ?? ""} ${r.websites?.domain ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const exportLog = (fmt: "json" | "csv") => {
    let content = "";
    if (fmt === "json") {
      content = JSON.stringify(filtered, null, 2);
    } else {
      const head = ["created_at", "scope", "operation", "title", "status", "server", "website"];
      content = [
        head.join(","),
        ...filtered.map((r) =>
          [r.created_at, r.scope, r.operation, `"${String(r.title).replace(/"/g, '""')}"`, r.status, r.servers?.name ?? "", r.websites?.domain ?? ""].join(","),
        ),
      ].join("\n");
    }
    const blob = new Blob([content], { type: fmt === "json" ? "application/json" : "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `operations-${new Date().toISOString().slice(0, 10)}.${fmt}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><NotebookPen className="w-6 h-6 text-primary" /> المذكّرة المرجعية للعمليات</h1>
          <p className="text-sm text-muted-foreground mt-1">كل عملية على أي سيرفر أو موقع مسجّلة بمدخلاتها ونتيجتها للرجوع إليها أثناء التطوير.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportLog("csv")}><Download className="w-4 h-4 ml-1" /> CSV</Button>
          <Button variant="outline" onClick={() => exportLog("json")}><Download className="w-4 h-4 ml-1" /> JSON</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في العمليات..." className="pr-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد عمليات مسجّلة بعد.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوقت</TableHead>
                  <TableHead>العملية</TableHead>
                  <TableHead>الهدف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المنفّذ</TableHead>
                  <TableHead>التفاصيل</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar")}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-muted-foreground ltr text-left">{r.operation}</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.servers?.name ?? r.websites?.domain ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusStyle(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">{r.actor}</TableCell>
                    <TableCell className="text-[11px] max-w-[24rem]">
                      <pre className="whitespace-pre-wrap break-words line-clamp-3 ltr text-left">
                        {JSON.stringify({ input: r.input, result: r.result }).slice(0, 500)}
                      </pre>
                      {r.notes && <div className="text-muted-foreground">{r.notes}</div>}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          await remove({ data: { id: r.id } });
                          qc.invalidateQueries({ queryKey: ["operations"] });
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
