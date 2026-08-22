import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, RefreshCw, ShieldCheck, ShieldOff, Activity, Trash2, Plus, Link2, Boxes, Map, Globe,
} from "lucide-react";
import {
  getPortsHub, addManualPort, deletePort, setPortFirewall, checkPort, restartPortService,
  savePortLink, deletePortLink, applyPortLink, checkPortLink, runServiceTemplate, createPathProxy,
} from "@/lib/ports.functions";

type Props = {
  serverId: string;
  servers: any[];
  websites: any[];
  dryRun: boolean;
};

const stateBadge = (s?: string | null) =>
  s === "blocked"
    ? "bg-destructive/20 text-destructive border-destructive/40"
    : s === "closed"
      ? "bg-muted text-muted-foreground border-border"
      : "bg-success/20 text-success border-success/40";

export function PortsHub({ serverId, servers, websites, dryRun }: Props) {
  const qc = useQueryClient();
  const hub = useServerFn(getPortsHub);
  const addPort = useServerFn(addManualPort);
  const rmPort = useServerFn(deletePort);
  const firewall = useServerFn(setPortFirewall);
  const check = useServerFn(checkPort);
  const restart = useServerFn(restartPortService);
  const saveLink = useServerFn(savePortLink);
  const rmLink = useServerFn(deletePortLink);
  const applyLink = useServerFn(applyPortLink);
  const checkLink = useServerFn(checkPortLink);
  const runTemplate = useServerFn(runServiceTemplate);
  const pathProxy = useServerFn(createPathProxy);

  const [busy, setBusy] = useState<string | null>(null);
  const [newPort, setNewPort] = useState({ port: "", protocol: "tcp", serviceKind: "", note: "" });
  const [link, setLink] = useState({ sourcePort: "", targetServerId: "", targetHost: "", targetPort: "", bridgeKind: "tcp_forward" });
  const [proxy, setProxy] = useState({ port: "", domain: "", path: "/api", websocket: true, websiteId: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ports-hub", serverId],
    queryFn: () => hub({ data: { serverId } }),
    refetchInterval: 30000,
  });

  const ports = ((data as any)?.ports ?? []) as any[];
  const links = ((data as any)?.links ?? []) as any[];
  const templates = ((data as any)?.templates ?? []) as any[];
  const models = ((data as any)?.models ?? []) as any[];
  const services = ((data as any)?.services ?? []) as any[];

  const reload = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["server-ops", serverId] });
  };

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(dryRun ? `${msg} (محاكاة)` : msg);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  }

  return (
    <Tabs defaultValue="state" className="pt-1">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="state"><Activity className="w-3 h-3 ml-1" /> الحالة</TabsTrigger>
        <TabsTrigger value="bridges"><Link2 className="w-3 h-3 ml-1" /> الجسور</TabsTrigger>
        <TabsTrigger value="templates"><Boxes className="w-3 h-3 ml-1" /> القوالب</TabsTrigger>
        <TabsTrigger value="map"><Map className="w-3 h-3 ml-1" /> الخريطة</TabsTrigger>
      </TabsList>

      {/* ---------------------------------------------------------- state */}
      <TabsContent value="state" className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">حالة كل منفذ مع التحكم في الجدار الناري واختبار الوصول.</span>
          <Button size="sm" variant="outline" onClick={reload}>
            <RefreshCw className="w-3 h-3 ml-1" /> تحديث
          </Button>
        </div>

        <div className="grid gap-1">
          {ports.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد منافذ مسجّلة بعد — أضف منفذاً يدوياً أو شغّل فحص المنافذ.</p>
          ) : ports.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span dir="ltr" className="font-mono">{p.address ?? "0.0.0.0"}:{p.port}/{p.protocol}</span>
              <Badge variant="outline" className={stateBadge(p.state)}>
                {p.state === "blocked" ? "محجوب" : p.state === "closed" ? "مغلق" : "مفتوح"}
              </Badge>
              {p.service_kind ? <Badge variant="outline">{p.service_kind}</Badge> : null}
              <span className="text-muted-foreground">{p.note ?? p.process_name ?? "—"}</span>
              <div className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={busy === `fw-${p.id}`}
                  onClick={() => run(`fw-${p.id}`, () => firewall({ data: { serverId, port: p.port, protocol: p.protocol ?? "tcp", open: p.state === "blocked", portRowId: p.id, dryRun } }), p.state === "blocked" ? "تم طلب فتح المنفذ" : "تم طلب إغلاق المنفذ")}>
                  {p.state === "blocked" ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === `ck-${p.id}`}
                  onClick={() => run(`ck-${p.id}`, () => check({ data: { serverId, port: p.port } }), "تم جدولة اختبار المنفذ")}>
                  <Activity className="w-3 h-3" />
                </Button>
                {p.process_name ? (
                  <Button size="sm" variant="ghost" disabled={busy === `rs-${p.id}`}
                    onClick={() => run(`rs-${p.id}`, () => restart({ data: { serverId, name: p.process_name, dryRun } }), "تم جدولة إعادة تشغيل الخدمة")}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                ) : null}
                {p.managed ? (
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === `rm-${p.id}`}
                    onClick={() => run(`rm-${p.id}`, () => rmPort({ data: { portRowId: p.id } }), "تم حذف المنفذ")}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium">إضافة منفذ يدوياً</p>
          <div className="grid gap-2 md:grid-cols-4">
            <Input dir="ltr" placeholder="8080" value={newPort.port} onChange={(e) => setNewPort({ ...newPort, port: e.target.value })} className="h-8 text-xs" />
            <Select value={newPort.protocol} onValueChange={(v) => setNewPort({ ...newPort, protocol: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="tcp">tcp</SelectItem><SelectItem value="udp">udp</SelectItem></SelectContent>
            </Select>
            <Input placeholder="نوع الخدمة (web/ai/db)" value={newPort.serviceKind} onChange={(e) => setNewPort({ ...newPort, serviceKind: e.target.value })} className="h-8 text-xs" />
            <Input placeholder="وصف" value={newPort.note} onChange={(e) => setNewPort({ ...newPort, note: e.target.value })} className="h-8 text-xs" />
          </div>
          <Button size="sm" disabled={!newPort.port || busy === "add"}
            onClick={() => run("add", async () => {
              await addPort({ data: { serverId, port: Number(newPort.port), protocol: newPort.protocol, serviceKind: newPort.serviceKind || undefined, note: newPort.note || undefined } });
              setNewPort({ port: "", protocol: "tcp", serviceKind: "", note: "" });
            }, "تمت إضافة المنفذ")}>
            <Plus className="w-3 h-3 ml-1" /> إضافة
          </Button>
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1"><Globe className="w-3 h-3" /> ربط منفذ بمسار على نطاق</p>
          <div className="grid gap-2 md:grid-cols-4">
            <Input dir="ltr" placeholder="المنفذ" value={proxy.port} onChange={(e) => setProxy({ ...proxy, port: e.target.value })} className="h-8 text-xs" />
            <Select value={proxy.websiteId} onValueChange={(v) => {
              const w = websites.find((x: any) => x.id === v);
              setProxy({ ...proxy, websiteId: v, domain: w?.domain ?? "" });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="الموقع" /></SelectTrigger>
              <SelectContent>
                {websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input dir="ltr" placeholder="/api" value={proxy.path} onChange={(e) => setProxy({ ...proxy, path: e.target.value })} className="h-8 text-xs" />
            <Select value={proxy.websocket ? "1" : "0"} onValueChange={(v) => setProxy({ ...proxy, websocket: v === "1" })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">WebSocket مفعّل</SelectItem><SelectItem value="0">بدون WebSocket</SelectItem></SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!proxy.port || !proxy.domain || busy === "proxy"}
            onClick={() => run("proxy", () => pathProxy({ data: { serverId, port: Number(proxy.port), domain: proxy.domain, path: proxy.path, websocket: proxy.websocket, websiteId: proxy.websiteId || null, issueSsl: true, dryRun } }), "تم جدولة البروكسي وطلب الشهادة")}>
            تطبيق البروكسي
          </Button>
        </div>
      </TabsContent>

      {/* -------------------------------------------------------- bridges */}
      <TabsContent value="bridges" className="space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">اربط منفذاً على هذا السيرفر بمنفذ على سيرفر آخر (جسر TCP عبر socat).</p>
        <div className="grid gap-1">
          {links.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد جسور بعد.</p> : links.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span dir="ltr" className="font-mono">:{l.source_port} → {l.target_host}:{l.target_port}</span>
              <Badge variant="outline">{l.bridge_kind}</Badge>
              <Badge variant="outline" className={l.status === "active" ? stateBadge("open") : ""}>{l.status}</Badge>
              <div className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={busy === `ap-${l.id}`}
                  onClick={() => run(`ap-${l.id}`, () => applyLink({ data: { id: l.id, dryRun } }), "تم جدولة تفعيل الجسر")}>تفعيل</Button>
                <Button size="sm" variant="ghost" disabled={busy === `cl-${l.id}`}
                  onClick={() => run(`cl-${l.id}`, () => checkLink({ data: { id: l.id } }), "تم جدولة فحص الجسر")}>فحص</Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === `dl-${l.id}`}
                  onClick={() => run(`dl-${l.id}`, () => rmLink({ data: { id: l.id } }), "تم حذف الجسر")}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium">جسر جديد</p>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[10px]">المنفذ المحلي</Label>
              <Input dir="ltr" value={link.sourcePort} onChange={(e) => setLink({ ...link, sourcePort: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">السيرفر الهدف</Label>
              <Select value={link.targetServerId} onValueChange={(v) => setLink({ ...link, targetServerId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختياري" /></SelectTrigger>
                <SelectContent>
                  {servers.filter((s: any) => s.id !== serverId).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">أو مضيف مباشر</Label>
              <Input dir="ltr" placeholder="10.0.0.5" value={link.targetHost} onChange={(e) => setLink({ ...link, targetHost: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">المنفذ الهدف</Label>
              <Input dir="ltr" value={link.targetPort} onChange={(e) => setLink({ ...link, targetPort: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button size="sm" disabled={!link.sourcePort || !link.targetPort || busy === "link"}
            onClick={() => run("link", async () => {
              await saveLink({ data: {
                sourceServerId: serverId,
                sourcePort: Number(link.sourcePort),
                targetServerId: link.targetServerId || null,
                targetHost: link.targetHost || null,
                targetPort: Number(link.targetPort),
                bridgeKind: link.bridgeKind,
              } });
              setLink({ sourcePort: "", targetServerId: "", targetHost: "", targetPort: "", bridgeKind: "tcp_forward" });
            }, "تم حفظ الجسر")}>
            <Plus className="w-3 h-3 ml-1" /> حفظ الجسر
          </Button>
        </div>
      </TabsContent>

      {/* ------------------------------------------------------ templates */}
      <TabsContent value="templates" className="space-y-2 pt-3">
        <p className="text-xs text-muted-foreground">تشغيل خدمة جاهزة على منفذها بضغطة — يُنفَّذ عبر الوكيل ويُفتح المنفذ تلقائياً.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {templates.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded border p-2 text-xs">
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-muted-foreground" dir="ltr">:{t.port} · {t.kind}</p>
              </div>
              <Button size="sm" variant="outline" disabled={busy === `tpl-${t.id}`}
                onClick={() => run(`tpl-${t.id}`, () => runTemplate({ data: { serverId, templateId: t.id, dryRun } }), "تم جدولة تشغيل الخدمة")}>
                {busy === `tpl-${t.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "تشغيل"}
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* ------------------------------------------------------------ map */}
      <TabsContent value="map" className="space-y-3 pt-3">
        <div className="rounded border p-3 space-y-2 text-xs">
          <p className="font-medium">خريطة المنافذ</p>
          {ports.length === 0 ? <p className="text-muted-foreground">لا توجد بيانات كافية.</p> : ports.map((p) => {
            const svc = services.find((s: any) => (s.metadata as any)?.port === p.port);
            const mdl = models.filter((m: any) => m.port === p.port);
            const out = links.filter((l: any) => l.source_port === p.port);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded bg-muted/40 p-2">
                <Badge variant="outline" className={stateBadge(p.state)} >:{p.port}</Badge>
                <span className="text-muted-foreground">←</span>
                <span>{svc ? svc.name : p.note ?? p.process_name ?? "غير مرتبط"}</span>
                {mdl.length ? <Badge variant="outline">{mdl.length} نموذج</Badge> : null}
                {out.map((l: any) => (
                  <Badge key={l.id} variant="outline" dir="ltr">→ {l.target_host}:{l.target_port}</Badge>
                ))}
              </div>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );
}
