import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Network, HardDrive, Play, RefreshCw, Trash2, Cable, ArrowUpCircle } from "lucide-react";
import {
  getBridgeOverview, createTunnel, publishTunnelDomain, checkTunnel, dropTunnel,
  registerStorageSync, runStorageSync, removeStorageSync, upgradeAgent,
} from "@/lib/bridge.functions";

export const Route = createFileRoute("/_authenticated/bridge")({
  component: BridgePage,
  head: () => ({
    meta: [
      { title: "الجسر: أنفاق وتخزين — TVCC" },
      { name: "description", content: "ربط السيرفرات المحلية ببوابة VPS ونسخ المواقع إلى سيرفر التخزين تلقائياً." },
    ],
  }),
});

function BridgePage() {
  const qc = useQueryClient();
  const load = useServerFn(getBridgeOverview);
  const mkTunnel = useServerFn(createTunnel);
  const publish = useServerFn(publishTunnelDomain);
  const check = useServerFn(checkTunnel);
  const drop = useServerFn(dropTunnel);
  const regSync = useServerFn(registerStorageSync);
  const runSync = useServerFn(runStorageSync);
  const rmSync = useServerFn(removeStorageSync);
  const upgrade = useServerFn(upgradeAgent);

  const { data } = useQuery({
    queryKey: ["bridge"],
    queryFn: () => load({}),
    refetchInterval: 20000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["bridge"] });

  const [t, setT] = useState({ name: "", localServerId: "", gatewayServerId: "", localPort: "3000", gatewayPort: "9000", publicDomain: "" });
  const [s, setS] = useState({ websiteId: "", storageServerId: "", sourceServerId: "" });

  const submitTunnel = async () => {
    try {
      await mkTunnel({
        data: {
          name: t.name || `tunnel-${Date.now()}`,
          localServerId: t.localServerId,
          gatewayServerId: t.gatewayServerId,
          localPort: Number(t.localPort),
          gatewayPort: Number(t.gatewayPort),
          publicDomain: t.publicDomain || null,
        },
      });
      toast.success("تم إنشاء النفق وإرسال الأمر للسيرفر المحلي");
      refresh();
    } catch (e: any) { toast.error(e.message ?? "فشل إنشاء النفق"); }
  };

  const submitSync = async () => {
    const site = (data?.websites ?? []).find((w: any) => w.id === s.websiteId);
    if (!site) return toast.error("اختر موقعاً");
    try {
      await regSync({
        data: {
          websiteId: site.id,
          domain: site.domain,
          storageServerId: s.storageServerId,
          sourceServerId: s.sourceServerId || null,
        },
      });
      toast.success("تم تسجيل الموقع في سيرفر التخزين");
      refresh();
    } catch (e: any) { toast.error(e.message ?? "فشل التسجيل"); }
  };

  const servers = data?.servers ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Cable className="h-6 w-6 text-primary" /> جسر المحلي ← VPS والتخزين
        </h1>
        <p className="text-sm text-muted-foreground">أنفاق آمنة لنشر المواقع المحلية على الإنترنت، ونسخ تلقائي لكل موقع في سيرفر التخزين.</p>
      </div>

      <Tabs defaultValue="tunnels" dir="rtl">
        <TabsList>
          <TabsTrigger value="tunnels"><Network className="ml-1 h-4 w-4" /> الأنفاق</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="ml-1 h-4 w-4" /> التخزين</TabsTrigger>
          <TabsTrigger value="agents"><ArrowUpCircle className="ml-1 h-4 w-4" /> الوكلاء</TabsTrigger>
        </TabsList>

        <TabsContent value="tunnels" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">نفق جديد</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="site1" />
              </div>
              <div className="space-y-1">
                <Label>السيرفر المحلي</Label>
                <Select value={t.localServerId} onValueChange={(v) => setT({ ...t, localServerId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>بوابة VPS</Label>
                <Select value={t.gatewayServerId} onValueChange={(v) => setT({ ...t, gatewayServerId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name} — {x.public_ip ?? x.hostname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>المنفذ المحلي</Label>
                <Input type="number" value={t.localPort} onChange={(e) => setT({ ...t, localPort: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>منفذ البوابة</Label>
                <Input type="number" value={t.gatewayPort} onChange={(e) => setT({ ...t, gatewayPort: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>النطاق العام (اختياري)</Label>
                <Input value={t.publicDomain} onChange={(e) => setT({ ...t, publicDomain: e.target.value })} placeholder="site.example.com" />
              </div>
              <div className="md:col-span-3">
                <Button onClick={submitTunnel}><Play className="ml-1 h-4 w-4" /> إنشاء النفق</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {(data?.tunnels ?? []).map((x: any) => (
              <Card key={x.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{x.name}</span>
                    <Badge variant="outline">{x.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    local:{x.local_port} → gateway:{x.gateway_port} {x.public_domain ? `→ ${x.public_domain}` : ""}
                  </p>
                  {x.last_output && <pre dir="ltr" className="max-h-28 overflow-auto rounded bg-muted p-2 text-xs">{x.last_output}</pre>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={async () => { await check({ data: { tunnelId: x.id } }); toast.success("تم طلب فحص الحالة"); refresh(); }}>
                      <RefreshCw className="ml-1 h-4 w-4" /> فحص
                    </Button>
                    <Button size="sm" onClick={async () => {
                      const d = x.public_domain || window.prompt("النطاق العام؟") || "";
                      if (!d) return;
                      await publish({ data: { tunnelId: x.id, domain: d, ssl: true } });
                      toast.success("تم إرسال أمر النشر إلى البوابة");
                      refresh();
                    }}>نشر عبر البوابة</Button>
                    <Button size="sm" variant="destructive" onClick={async () => { await drop({ data: { tunnelId: x.id } }); refresh(); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">تسجيل موقع في التخزين</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1 md:col-span-2">
                <Label>الموقع</Label>
                <Select value={s.websiteId} onValueChange={(v) => setS({ ...s, websiteId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(data?.websites ?? []).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>سيرفر التخزين</Label>
                <Select value={s.storageServerId} onValueChange={(v) => setS({ ...s, storageServerId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name} ({x.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>سيرفر المصدر</Label>
                <Select value={s.sourceServerId} onValueChange={(v) => setS({ ...s, sourceServerId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4">
                <Button onClick={submitSync}><HardDrive className="ml-1 h-4 w-4" /> تسجيل ومزامنة</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {(data?.syncs ?? []).map((x: any) => (
              <Card key={x.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{x.domain}</span>
                    <Badge variant="outline">{x.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground" dir="ltr">{x.source_path} → {x.storage_path}</p>
                  {x.last_synced_at && <p className="text-xs text-muted-foreground">آخر مزامنة: {new Date(x.last_synced_at).toLocaleString("ar")}</p>}
                  {x.last_output && <pre dir="ltr" className="max-h-28 overflow-auto rounded bg-muted p-2 text-xs">{x.last_output}</pre>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => { await runSync({ data: { syncId: x.id } }); toast.success("بدأت المزامنة"); refresh(); }}>
                      <RefreshCw className="ml-1 h-4 w-4" /> مزامنة الآن
                    </Button>
                    <Button size="sm" variant="outline" onClick={async () => { await runSync({ data: { syncId: x.id, dryRun: true } }); toast.success("محاكاة"); refresh(); }}>محاكاة</Button>
                    <Button size="sm" variant="destructive" onClick={async () => { await rmSync({ data: { syncId: x.id, prune: true } }); refresh(); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-3">
          {servers.map((x: any) => (
            <Card key={x.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{x.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {x.public_ip ?? x.hostname} · agent {x.agent_version ?? "—"} · {x.last_seen_at ? new Date(x.last_seen_at).toLocaleString("ar") : "بدون نبض"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={async () => {
                  await upgrade({ data: { serverId: x.id, origin: window.location.origin } });
                  toast.success("تم إرسال أمر تحديث الوكيل إلى 3.4.0");
                }}>
                  <ArrowUpCircle className="ml-1 h-4 w-4" /> تحديث الوكيل
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
