import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Clock, Webhook, DollarSign, Play, Trash2, Loader2, RefreshCw, Send } from "lucide-react";
import {
  getUptimeHub, saveUptimeMonitor, deleteUptimeMonitor, runUptimeChecks,
  getAutomationHub, saveScheduledTask, deleteScheduledTask, runScheduledTask,
  saveWebhookEndpoint, deleteWebhookEndpoint, testWebhookEndpoint,
  getUsageCosts, saveUsageCost, deleteUsageCost,
} from "@/lib/ops-plus.functions";

export const Route = createFileRoute("/_authenticated/automation")({
  component: AutomationPage,
  head: () => ({
    meta: [
      { title: "الأتمتة والمراقبة — TVCC" },
      { name: "description", content: "مراقبة توفّر المواقع، مهام مجدولة، نقاط ويبهوك، وتتبّع تكاليف الاستهلاك في لوحة واحدة." },
      { property: "og:title", content: "الأتمتة والمراقبة — TVCC" },
      { property: "og:description", content: "Uptime، مهام مجدولة، ويبهوك، وتكاليف — كل الأتمتة في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AutomationPage() {
  const qc = useQueryClient();
  const fetchUptime = useServerFn(getUptimeHub);
  const fetchAuto = useServerFn(getAutomationHub);
  const fetchCosts = useServerFn(getUsageCosts);
  const saveMon = useServerFn(saveUptimeMonitor);
  const delMon = useServerFn(deleteUptimeMonitor);
  const runChecks = useServerFn(runUptimeChecks);
  const saveTask = useServerFn(saveScheduledTask);
  const delTask = useServerFn(deleteScheduledTask);
  const runTask = useServerFn(runScheduledTask);
  const saveHook = useServerFn(saveWebhookEndpoint);
  const delHook = useServerFn(deleteWebhookEndpoint);
  const testHook = useServerFn(testWebhookEndpoint);
  const saveCost = useServerFn(saveUsageCost);
  const delCost = useServerFn(deleteUsageCost);

  const uptime = useQuery({ queryKey: ["uptime-hub"], queryFn: () => fetchUptime(), refetchInterval: 30000 });
  const auto = useQuery({ queryKey: ["automation-hub"], queryFn: () => fetchAuto(), refetchInterval: 30000 });
  const costs = useQuery({ queryKey: ["usage-costs"], queryFn: () => fetchCosts() });

  const [mon, setMon] = useState<Record<string, any>>({ name: "", url: "", website_id: "", interval_sec: 300 });
  const [task, setTask] = useState<Record<string, any>>({ name: "", task_type: "uptime_check", interval_minutes: 60, server_id: "" });
  const [hook, setHook] = useState<Record<string, any>>({ name: "", url: "", direction: "outgoing" });
  const [cost, setCost] = useState<Record<string, any>>({ category: "ai", provider: "", quantity: 0, unit: "tokens", unit_cost: 0 });

  const mut = (fn: any, keys: string[], msg: string) =>
    useMutation({
      mutationFn: (v: any) => fn({ data: v }),
      onSuccess: () => { toast.success(msg); keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
      onError: (e: any) => toast.error(e?.message ?? "فشلت العملية"),
    });

  const saveMonM = mut(saveMon, ["uptime-hub"], "تم حفظ المراقب");
  const delMonM = mut(delMon, ["uptime-hub"], "تم الحذف");
  const runChecksM = useMutation({
    mutationFn: (v: any) => runChecks({ data: v }),
    onSuccess: (r: any) => { toast.success(`تم فحص ${r.checked} مراقب`); qc.invalidateQueries({ queryKey: ["uptime-hub"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الفحص"),
  });
  const saveTaskM = mut(saveTask, ["automation-hub"], "تم حفظ المهمة");
  const delTaskM = mut(delTask, ["automation-hub"], "تم الحذف");
  const runTaskM = useMutation({
    mutationFn: (v: any) => runTask({ data: v }),
    onSuccess: (r: any) => { toast.success(r.output || "تم التنفيذ"); qc.invalidateQueries({ queryKey: ["automation-hub"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التنفيذ"),
  });
  const saveHookM = mut(saveHook, ["automation-hub"], "تم حفظ الويبهوك");
  const delHookM = mut(delHook, ["automation-hub"], "تم الحذف");
  const testHookM = useMutation({
    mutationFn: (v: any) => testHook({ data: v }),
    onSuccess: (r: any) => { toast[r.status === "sent" ? "success" : "error"](`الحالة: ${r.status} ${r.code ?? ""}`); qc.invalidateQueries({ queryKey: ["automation-hub"] }); },
  });
  const saveCostM = mut(saveCost, ["usage-costs"], "تم تسجيل التكلفة");
  const delCostM = mut(delCost, ["usage-costs"], "تم الحذف");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Activity className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">الأتمتة والمراقبة</h1>
          <p className="text-sm text-muted-foreground">توفّر المواقع · مهام مجدولة · ويبهوك · التكاليف</p>
        </div>
      </header>

      <Tabs defaultValue="uptime">
        <TabsList>
          <TabsTrigger value="uptime"><Activity className="h-4 w-4 me-1" /> التوفّر</TabsTrigger>
          <TabsTrigger value="tasks"><Clock className="h-4 w-4 me-1" /> المهام</TabsTrigger>
          <TabsTrigger value="hooks"><Webhook className="h-4 w-4 me-1" /> الويبهوك</TabsTrigger>
          <TabsTrigger value="costs"><DollarSign className="h-4 w-4 me-1" /> التكاليف</TabsTrigger>
        </TabsList>

        {/* UPTIME */}
        <TabsContent value="uptime" className="space-y-4">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">مراقب جديد</CardTitle>
              <Button size="sm" variant="outline" onClick={() => runChecksM.mutate({})} disabled={runChecksM.isPending}>
                {runChecksM.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <RefreshCw className="h-4 w-4 me-1" />} فحص الكل
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div><Label>الاسم</Label><Input value={mon["name"]} onChange={(e) => setMon({ ...mon, name: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>العنوان</Label><Input value={mon["url"]} onChange={(e) => setMon({ ...mon, url: e.target.value })} placeholder="https://example.com" /></div>
              <div><Label>الفاصل (ث)</Label><Input type="number" value={mon["interval_sec"]} onChange={(e) => setMon({ ...mon, interval_sec: e.target.value })} /></div>
              <Button onClick={() => saveMonM.mutate(mon)} disabled={!mon["url"]}>إضافة</Button>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="space-y-2 p-4">
              {(uptime.data?.monitors ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا مراقبات بعد.</p> :
                (uptime.data?.monitors ?? []).map((m: any) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{m.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.url}</div>
                    </div>
                    <Badge variant={m.last_status === "up" ? "outline" : m.last_status ? "destructive" : "secondary"}>{m.last_status ?? "لم يُفحص"}</Badge>
                    {m.last_latency_ms != null && <span className="text-xs text-muted-foreground">{m.last_latency_ms}ms</span>}
                    <Button size="sm" variant="outline" onClick={() => runChecksM.mutate({ monitorId: m.id })}><Play className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => delMonM.mutate({ id: m.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks" className="space-y-4">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader><CardTitle className="text-base">مهمة مجدولة</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div><Label>الاسم</Label><Input value={task["name"]} onChange={(e) => setTask({ ...task, name: e.target.value })} /></div>
              <div>
                <Label>النوع</Label>
                <Select value={task["task_type"]} onValueChange={(v) => setTask({ ...task, task_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uptime_check">فحص التوفّر</SelectItem>
                    <SelectItem value="failover_check">فحص التحويل التلقائي</SelectItem>
                    <SelectItem value="server_command">أمر على السيرفر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>السيرفر</Label>
                <Select value={task["server_id"]} onValueChange={(v) => setTask({ ...task, server_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>{(auto.data?.servers ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>كل (دقيقة)</Label><Input type="number" value={task["interval_minutes"]} onChange={(e) => setTask({ ...task, interval_minutes: e.target.value })} /></div>
              <Button onClick={() => saveTaskM.mutate(task)} disabled={!task["name"]}>حفظ المهمة</Button>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="space-y-2 p-4">
              {(auto.data?.tasks ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا مهام بعد.</p> :
                (auto.data?.tasks ?? []).map((t: any) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.task_type} · كل {t.interval_minutes} د · آخر حالة: {t.last_status ?? "—"}</div>
                    </div>
                    <Button size="sm" onClick={() => runTaskM.mutate({ id: t.id })} disabled={runTaskM.isPending}><Play className="h-4 w-4 me-1" /> تشغيل</Button>
                    <Button size="sm" variant="ghost" onClick={() => delTaskM.mutate({ id: t.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              {(auto.data?.runs ?? []).slice(0, 8).map((r: any) => (
                <div key={r.id} className="flex justify-between border-b border-border/40 py-1 text-xs text-muted-foreground">
                  <span>{r.status} — {r.output ?? r.error_message ?? ""}</span>
                  <span>{new Date(r.started_at).toLocaleString("ar")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEBHOOKS */}
        <TabsContent value="hooks" className="space-y-4">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader><CardTitle className="text-base">نقطة ويبهوك</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div><Label>الاسم</Label><Input value={hook["name"]} onChange={(e) => setHook({ ...hook, name: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>العنوان</Label><Input value={hook["url"]} onChange={(e) => setHook({ ...hook, url: e.target.value })} placeholder="https://hooks.example.com/tvcc" /></div>
              <Button onClick={() => saveHookM.mutate(hook)} disabled={!hook["url"]}>إضافة</Button>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="space-y-2 p-4">
              {(auto.data?.hooks ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا نقاط ويبهوك بعد.</p> :
                (auto.data?.hooks ?? []).map((h: any) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{h.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{h.url}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => testHookM.mutate({ id: h.id })}><Send className="h-4 w-4 me-1" /> اختبار</Button>
                    <Button size="sm" variant="ghost" onClick={() => delHookM.mutate({ id: h.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              {(auto.data?.deliveries ?? []).slice(0, 8).map((d: any) => (
                <div key={d.id} className="flex justify-between border-b border-border/40 py-1 text-xs text-muted-foreground">
                  <span>{d.event} — {d.status} {d.response_code ?? ""}</span>
                  <span>{new Date(d.created_at).toLocaleString("ar")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COSTS */}
        <TabsContent value="costs" className="space-y-4">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader><CardTitle className="text-base">تسجيل استهلاك</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">
              <div>
                <Label>الفئة</Label>
                <Select value={cost["category"]} onValueChange={(v) => setCost({ ...cost, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">ذكاء اصطناعي</SelectItem>
                    <SelectItem value="server">سيرفر</SelectItem>
                    <SelectItem value="storage">تخزين</SelectItem>
                    <SelectItem value="domain">نطاق</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المزوّد</Label><Input value={cost["provider"]} onChange={(e) => setCost({ ...cost, provider: e.target.value })} /></div>
              <div><Label>الكمية</Label><Input type="number" value={cost["quantity"]} onChange={(e) => setCost({ ...cost, quantity: e.target.value })} /></div>
              <div><Label>سعر الوحدة</Label><Input type="number" step="0.0001" value={cost["unit_cost"]} onChange={(e) => setCost({ ...cost, unit_cost: e.target.value })} /></div>
              <Button onClick={() => saveCostM.mutate(cost)}>تسجيل</Button>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader><CardTitle className="text-base">الإجمالي: {(costs.data?.total ?? 0).toFixed(2)} USD</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(costs.data?.byCategory ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm"><span>{k}</span><span>{Number(v).toFixed(2)}</span></div>
              ))}
              {(costs.data?.rows ?? []).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between border-b border-border/40 py-1 text-xs">
                  <span>{r.category} · {r.provider ?? "—"} · {r.quantity} {r.unit}</span>
                  <span className="flex items-center gap-2">
                    {Number(r.total_cost).toFixed(2)} {r.currency}
                    <Button size="sm" variant="ghost" onClick={() => delCostM.mutate({ id: r.id })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
