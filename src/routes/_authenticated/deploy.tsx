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
import { GitBranch, Rocket, Trash2, Loader2, FlaskConical } from "lucide-react";
import { getDeployHub, saveGitRepository, deleteGitRepository, runGitDeploy } from "@/lib/ops-plus.functions";

export const Route = createFileRoute("/_authenticated/deploy")({
  component: DeployPage,
  head: () => ({
    meta: [
      { title: "النشر من Git — TVCC" },
      { name: "description", content: "اربط مستودع Git بموقعك وسيرفرك، وشغّل النشر بأمر واحد مع سجل كامل لعمليات النشر ووضع المحاكاة." },
      { property: "og:title", content: "النشر من Git — TVCC" },
      { property: "og:description", content: "من المستودع إلى السيرفر: بناء ونشر بنقرة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY = {
  repo_url: "", branch: "main", provider: "github", website_id: "", server_id: "",
  build_command: "", output_dir: "dist", deploy_path: "", auto_deploy: false,
};

function DeployPage() {
  const qc = useQueryClient();
  const fetchHub = useServerFn(getDeployHub);
  const save = useServerFn(saveGitRepository);
  const del = useServerFn(deleteGitRepository);
  const run = useServerFn(runGitDeploy);
  const [form, setForm] = useState<Record<string, any>>({ ...EMPTY });

  const { data, isLoading } = useQuery({ queryKey: ["deploy-hub"], queryFn: () => fetchHub(), refetchInterval: 20000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["deploy-hub"] });

  const saveM = useMutation({
    mutationFn: (p: Record<string, any>) => save({ data: p }),
    onSuccess: () => { toast.success("تم حفظ المستودع"); setForm({ ...EMPTY }); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });
  const delM = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("تم الحذف"); invalidate(); } });
  const runM = useMutation({
    mutationFn: (v: { repositoryId: string; dryRun?: boolean }) => run({ data: v }),
    onSuccess: (r: any) => { toast.success(`تمت جدولة النشر (${r.commandId ?? "—"})`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل النشر"),
  });

  const servers = data?.servers ?? [];
  const websites = data?.websites ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><GitBranch className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">النشر من Git</h1>
          <p className="text-sm text-muted-foreground">مستودع ← بناء ← نشر على السيرفر، مع سجل لكل عملية</p>
        </div>
      </header>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-base">ربط مستودع</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2"><Label>رابط المستودع</Label><Input value={form["repo_url"]} onChange={(e) => setForm({ ...form, repo_url: e.target.value })} placeholder="https://github.com/user/repo.git" /></div>
          <div><Label>الفرع</Label><Input value={form["branch"]} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
          <div>
            <Label>الموقع</Label>
            <Select value={form["website_id"]} onValueChange={(v) => setForm({ ...form, website_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
              <SelectContent>{websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>سيرفر النشر</Label>
            <Select value={form["server_id"]} onValueChange={(v) => setForm({ ...form, server_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
              <SelectContent>{servers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>مسار النشر</Label><Input value={form["deploy_path"]} onChange={(e) => setForm({ ...form, deploy_path: e.target.value })} placeholder="/var/www/example.com" /></div>
          <div className="md:col-span-2"><Label>أمر البناء</Label><Input value={form["build_command"]} onChange={(e) => setForm({ ...form, build_command: e.target.value })} placeholder="npm ci && npm run build" /></div>
          <div className="flex items-center gap-2">
            <Switch checked={!!form["auto_deploy"]} onCheckedChange={(v) => setForm({ ...form, auto_deploy: v })} />
            <span className="text-sm">نشر تلقائي عند الدفع</span>
          </div>
          <Button onClick={() => saveM.mutate(form)} disabled={saveM.isPending || !form["repo_url"]}>
            {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null} حفظ
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-base">المستودعات</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> :
            (data?.repos ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا مستودعات بعد.</p> :
            (data?.repos ?? []).map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.repo_url}</div>
                  <div className="text-xs text-muted-foreground">{r.branch} · {r.deploy_path ?? "بدون مسار"} {r.auto_deploy ? "· تلقائي" : ""}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => runM.mutate({ repositoryId: r.id, dryRun: true })}><FlaskConical className="h-4 w-4 me-1" /> محاكاة</Button>
                <Button size="sm" onClick={() => runM.mutate({ repositoryId: r.id })} disabled={runM.isPending}><Rocket className="h-4 w-4 me-1" /> نشر</Button>
                <Button size="sm" variant="ghost" onClick={() => delM.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-base">سجل النشر</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(data?.deployments ?? []).length === 0 ? <p className="text-muted-foreground">لا عمليات نشر بعد.</p> :
            (data?.deployments ?? []).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between border-b border-border/40 py-1">
                <span className="flex items-center gap-2"><Badge variant="outline">{d.status}</Badge>{d.trigger_source}</span>
                <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("ar")}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
