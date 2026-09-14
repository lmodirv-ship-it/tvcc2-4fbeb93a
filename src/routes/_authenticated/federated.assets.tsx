import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getAssetsInventory, setSiteGroup } from "@/lib/federated-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Boxes, Download, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/assets")({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: "الأصول والمجموعات — TVCC" },
      { name: "description", content: "جرد كامل لمواقع وسيرفرات وقواعد بيانات المنصة، مقسّمة إلى مجموعات حسب التخصص والاستضافة والحالة." },
    ],
  }),
});

function AssetsPage() {
  const qc = useQueryClient();
  const fetchData = useServerFn(getAssetsInventory);
  const setGroupFn = useServerFn(setSiteGroup);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("");

  const { data, isLoading } = useQuery({ queryKey: ["assets-inventory"], queryFn: () => fetchData(), refetchInterval: 60000 });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of ((data?.members ?? []) as any[])) c[m.group_id] = (c[m.group_id] ?? 0) + 1;
    return c;
  }, [data]);

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل جرد الأصول…</div>;

  const groups = data.groups as any[];
  const kinds = [
    { key: "category", label: "حسب التخصص" },
    { key: "hosting", label: "حسب الاستضافة" },
    { key: "status", label: "حسب الحالة" },
    { key: "legacy", label: "مجموعات سابقة" },
  ];

  const memberIds = new Set(((data.members as any[]) ?? []).filter((m) => m.group_id === activeGroup).map((m) => m.website_id));
  const websites = (data.websites as any[]).filter((w) => {
    const q = search.trim().toLowerCase();
    const okSearch = !q || (w.name ?? "").toLowerCase().includes(q) || (w.domain ?? "").toLowerCase().includes(q);
    return okSearch && (!activeGroup || memberIds.has(w.id));
  });

  const exportCsv = () => {
    const rows = [["المعرّف", "الاسم", "النطاق", "الحالة", "الرابط"]].concat(
      websites.map((w) => [w.manara_code ?? "", w.name ?? "", w.domain ?? "", w.status ?? "", w.site_url ?? ""]),
    );
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "tvcc-assets.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("صُدِّر الجرد إلى CSV");
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Boxes className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">الأصول والمجموعات</h1>
            <p className="text-sm text-muted-foreground">جرد موحّد للمواقع والسيرفرات وقواعد البيانات مع تصنيف تلقائي</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 ml-1" /> تصدير CSV</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "المواقع", value: (data.websites as any[]).length },
          { label: "السيرفرات", value: (data.servers as any[]).length },
          { label: "قواعد البيانات", value: (data.databases as any[]).length },
          { label: "المجموعات", value: groups.length },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6"><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="category">
        <TabsList>{kinds.map((k) => <TabsTrigger key={k.key} value={k.key}>{k.label}</TabsTrigger>)}</TabsList>
        {kinds.map((k) => (
          <TabsContent key={k.key} value={k.key}>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {groups.filter((g) => (g.group_kind ?? "legacy") === k.key).map((g) => (
                <Card key={g.id} className={`cursor-pointer transition ${activeGroup === g.id ? "ring-2 ring-primary" : "hover:bg-accent/40"}`} onClick={() => setActiveGroup(activeGroup === g.id ? "" : g.id)}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color ?? "hsl(var(--primary))" }} />{g.name}
                  </CardTitle></CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between">
                    <span className="text-2xl font-bold">{counts[g.id] ?? 0}</span>
                    {g.is_auto && <Badge variant="secondary" className="text-[10px]">تلقائي</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{activeGroup ? `مواقع: ${groups.find((g) => g.id === activeGroup)?.name}` : "كل المواقع"} ({websites.length})</CardTitle>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute top-2.5 right-2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث…" className="pr-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>المعرّف</TableHead><TableHead>الاسم</TableHead><TableHead>النطاق</TableHead><TableHead>الحالة</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {websites.slice(0, 150).map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.manara_code ?? "—"}</TableCell>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="font-mono text-xs">{w.domain}</TableCell>
                  <TableCell><Badge variant={w.status === "online" ? "default" : "secondary"}>{w.status}</Badge></TableCell>
                  <TableCell>
                    {activeGroup && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await setGroupFn({ data: { websiteId: w.id, groupId: activeGroup, attach: false } });
                        toast.success("أُزيل الموقع من المجموعة");
                        qc.invalidateQueries({ queryKey: ["assets-inventory"] });
                      }}>إزالة من المجموعة</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {websites.length > 150 && <p className="text-xs text-muted-foreground pt-3">تُعرض أول 150 نتيجة — استخدم البحث لتضييق النطاق.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
