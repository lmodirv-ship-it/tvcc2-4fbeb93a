import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Server, Plus, Loader2, Trash2, Cpu, MemoryStick, HardDrive, Terminal, Copy, RefreshCw, Brain,
} from "lucide-react";
import { toast } from "sonner";
import {
  listServers, createServer, deleteServer, getAgentInstall, getServerDetail,
} from "@/lib/servers.functions";
import { importServerModels } from "@/lib/ai-hub.functions";

export const Route = createFileRoute("/_authenticated/servers")({
  component: ServersPage,
  head: () => ({
    meta: [
      { title: "إدارة السيرفرات — TVCC" },
      { name: "description", content: "مراقبة موارد سيرفرات VPS وحالتها والمواقع المستضافة عليها من لوحة TVCC." },
      { property: "og:title", content: "إدارة السيرفرات — TVCC" },
      { property: "og:description", content: "مراقبة موارد سيرفرات VPS وحالتها والمواقع المستضافة عليها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const statusColor = (s: string) =>
  s === "online"
    ? "bg-success/20 text-success border-success/40"
    : s === "warning"
      ? "bg-warning/20 text-warning border-warning/40"
      : s === "pending"
        ? "bg-muted text-muted-foreground border-border"
        : "bg-destructive/20 text-destructive border-destructive/40";

function pct(used?: number | null, total?: number | null) {
  if (!used || !total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function ServersPage() {
  const qc = useQueryClient();
  const fetchServers = useServerFn(listServers);
  const create = useServerFn(createServer);
  const remove = useServerFn(deleteServer);
  const install = useServerFn(getAgentInstall);
  const detail = useServerFn(getServerDetail);
  const importModels = useServerFn(importServerModels);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", hostname: "", description: "", provider: "", region: "" });
  const [agent, setAgent] = useState<{ install: string; script: string; endpoint: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: servers, isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => fetchServers(),
    refetchInterval: 30000,
  });

  const { data: detailData } = useQuery({
    queryKey: ["server-detail", detailId],
    queryFn: () => detail({ data: { serverId: detailId! } }),
    enabled: !!detailId,
  });

  const addMutation = useMutation({
    mutationFn: () => create({ data: { ...form } }),
    onSuccess: async (row: any) => {
      toast.success("تمت إضافة السيرفر");
      setOpen(false);
      setForm({ name: "", hostname: "", description: "", provider: "", region: "" });
      qc.invalidateQueries({ queryKey: ["servers"] });
      if (row?.id) {
        const res = await install({ data: { serverId: row.id, origin: window.location.origin } });
        setAgent(res);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const list = (servers ?? []) as any[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" /> إدارة السيرفرات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            راقب موارد كل VPS والمواقع المستضافة عليه عبر وكيل خفيف يرسل القراءات كل دقيقة.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-1" /> إضافة سيرفر</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>سيرفر جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="hn-main-vps" /></div>
              <div><Label>المضيف / IP</Label><Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="203.0.113.10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>المزوّد</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Hetzner" /></div>
                <div><Label>المنطقة</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="fsn1" /></div>
              </div>
              <div><Label>وصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button
                className="w-full"
                disabled={!form.name || !form.hostname || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {agent && (
        <Card className="border-primary/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Terminal className="w-4 h-4 text-primary" /> تثبيت الوكيل على السيرفر</div>
            <p className="text-xs text-muted-foreground">نفّذ هذا الأمر على السيرفر بصلاحية root. الرمز سرّي — لا تشاركه.</p>
            <pre className="bg-muted/50 p-3 rounded-lg text-[11px] overflow-x-auto ltr text-left">{agent.install}</pre>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(agent.install)}><Copy className="w-3 h-3 ml-1" /> نسخ الأمر</Button>
              <Button size="sm" variant="outline" onClick={() => copy(agent.script)}><Copy className="w-3 h-3 ml-1" /> نسخ السكربت كاملاً</Button>
              <Button size="sm" variant="ghost" onClick={() => setAgent(null)}>إغلاق</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد سيرفرات بعد — أضف أول سيرفر لبدء المراقبة.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const m = s.metrics;
            return (
              <Card key={s.id} className="hover:border-primary/40 transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground ltr text-left">{s.hostname}</div>
                    </div>
                    <Badge variant="outline" className={statusColor(s.status)}>{s.status}</Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between mb-1"><span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> المعالج</span><span>{m?.cpu_percent != null ? `${Math.round(m.cpu_percent)}%` : "—"}</span></div>
                      <Progress value={m?.cpu_percent ?? 0} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1"><span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> الذاكرة</span><span>{m?.mem_total_mb ? `${Math.round(m.mem_used_mb)}/${Math.round(m.mem_total_mb)}MB` : "—"}</span></div>
                      <Progress value={pct(m?.mem_used_mb, m?.mem_total_mb)} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1"><span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> القرص</span><span>{m?.disk_total_gb ? `${Math.round(m.disk_used_gb)}/${Math.round(m.disk_total_gb)}GB` : "—"}</span></div>
                      <Progress value={pct(m?.disk_used_gb, m?.disk_total_gb)} className="h-1.5" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{s.website_count} موقع</span>
                    <span>{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString("ar") : "لم يتصل بعد"}</span>
                  </div>

                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(s.id)}>التفاصيل</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const res = await install({ data: { serverId: s.id, origin: window.location.origin } });
                        setAgent(res);
                      }}
                    >
                      <Terminal className="w-3 h-3 ml-1" /> الوكيل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const r: any = await importModels({ data: { serverId: s.id } });
                          toast.success(r.message ?? `تم استيراد ${r.added} نموذج`);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Brain className="w-3 h-3 ml-1" /> نماذج AI
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        await remove({ data: { serverId: s.id } });
                        qc.invalidateQueries({ queryKey: ["servers"] });
                        toast.success("تم الحذف");
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> {(detailData as any)?.server?.name ?? "تفاصيل السيرفر"}
            </DialogTitle>
          </DialogHeader>
          {!detailData ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["النظام", (detailData as any).server.os ?? "—"],
                  ["الوكيل", (detailData as any).server.agent_version ?? "—"],
                  ["القراءات (24س)", (detailData as any).metrics.length],
                  ["خدمات مكتشفة", (detailData as any).agentSites.length],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-lg border p-3">
                    <div className="text-[11px] text-muted-foreground">{k}</div>
                    <div className="font-semibold">{String(v)}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="font-semibold mb-2 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> خدمات/مواقع اكتشفها الوكيل</div>
                {(detailData as any).agentSites.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد بيانات بعد.</p>
                ) : (
                  <div className="space-y-1">
                    {(detailData as any).agentSites.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <span>{s.name} {s.domain ? <span className="text-muted-foreground ltr">({s.domain})</span> : null}</span>
                        <Badge variant="outline" className={statusColor(s.status)}>{s.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold mb-2">مواقع مرتبطة بلوحة التحكم</div>
                {(detailData as any).websites.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لم تُربط أي مواقع بهذا السيرفر بعد.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(detailData as any).websites.map((w: any) => (
                      <Badge key={w.id} variant="outline">{w.domain}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
