import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Network, Cloud, Laptop, Loader2, Link2, Trash2, RefreshCw, Boxes, Plug, Rocket, Server, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMesh, saveServerLink, deleteServerLink, checkServerLink, setServerNetwork,
  setClusterPrimary, syncCluster, listConnectables, connectService, disconnectService,
  provisionSite, listSiteProvisioning,
} from "@/lib/mesh.functions";

export const Route = createFileRoute("/_authenticated/network")({
  component: NetworkPage,
  head: () => ({
    meta: [
      { title: "شبكة السيرفرات والخدمات — TVCC" },
      { name: "description", content: "اربط السيرفرات المحلية والسحابية، وأنشئ عناقيد المواقع، واربط الخدمات والمنافذ بمواقعك من مركز واحد." },
      { property: "og:title", content: "شبكة السيرفرات والخدمات — TVCC" },
      { property: "og:description", content: "ربط السيرفرات المحلية والسحابية وعناقيد المواقع والخدمات في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STEP_LABELS: Record<string, string> = {
  dns_verify: "التحقق من DNS",
  site_dir: "مجلد الموقع",
  storage: "التخزين",
  nginx: "إعداد Nginx",
  ssl: "شهادة SSL",
  register_service: "تسجيل الخدمة",
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    online: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    connected: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    running: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    checking: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    offline: "bg-destructive/20 text-destructive border-destructive/40",
    failed: "bg-destructive/20 text-destructive border-destructive/40",
  };
  return map[s] ?? "bg-muted text-muted-foreground border-border";
}

function NetworkPage() {
  const qc = useQueryClient();
  const fetchMesh = useServerFn(getMesh);
  const fetchConnectables = useServerFn(listConnectables);
  const saveLink = useServerFn(saveServerLink);
  const dropLink = useServerFn(deleteServerLink);
  const probeLink = useServerFn(checkServerLink);
  const setNetwork = useServerFn(setServerNetwork);
  const makePrimary = useServerFn(setClusterPrimary);
  const doSync = useServerFn(syncCluster);
  const doConnect = useServerFn(connectService);
  const doDisconnect = useServerFn(disconnectService);
  const doProvision = useServerFn(provisionSite);
  const fetchProvisioning = useServerFn(listSiteProvisioning);

  const mesh = useQuery({ queryKey: ["mesh"], queryFn: () => fetchMesh({}) });
  const conn = useQuery({ queryKey: ["connectables"], queryFn: () => fetchConnectables({}) });
  const prov = useQuery({
    queryKey: ["provisioning"],
    queryFn: () => fetchProvisioning({ data: {} }),
  });

  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [channel, setChannel] = useState("public");
  const [port, setPort] = useState("22");
  const [busy, setBusy] = useState(false);

  const [consumer, setConsumer] = useState("");
  const [serviceId, setServiceId] = useState("");

  const [provSite, setProvSite] = useState("");
  const [provServer, setProvServer] = useState("");
  const [provPort, setProvPort] = useState("3000");

  const servers = (mesh.data?.servers ?? []) as any[];
  const links = (mesh.data?.links ?? []) as any[];
  const clusters = (mesh.data?.clusters ?? []) as any[];
  const stats = mesh.data?.stats;
  const services = (conn.data?.services ?? []) as any[];
  const deps = (conn.data?.dependencies ?? []) as any[];
  const websites = (conn.data?.websites ?? []) as any[];

  const siteName = (id: string) => websites.find((w) => w.id === id)?.name ?? "—";

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["mesh"] });
      qc.invalidateQueries({ queryKey: ["connectables"] });
      qc.invalidateQueries({ queryKey: ["provisioning"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Network className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">شبكة السيرفرات والخدمات</h1>
          <p className="text-sm text-muted-foreground">
            اربط السيرفرات المحلية بالسحابية، وزامن نسخ المواقع، واربط الخدمات بضغطة واحدة.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "سيرفرات", value: stats?.total ?? 0 },
          { label: "محلية", value: stats?.local ?? 0 },
          { label: "سحابية", value: stats?.cloud ?? 0 },
          { label: "عُقد TVCC", value: stats?.tvccNodes ?? 0 },
          { label: "روابط نشطة", value: stats?.activeLinks ?? 0 },
          { label: "عناقيد", value: stats?.clusters ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="links">
        <TabsList>
          <TabsTrigger value="links"><Link2 className="w-4 h-4 ml-1" /> الروابط</TabsTrigger>
          <TabsTrigger value="clusters"><Boxes className="w-4 h-4 ml-1" /> العناقيد</TabsTrigger>
          <TabsTrigger value="services"><Plug className="w-4 h-4 ml-1" /> الخدمات</TabsTrigger>
          <TabsTrigger value="provision"><Rocket className="w-4 h-4 ml-1" /> تجهيز موقع</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- links */}
        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-5 gap-3 items-end">
              <div>
                <Label>من سيرفر</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>إلى سيرفر</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>القناة</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">عام (IP عام)</SelectItem>
                    <SelectItem value="local">شبكة محلية (IP خاص)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المنفذ</Label>
                <Input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
              </div>
              <Button
                disabled={busy || !source || !target}
                onClick={() => run(
                  () => saveLink({ data: { sourceServerId: source, targetServerId: target, channel, targetPort: Number(port) || 22 } }),
                  "تم إنشاء الرابط",
                )}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 ml-1" />} ربط
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {servers.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                  {s.network_kind === "local"
                    ? <Laptop className="w-4 h-4 text-emerald-400" />
                    : <Cloud className="w-4 h-4 text-blue-400" />}
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.public_ip || s.hostname}</span>
                  {s.private_ip ? <span className="text-xs text-muted-foreground">محلي: {s.private_ip}</span> : null}
                  {s.is_tvcc_node ? <Badge className="bg-primary/20 text-primary border-primary/40">عقدة TVCC</Badge> : null}
                  <Badge className={statusBadge(s.status)}>{s.status}</Badge>
                  <div className="ms-auto flex gap-2">
                    <Select
                      value={s.network_kind ?? "cloud"}
                      onValueChange={(v) => run(() => setNetwork({ data: { serverId: s.id, networkKind: v } }), "تم تحديث نوع الشبكة")}
                    >
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cloud">سحابي</SelectItem>
                        <SelectItem value="local">محلي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-2">
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد روابط بعد.</p>
            ) : links.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{l.source_name}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{l.target_name}</span>
                  <span className="text-xs text-muted-foreground">:{l.target_port} ({l.channel})</span>
                  <Badge className={statusBadge(l.status)}>{l.status}</Badge>
                  {l.latency_ms ? <span className="text-xs">{l.latency_ms}ms</span> : null}
                  <div className="ms-auto flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => run(() => probeLink({ data: { linkId: l.id } }), "تم إرسال فحص الاتصال")}>
                      <RefreshCw className="w-3 h-3 ml-1" /> فحص
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy}
                      onClick={() => run(() => dropLink({ data: { linkId: l.id } }), "تم حذف الرابط")}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- clusters */}
        <TabsContent value="clusters" className="space-y-3">
          {clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا توجد عناقيد بعد — تُنشأ تلقائياً عندما يرسل وكيل السيرفر نفس الموقع من أكثر من سيرفر.
            </p>
          ) : clusters.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Boxes className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{c.name}</span>
                  <Badge className={statusBadge(c.status)}>{c.status}</Badge>
                  <span className="text-xs text-muted-foreground">{c.members.length} نسخة</span>
                  <div className="ms-auto flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => run(() => doSync({ data: { clusterId: c.id, dryRun: true } }), "محاكاة المزامنة في الطابور")}>
                      محاكاة
                    </Button>
                    <Button size="sm" disabled={busy}
                      onClick={() => run(() => doSync({ data: { clusterId: c.id } }), "تمت جدولة المزامنة")}>
                      <RefreshCw className="w-3 h-3 ml-1" /> مزامنة
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {c.members.map((m: any) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 text-sm border border-border rounded-md p-2">
                      <span>{m.server_name}</span>
                      <span className="text-xs text-muted-foreground">{m.domain}</span>
                      <Badge className={m.role === "primary" ? "bg-primary/20 text-primary border-primary/40" : ""}>
                        {m.role === "primary" ? "أساسي" : "نسخة"}
                      </Badge>
                      {m.role !== "primary" ? (
                        <Button size="sm" variant="ghost" className="ms-auto" disabled={busy}
                          onClick={() => run(() => makePrimary({ data: { clusterId: c.id, serverId: m.server_id } }), "تم تعيين السيرفر الأساسي")}>
                          <CheckCircle2 className="w-3 h-3 ml-1" /> اجعله أساسياً
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ---------------------------------------------------- services */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-3 gap-3 items-end">
              <div>
                <Label>الموقع المستهلك</Label>
                <Select value={consumer} onValueChange={setConsumer}>
                  <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent>
                    {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الخدمة</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger><SelectValue placeholder="اختر خدمة" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.service_type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={busy || !consumer || !serviceId}
                onClick={() => run(
                  () => doConnect({ data: { consumerWebsiteId: consumer, serviceId } }),
                  "تم الربط وحُقنت الإعدادات تلقائياً",
                )}
              >
                <Plug className="w-4 h-4 ml-1" /> ربط بضغطة واحدة
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            {deps.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد ارتباطات بين المواقع بعد.</p>
            ) : deps.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{siteName(d.consumer_website_id)}</span>
                  <span className="text-muted-foreground">يستخدم</span>
                  <span className="font-medium">
                    {services.find((s) => s.id === d.service_id)?.name ?? siteName(d.provider_website_id)}
                  </span>
                  <Badge className={statusBadge(d.status)}>{d.status}</Badge>
                  <Button size="sm" variant="ghost" className="ms-auto" disabled={busy}
                    onClick={() => run(() => doDisconnect({ data: { dependencyId: d.id } }), "تم فك الربط")}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* --------------------------------------------------- provision */}
        <TabsContent value="provision" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-4 gap-3 items-end">
              <div>
                <Label>الموقع</Label>
                <Select value={provSite} onValueChange={setProvSite}>
                  <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent>
                    {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>السيرفر</Label>
                <Select value={provServer} onValueChange={setProvServer}>
                  <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>منفذ التطبيق</Label>
                <Input value={provPort} onChange={(e) => setProvPort(e.target.value)} inputMode="numeric" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy || !provSite || !provServer}
                  onClick={() => run(
                    () => doProvision({ data: { websiteId: provSite, serverId: provServer, port: Number(provPort) || 3000, dryRun: true } }),
                    "محاكاة التجهيز في الطابور",
                  )}>
                  محاكاة
                </Button>
                <Button disabled={busy || !provSite || !provServer}
                  onClick={() => run(
                    () => doProvision({ data: { websiteId: provSite, serverId: provServer, port: Number(provPort) || 3000 } }),
                    "بدأ التجهيز التلقائي",
                  )}>
                  <Rocket className="w-4 h-4 ml-1" /> تجهيز
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            {((prov.data ?? []) as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد عمليات تجهيز بعد.</p>
            ) : ((prov.data ?? []) as any[]).map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{siteName(p.website_id)}</span>
                  <span>{STEP_LABELS[p.step] ?? p.step}</span>
                  <Badge className={statusBadge(p.status)}>{p.status}</Badge>
                  <span className="text-xs text-muted-foreground truncate max-w-md">{p.detail}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
