import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, Bot, ListChecks, Loader2, Play } from "lucide-react";
import {
  getAgentOverview, applyAgentRole, setAgentCapability, dispatchAgentCommand, createAgentJob,
} from "@/lib/agent-roles.functions";
import { COMMAND_LABELS } from "@/lib/server-commands";

export function AgentPanel({ serverId }: { serverId: string }) {
  const overview = useServerFn(getAgentOverview);
  const applyRole = useServerFn(applyAgentRole);
  const setCap = useServerFn(setAgentCapability);
  const dispatch = useServerFn(dispatchAgentCommand);
  const newJob = useServerFn(createAgentJob);
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const q = useQuery({
    queryKey: ["agent-overview", serverId],
    queryFn: () => overview({ data: { serverId } }),
    refetchInterval: 15000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agent-overview", serverId] });

  const roleM = useMutation({
    mutationFn: (roleId: string) => applyRole({ data: { serverId, roleId } }),
    onSuccess: (r: any) => { toast.success(`تم منح الدور — ${r.allowed} أمر مسموح`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر منح الدور"),
  });
  const capM = useMutation({
    mutationFn: (v: { action: string; allowed: boolean }) => setCap({ data: { serverId, ...v } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحفظ"),
  });
  const cmdM = useMutation({
    mutationFn: (action: string) => dispatch({ data: { serverId, action } }),
    onSuccess: () => { toast.success("تم إرسال الأمر — النتيجة ستظهر في الطرفية الحيّة"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر إرسال الأمر"),
  });
  const jobM = useMutation({
    mutationFn: () =>
      newJob({
        data: {
          serverId,
          title: "فحص شامل للسيرفر",
          kind: "diagnostics",
          steps: [
            { action: "agent_diag" },
            { action: "scan_ports" },
            { action: "disk_usage" },
            { action: "storage_usage" },
          ],
        },
      }),
    onSuccess: () => { toast.success("تم إنشاء المهمة"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر إنشاء المهمة"),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  const d = q.data as any;
  const bound = new Set((d?.bindings ?? []).map((b: any) => b.role_id));
  const caps = (d?.capabilities ?? []).filter((c: any) =>
    !filter || c.action.includes(filter) || (COMMAND_LABELS[c.action] ?? "").includes(filter));

  return (
    <div className="space-y-4 pt-4">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> حالة الوكيل</h3>
        {d.instance ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">الإصدار v{d.instance.agent_version ?? "—"}</Badge>
            <Badge variant="outline">{d.instance.os ?? "نظام غير معروف"}</Badge>
            <Badge variant="outline">أوامر جارية: {d.instance.running_commands ?? 0}</Badge>
            <Badge variant="outline">زمن الاستجابة: {d.instance.poll_latency_ms ?? "—"} م.ث</Badge>
            <Badge variant="outline">آخر اتصال: {d.instance.last_poll_at ? new Date(d.instance.last_poll_at).toLocaleTimeString("ar") : "—"}</Badge>
          </div>
        ) : <p className="text-sm text-muted-foreground">الوكيل لم يتصل بعد بقناة المهام السريعة. حدّث الوكيل من صفحة التثبيت.</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => cmdM.mutate("agent_diag")}>تشخيص الوكيل</Button>
          <Button size="sm" variant="outline" onClick={() => cmdM.mutate("agent_self_update")}>تحديث الوكيل ذاتياً</Button>
          <Button size="sm" onClick={() => jobM.mutate()} disabled={jobM.isPending}>
            {jobM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} مهمة فحص شامل
          </Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> أدوار الوكيل</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {(d.roles ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {r.name} {bound.has(r.id) && <Badge className="text-[10px]">ممنوح</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
              <Button size="sm" variant={bound.has(r.id) ? "secondary" : "outline"} onClick={() => roleM.mutate(r.id)} disabled={roleM.isPending}>
                منح
              </Button>
            </div>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4 text-primary" /> صلاحيات الأوامر ({caps.filter((c: any) => c.allowed).length}/{d.capabilities.length})</h3>
        <Input placeholder="بحث عن أمر…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        {d.capabilities.length === 0 && <p className="text-sm text-muted-foreground">امنح دوراً أولاً لتوليد خريطة الصلاحيات.</p>}
        <div className="grid gap-1 md:grid-cols-2 max-h-80 overflow-y-auto">
          {caps.map((c: any) => (
            <label key={c.id} className="flex items-center justify-between gap-2 rounded border border-border/50 px-3 py-1.5 text-xs">
              <span>{COMMAND_LABELS[c.action] ?? c.action} <code className="text-muted-foreground">{c.action}</code></span>
              <Switch checked={!!c.allowed} onCheckedChange={(v) => capM.mutate({ action: c.action, allowed: v })} />
            </label>
          ))}
        </div>
      </CardContent></Card>

      {(d.jobs ?? []).length > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <h3 className="font-semibold">المهام الأخيرة</h3>
          {d.jobs.map((j: any) => (
            <div key={j.id} className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
              <span>{j.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{j.status}</Badge>
                {new Date(j.created_at).toLocaleString("ar")}
              </span>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
