import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getHealingData, saveAlertRule, deleteAlertRule, resolveAlert, runHealAction } from "@/lib/federated-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartPulse, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/healing")({
  component: HealingPage,
  head: () => ({
    meta: [
      { title: "الشفاء الذاتي والتنبيهات — TVCC" },
      { name: "description", content: "قواعد تنبيه على موارد السيرفرات، تنبيهات مفتوحة، وإجراءات شفاء ذاتي تُنفَّذ عبر الوكيل." },
    ],
  }),
});

const METRICS = [
  { v: "cpu_percent", l: "استهلاك المعالج %" },
  { v: "mem_percent", l: "استهلاك الذاكرة %" },
  { v: "disk_percent", l: "امتلاء القرص %" },
  { v: "offline_seconds", l: "انقطاع الوكيل (ثانية)" },
];

const emptyRule = { id: undefined as string | undefined, name: "", scope: "all", serverId: "", metric: "cpu_percent", comparator: ">", threshold: 85, forSeconds: 300, severity: "warning", isActive: true };

function HealingPage() {
  const qc = useQueryClient();
  const fetchData = useServerFn(getHealingData);
  const saveFn = useServerFn(saveAlertRule);
  const delFn = useServerFn(deleteAlertRule);
  const resolveFn = useServerFn(resolveAlert);
  const healFn = useServerFn(runHealAction);

  const [rule, setRule] = useState(emptyRule);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [healServer, setHealServer] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["healing"], queryFn: () => fetchData(), refetchInterval: 20000 });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل مركز الشفاء…</div>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["healing"] });
  const serverName = (id?: string) => (data.servers as any[]).find((s) => s.id === id)?.name ?? "كل السيرفرات";

  const submit = async () => {
    if (!rule.name.trim()) return toast.error("أدخل اسم القاعدة");
    setBusy(true);
    try {
      await saveFn({ data: { ...rule, serverId: rule.scope === "server" ? rule.serverId || null : null, threshold: Number(rule.threshold), forSeconds: Number(rule.forSeconds) } });
      toast.success("حُفظت قاعدة التنبيه");
      setOpen(false); setRule(emptyRule); refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const heal = async (kind: "service_restart" | "disk_cleanup" | "nginx_reload") => {
    if (!healServer) return toast.error("اختر السيرفر");
    try {
      await healFn({ data: { serverId: healServer, kind } });
      toast.success("أُرسل إجراء الشفاء إلى الوكيل");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const openAlerts = (data.alerts as any[]).filter((a) => !a.resolved_at);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HeartPulse className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">الشفاء الذاتي والتنبيهات</h1>
            <p className="text-sm text-muted-foreground">قواعد مراقبة، تنبيهات مفتوحة، وإجراءات إصلاح تُنفَّذ عبر الوكيل</p>
          </div>
        </div>
        <Button onClick={() => { setRule(emptyRule); setOpen(true); }}><Plus className="w-4 h-4 ml-1" /> قاعدة تنبيه</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "قواعد نشطة", value: (data.rules as any[]).filter((r) => r.is_active).length },
          { label: "تنبيهات مفتوحة", value: openAlerts.length },
          { label: "مهام الوكيل", value: (data.jobs as any[]).length },
          { label: "سيرفرات متصلة", value: (data.servers as any[]).filter((s) => s.status === "online").length },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6"><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="w-4 h-4 text-primary" /> إجراء شفاء فوري</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Select value={healServer} onValueChange={setHealServer}>
            <SelectTrigger className="w-56"><SelectValue placeholder="اختر السيرفر" /></SelectTrigger>
            <SelectContent>{(data.servers as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => heal("service_restart")}>إعادة تشغيل الخدمات</Button>
          <Button variant="outline" onClick={() => heal("disk_cleanup")}>تنظيف القرص</Button>
          <Button variant="outline" onClick={() => heal("nginx_reload")}>إعادة تحميل Nginx</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">التنبيهات</TabsTrigger>
          <TabsTrigger value="rules">القواعد</TabsTrigger>
          <TabsTrigger value="jobs">مهام الوكيل</TabsTrigger>
          <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>الخطورة</TableHead><TableHead>العنوان</TableHead><TableHead>التفاصيل</TableHead><TableHead>التاريخ</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(data.alerts as any[]).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>{a.severity}</Badge></TableCell>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.body}</TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("ar")}</TableCell>
                    <TableCell>{!a.resolved_at && <Button size="sm" variant="outline" onClick={async () => { await resolveFn({ data: { id: a.id } }); refresh(); }}>إغلاق</Button>}</TableCell>
                  </TableRow>
                ))}
                {(data.alerts as any[]).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد تنبيهات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النطاق</TableHead><TableHead>الشرط</TableHead><TableHead>المدة</TableHead><TableHead>الخطورة</TableHead><TableHead>نشطة</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(data.rules as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.scope === "server" ? serverName(r.server_id) : "كل السيرفرات"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.metric} {r.comparator} {r.threshold}</TableCell>
                    <TableCell>{r.for_seconds}s</TableCell>
                    <TableCell><Badge variant={r.severity === "critical" ? "destructive" : "secondary"}>{r.severity}</Badge></TableCell>
                    <TableCell><Switch checked={!!r.is_active} onCheckedChange={async (v) => { await saveFn({ data: { id: r.id, name: r.name, scope: r.scope, serverId: r.server_id, metric: r.metric, comparator: r.comparator, threshold: r.threshold, forSeconds: r.for_seconds, severity: r.severity, isActive: v } }); refresh(); }} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={async () => { await delFn({ data: { id: r.id } }); refresh(); }}><Trash2 className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {(data.rules as any[]).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد قواعد بعد</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>المهمة</TableHead><TableHead>السيرفر</TableHead><TableHead>الحالة</TableHead><TableHead>التقدّم</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data.jobs as any[]).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.kind}</TableCell>
                    <TableCell>{serverName(j.server_id)}</TableCell>
                    <TableCell><Badge variant={j.status === "failed" ? "destructive" : j.status === "completed" ? "default" : "secondary"}>{j.status}</Badge></TableCell>
                    <TableCell className="text-xs">{j.current_step ?? 0}/{j.steps_total ?? 0} — {j.progress ?? 0}%</TableCell>
                    <TableCell className="text-xs">{new Date(j.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
                {(data.jobs as any[]).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد مهام</TableCell></TableRow>}
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
            {(data.audits as any[]).length === 0 && <p className="text-muted-foreground text-center py-8">لا توجد أحداث</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>قاعدة تنبيه</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} placeholder="اسم القاعدة" />
            <Select value={rule.scope} onValueChange={(v) => setRule({ ...rule, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل السيرفرات</SelectItem><SelectItem value="server">سيرفر محدد</SelectItem></SelectContent>
            </Select>
            {rule.scope === "server" && (
              <Select value={rule.serverId} onValueChange={(v) => setRule({ ...rule, serverId: v })}>
                <SelectTrigger><SelectValue placeholder="السيرفر" /></SelectTrigger>
                <SelectContent>{(data.servers as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Select value={rule.metric} onValueChange={(v) => setRule({ ...rule, metric: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={rule.comparator} onValueChange={(v) => setRule({ ...rule, comparator: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value=">">أكبر من</SelectItem><SelectItem value="<">أصغر من</SelectItem></SelectContent>
              </Select>
              <Input type="number" value={rule.threshold} onChange={(e) => setRule({ ...rule, threshold: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" value={rule.forSeconds} onChange={(e) => setRule({ ...rule, forSeconds: Number(e.target.value) })} placeholder="المدة بالثواني" />
              <Select value={rule.severity} onValueChange={(v) => setRule({ ...rule, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="info">معلومة</SelectItem><SelectItem value="warning">تحذير</SelectItem><SelectItem value="critical">حرج</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
