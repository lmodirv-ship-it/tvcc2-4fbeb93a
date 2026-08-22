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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Play, Trash2, Loader2, RefreshCw, Terminal, Download } from "lucide-react";
import {
  getFailoverHub, saveFailoverPolicy, deleteFailoverPolicy, runFailoverCheck,
  createAgentInstaller, listAgentInstallers,
} from "@/lib/ops-plus.functions";

export const Route = createFileRoute("/_authenticated/failover")({
  component: FailoverPage,
  head: () => ({
    meta: [
      { title: "التحويل التلقائي — TVCC" },
      { name: "description", content: "سياسات Failover بين السيرفر الأساسي والاحتياطي مع فحص صحة دوري وسجل أحداث التحويل، إضافة إلى تثبيت الوكيل بأمر واحد." },
      { property: "og:title", content: "التحويل التلقائي — TVCC" },
      { property: "og:description", content: "استمرارية الخدمة: تحويل تلقائي إلى السيرفر الاحتياطي عند العطل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY = {
  name: "", website_id: "", primary_server_id: "", backup_server_id: "",
  health_url: "", check_interval_sec: 60, failure_threshold: 3, auto_failback: true, is_active: true,
};

function FailoverPage() {
  const qc = useQueryClient();
  const fetchHub = useServerFn(getFailoverHub);
  const save = useServerFn(saveFailoverPolicy);
  const del = useServerFn(deleteFailoverPolicy);
  const check = useServerFn(runFailoverCheck);
  const mkInstaller = useServerFn(createAgentInstaller);
  const fetchInstallers = useServerFn(listAgentInstallers);

  const [form, setForm] = useState<Record<string, any>>({ ...EMPTY });
  const [installServer, setInstallServer] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["failover"], queryFn: () => fetchHub(), refetchInterval: 30000 });
  const { data: installers } = useQuery({ queryKey: ["agent-installers"], queryFn: () => fetchInstallers() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["failover"] });

  const saveM = useMutation({
    mutationFn: (payload: Record<string, any>) => save({ data: payload }),
    onSuccess: () => { toast.success("تم حفظ السياسة"); setForm({ ...EMPTY }); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
  });
  const checkM = useMutation({
    mutationFn: (v: { policyId: string; force?: boolean }) => check({ data: v }),
    onSuccess: (r: any) => { toast[r.healthy ? "success" : "warning"](`${r.healthy ? "سليم" : "عطل"} · ${r.detail} · الحالة: ${r.state}`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الفحص"),
  });
  const installM = useMutation({
    mutationFn: (serverId: string) => mkInstaller({ data: { serverId, baseUrl: window.location.origin } }),
    onSuccess: () => { toast.success("تم توليد أمر التثبيت"); qc.invalidateQueries({ queryKey: ["agent-installers"] }); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر التوليد"),
  });

  const servers = data?.servers ?? [];
  const websites = data?.websites ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShieldAlert className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">التحويل التلقائي (Failover)</h1>
          <p className="text-sm text-muted-foreground">استمرارية الخدمة عند تعطّل السيرفر الأساسي + تثبيت الوكيل بأمر واحد</p>
        </div>
      </header>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-base">سياسة جديدة</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div><Label>الاسم</Label><Input value={form["name"]} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="سياسة tvcc" /></div>
          <div><Label>رابط الفحص</Label><Input value={form["health_url"]} onChange={(e) => setForm({ ...form, health_url: e.target.value })} placeholder="https://example.com/health" /></div>
          <div>
            <Label>الموقع</Label>
            <Select value={form["website_id"]} onValueChange={(v) => setForm({ ...form, website_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
              <SelectContent>{websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>السيرفر الأساسي</Label>
            <Select value={form["primary_server_id"]} onValueChange={(v) => setForm({ ...form, primary_server_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{servers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>السيرفر الاحتياطي</Label>
            <Select value={form["backup_server_id"]} onValueChange={(v) => setForm({ ...form, backup_server_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{servers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>الفاصل (ث)</Label><Input type="number" value={form["check_interval_sec"]} onChange={(e) => setForm({ ...form, check_interval_sec: e.target.value })} /></div>
            <div><Label>عتبة الأعطال</Label><Input type="number" value={form["failure_threshold"]} onChange={(e) => setForm({ ...form, failure_threshold: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={!!form["auto_failback"]} onCheckedChange={(v) => setForm({ ...form, auto_failback: v })} />
            <span className="text-sm">رجوع تلقائي للأساسي عند تعافيه</span>
          </div>
          <Button onClick={() => saveM.mutate(form)} disabled={saveM.isPending || !form["name"]}>
            {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null} حفظ السياسة
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-base">السياسات</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> :
            (data?.policies ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا توجد سياسات بعد.</p> :
            (data?.policies ?? []).map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.health_url ?? "—"} · أعطال متتالية: {p.consecutive_failures}</div>
                </div>
                <Badge variant={p.current_state === "primary" ? "outline" : "destructive"}>{p.current_state === "primary" ? "أساسي" : "احتياطي"}</Badge>
                <Button size="sm" variant="outline" onClick={() => checkM.mutate({ policyId: p.id })} disabled={checkM.isPending}>
                  <RefreshCw className="h-4 w-4 me-1" /> فحص
                </Button>
                <Button size="sm" variant="secondary" onClick={() => checkM.mutate({ policyId: p.id, force: true })}>
                  <Play className="h-4 w-4 me-1" /> تحويل الآن
                </Button>
                <Button size="sm" variant="ghost" onClick={() => delM.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-base">سجل أحداث التحويل</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(data?.events ?? []).length === 0 ? <p className="text-muted-foreground">لا أحداث.</p> :
            (data?.events ?? []).map((e: any) => (
              <div key={e.id} className="flex justify-between border-b border-border/40 py-1">
                <span>{e.event_type === "failover" ? "تحويل إلى الاحتياطي" : "رجوع للأساسي"} — {e.reason}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("ar")}</span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4" /> تثبيت الوكيل بأمر واحد</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={installServer} onValueChange={setInstallServer}>
              <SelectTrigger className="w-64"><SelectValue placeholder="اختر السيرفر" /></SelectTrigger>
              <SelectContent>{servers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => installM.mutate(installServer)} disabled={!installServer || installM.isPending}>
              <Download className="h-4 w-4 me-1" /> توليد الأمر
            </Button>
          </div>
          {(installers ?? []).map((i: any) => (
            <div key={i.id} className="rounded-lg border border-border/60 p-3">
              <div className="mb-1 text-xs text-muted-foreground">{i.label} · {new Date(i.created_at).toLocaleString("ar")}</div>
              <code className="block break-all rounded bg-muted p-2 text-xs">{i.install_command}</code>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(i.install_command); toast.success("تم النسخ"); }}>نسخ</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
