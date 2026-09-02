import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Zap, Activity, Trash2, RefreshCw } from "lucide-react";
import {
  getMeshOverview, setupVpnNode, linkVpnPeers, checkVpn, removeVpnPeer,
  saveAutomationRule, deleteAutomationRule, evaluateServerHealth,
} from "@/lib/mesh-vpn.functions";

const METRICS = [
  { v: "cpu_percent", l: "نسبة المعالج" },
  { v: "memory_percent", l: "نسبة الذاكرة" },
  { v: "disk_percent", l: "امتلاء القرص" },
  { v: "services_down", l: "خدمات متوقفة" },
  { v: "ports_down", l: "منافذ معطّلة" },
  { v: "health_score", l: "مؤشر الصحة" },
  { v: "heartbeat_age_seconds", l: "عمر آخر نبضة (ث)" },
];

const ACTIONS = [
  { v: "service_restart", l: "إعادة تشغيل خدمة" },
  { v: "nginx_reload", l: "إعادة تحميل Nginx" },
  { v: "site_backup", l: "نسخة احتياطية" },
  { v: "storage_sync", l: "مزامنة التخزين" },
  { v: "disk_usage", l: "تقرير القرص" },
  { v: "restore_all", l: "استعادة كل الخدمات" },
];

export function MeshPanel({ serverId }: { serverId: string }) {
  const overviewFn = useServerFn(getMeshOverview);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["mesh-overview", serverId],
    queryFn: () => overviewFn({ data: { serverId } }),
    refetchInterval: 60_000,
  });

  const setupFn = useServerFn(setupVpnNode);
  const linkFn = useServerFn(linkVpnPeers);
  const checkFn = useServerFn(checkVpn);
  const removeFn = useServerFn(removeVpnPeer);
  const saveRuleFn = useServerFn(saveAutomationRule);
  const delRuleFn = useServerFn(deleteAutomationRule);
  const healthFn = useServerFn(evaluateServerHealth);

  const [ip, setIp] = useState("10.77.0.2");
  const [iface, setIface] = useState("wg0");
  const [peerServer, setPeerServer] = useState("");
  const [peerKey, setPeerKey] = useState("");
  const [peerIp, setPeerIp] = useState("10.77.0.3");
  const [peerEndpoint, setPeerEndpoint] = useState("");

  const [ruleName, setRuleName] = useState("");
  const [metric, setMetric] = useState("disk_percent");
  const [comparator, setComparator] = useState("gt");
  const [threshold, setThreshold] = useState("90");
  const [action, setAction] = useState("disk_usage");

  const ok = (msg: string) => () => { toast.success(msg); refetch(); };
  const fail = (e: any) => toast.error(e?.message ?? "فشلت العملية");

  const setup = useMutation({ mutationFn: (v: any) => setupFn({ data: v }), onSuccess: ok("تم إرسال أمر تهيئة الشبكة الخاصة"), onError: fail });
  const link = useMutation({ mutationFn: (v: any) => linkFn({ data: v }), onSuccess: ok("تم إرسال أمر ربط القرين"), onError: fail });
  const check = useMutation({ mutationFn: (v: any) => checkFn({ data: v }), onSuccess: ok("تم طلب حالة الشبكة"), onError: fail });
  const drop = useMutation({ mutationFn: (v: any) => removeFn({ data: v }), onSuccess: ok("تم حذف القرين"), onError: fail });
  const saveRule = useMutation({ mutationFn: (v: any) => saveRuleFn({ data: v }), onSuccess: ok("تم حفظ القاعدة"), onError: fail });
  const delRule = useMutation({ mutationFn: (v: any) => delRuleFn({ data: v }), onSuccess: ok("تم حذف القاعدة"), onError: fail });
  const evalHealth = useMutation({
    mutationFn: () => healthFn({ data: { serverId } }),
    onSuccess: (r: any) => { toast.success(`مؤشر الصحة ${r.score}/100${r.triggered?.length ? ` · قواعد نُفّذت: ${r.triggered.join("، ")}` : ""}`); refetch(); },
    onError: fail,
  });

  const peers = data?.peers ?? [];
  const rules = data?.rules ?? [];
  const health = data?.health ?? [];
  const boots = data?.boots ?? [];
  const others = (data?.servers ?? []).filter((x: any) => x.id !== serverId);
  const latest: any = health[0];

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* VPN */}
        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> الشبكة الخاصة بين السيرفرات (WireGuard)</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">العنوان الداخلي</Label><Input dir="ltr" value={ip} onChange={(e) => setIp(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">الواجهة</Label><Input dir="ltr" value={iface} onChange={(e) => setIface(e.target.value)} className="mt-1" /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={setup.isPending} onClick={() => setup.mutate({ serverId, internalIp: ip, interfaceName: iface })}>تهيئة العقدة</Button>
            <Button size="sm" variant="outline" onClick={() => setup.mutate({ serverId, internalIp: ip, interfaceName: iface, dryRun: true })}>محاكاة</Button>
            <Button size="sm" variant="ghost" onClick={() => check.mutate({ serverId, interfaceName: iface })}><RefreshCw className="w-4 h-4 ml-1" /> فحص</Button>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-xs">ربط قرين</Label>
            <Select value={peerServer} onValueChange={setPeerServer}>
              <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
              <SelectContent>{others.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input dir="ltr" placeholder="المفتاح العام للقرين" value={peerKey} onChange={(e) => setPeerKey(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input dir="ltr" placeholder="10.77.0.3" value={peerIp} onChange={(e) => setPeerIp(e.target.value)} />
              <Input dir="ltr" placeholder="host:51820" value={peerEndpoint} onChange={(e) => setPeerEndpoint(e.target.value)} />
            </div>
            <Button size="sm" disabled={!peerServer || !peerKey || link.isPending}
              onClick={() => link.mutate({ serverId, peerServerId: peerServer, peerPublicKey: peerKey, peerInternalIp: peerIp, endpoint: peerEndpoint || null, interfaceName: iface })}>
              ربط القرين
            </Button>
          </div>

          <div className="space-y-1">
            {isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> :
              peers.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عُقد بعد.</p> :
                peers.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-secondary/30 rounded px-2 py-1.5">
                    <span dir="ltr" className="font-mono">{p.interface} · {p.internal_ip}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{p.status}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => drop.mutate({ peerId: p.id })}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </span>
                  </div>
                ))}
          </div>
        </CardContent></Card>

        {/* Automation + health */}
        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4" /> القواعد التلقائية ومؤشر الصحة</h3>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" disabled={evalHealth.isPending} onClick={() => evalHealth.mutate()}>
              <Activity className="w-4 h-4 ml-1" /> احسب مؤشر الصحة الآن
            </Button>
            {latest ? <Badge variant="outline">آخر لقطة: {latest.score}/100 · {latest.level}</Badge> : null}
          </div>
          {latest?.reasons?.length ? (
            <ul className="text-xs text-muted-foreground list-disc pr-4">
              {latest.reasons.map((r: any, i: number) => <li key={i}>{r.label} (−{r.penalty})</li>)}
            </ul>
          ) : null}

          <div className="border-t border-border pt-3 space-y-2">
            <Input placeholder="اسم القاعدة" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={comparator} onValueChange={setComparator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="gt">أكبر من</SelectItem><SelectItem value="lt">أصغر من</SelectItem></SelectContent>
              </Select>
              <Input dir="ltr" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" disabled={!ruleName || saveRule.isPending}
              onClick={() => { saveRule.mutate({ serverId, name: ruleName, metric, comparator, threshold: Number(threshold), action }); setRuleName(""); }}>
              حفظ القاعدة
            </Button>
          </div>

          <div className="space-y-1">
            {rules.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد قواعد.</p> :
              rules.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-xs bg-secondary/30 rounded px-2 py-1.5">
                  <span>{r.name} — {r.metric} {r.comparator === "lt" ? "<" : ">"} {r.threshold} ⇒ {r.action}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{r.trigger_count} مرة</Badge>
                    <Button size="icon" variant="ghost" onClick={() => delRule.mutate({ id: r.id })}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </span>
                </div>
              ))}
          </div>
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-4 space-y-2">
        <h3 className="font-semibold">تقارير الاستعادة بعد الإقلاع</h3>
        {boots.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد تقارير بعد.</p> :
          boots.map((b: any) => (
            <div key={b.id} className="text-xs bg-secondary/30 rounded px-2 py-1.5 flex justify-between">
              <span dir="ltr">{new Date(b.created_at).toLocaleString("ar")} · {b.agent_version || "—"}</span>
              <span>نجح {(b.restored ?? []).length} · فشل {(b.failed ?? []).length}</span>
            </div>
          ))}
      </CardContent></Card>
    </div>
  );
}
