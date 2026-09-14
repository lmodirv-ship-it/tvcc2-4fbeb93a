import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeshTopology } from "@/lib/federated-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Radio, KeyRound, Flame, Network } from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/mesh")({
  component: MeshPage,
  head: () => ({
    meta: [
      { title: "الطبولوجيا والمزامنة المركزية — TVCC" },
      { name: "description", content: "خريطة السيرفرات وروابطها، موارد كل عقدة، حالة مزامنة قواعد البيانات، وسجل التدقيق المركزي." },
    ],
  }),
});

const blocks = [
  { icon: Radio, title: "البث اللحظي", desc: "قنوات Realtime تبث أحداث المواقع والسيرفرات لحظياً إلى كل الصفحات.", to: "/publish-sync", cta: "مركز النشر والمزامنة" },
  { icon: KeyRound, title: "الصلاحيات المركزية", desc: "مفاتيح الاتصال والأسرار تُدار مركزياً من الخزنة المشفّرة وتُحقن عبر الوكيل.", to: "/vault", cta: "الخزنة" },
  { icon: Flame, title: "جدار الحماية", desc: "قواعد الجدار الناري لكل سيرفر تُطبَّق عبر أوامر الوكيل المدرجة في القائمة البيضاء.", to: "/servers", cta: "السيرفرات" },
];

function pct(used?: number, total?: number) {
  if (!used || !total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function MeshPage() {
  const fetchData = useServerFn(getMeshTopology);
  const { data, isLoading } = useQuery({ queryKey: ["mesh-topology"], queryFn: () => fetchData(), refetchInterval: 20000 });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">الطبولوجيا والمزامنة المركزية</h1>
          <p className="text-sm text-muted-foreground">خريطة العقد وروابطها، مزامنة القواعد، وسجل التدقيق</p>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-muted-foreground">جارٍ تحميل الطبولوجيا…</div>
      ) : (
        <Tabs defaultValue="nodes">
          <TabsList>
            <TabsTrigger value="nodes">العقد</TabsTrigger>
            <TabsTrigger value="links">الروابط</TabsTrigger>
            <TabsTrigger value="dbs">مزامنة القواعد</TabsTrigger>
            <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
          </TabsList>

          <TabsContent value="nodes">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(data.servers as any[]).map((s) => {
                const m = (data.metrics as any)[s.id];
                return (
                  <Card key={s.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2"><Network className="w-4 h-4 text-primary" />{s.name}</span>
                        <Badge variant={s.status === "online" ? "default" : "destructive"}>{s.status}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="font-mono text-muted-foreground">{s.hostname} · {s.role} · {s.network_kind}</div>
                      <div>المعالج {Math.round(m?.cpu_percent ?? 0)}%<Progress value={m?.cpu_percent ?? 0} className="h-1.5 mt-1" /></div>
                      <div>الذاكرة {pct(m?.mem_used_mb, m?.mem_total_mb)}%<Progress value={pct(m?.mem_used_mb, m?.mem_total_mb)} className="h-1.5 mt-1" /></div>
                      <div>القرص {pct(m?.disk_used_gb, m?.disk_total_gb)}%<Progress value={pct(m?.disk_used_gb, m?.disk_total_gb)} className="h-1.5 mt-1" /></div>
                      <div className="text-muted-foreground">الوكيل {s.agent_version ?? "—"} · آخر ظهور {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString("ar") : "—"}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="links">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead><TableHead>زمن الاستجابة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data.links as any[]).map((l) => {
                    const n = (id: string) => (data.servers as any[]).find((s) => s.id === id)?.name ?? "—";
                    return (
                      <TableRow key={l.id}>
                        <TableCell>{n(l.source_server_id)}</TableCell>
                        <TableCell>{n(l.target_server_id)}</TableCell>
                        <TableCell>{l.link_type} / {l.channel}</TableCell>
                        <TableCell><Badge variant={l.status === "online" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                        <TableCell>{l.latency_ms ?? "—"} ms</TableCell>
                      </TableRow>
                    );
                  })}
                  {(data.links as any[]).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد روابط مسجّلة</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="dbs">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>القاعدة</TableHead><TableHead>النوع</TableHead><TableHead>المضيف</TableHead><TableHead>المزامنة</TableHead><TableHead>التهجير</TableHead><TableHead>آخر مزامنة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data.databases as any[]).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}{d.is_primary && <Badge className="mr-2">رئيسية</Badge>}</TableCell>
                      <TableCell>{d.db_kind}</TableCell>
                      <TableCell className="font-mono text-xs">{d.host}{d.port ? `:${d.port}` : ""}</TableCell>
                      <TableCell>{d.sync_mode ?? "—"}</TableCell>
                      <TableCell><Badge variant={d.migration_status === "completed" ? "default" : "outline"}>{d.migration_status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs">{d.last_sync_at ? new Date(d.last_sync_at).toLocaleString("ar") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardContent className="pt-6 space-y-2">
              {(data.audits as any[]).map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <span className="font-mono">{a.action} · {a.resource}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("ar")}</span>
                </div>
              ))}
              {(data.audits as any[]).length === 0 && <p className="text-muted-foreground text-center py-8">لا توجد أحداث بعد</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map((b) => (
          <Card key={b.title}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><b.icon className="w-4 h-4 text-primary" /> {b.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{b.desc}</p>
              <Link to={b.to} className="text-sm text-primary hover:underline">{b.cta} ←</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
