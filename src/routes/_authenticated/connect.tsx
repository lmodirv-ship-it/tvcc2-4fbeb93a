import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Link2, Database, Boxes, Trash2, Plug, Cloud, Server, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  getConnectHub, registerService, deleteService, linkDatabase, unlinkDatabase,
  testConnection, listConnectionEvents,
} from "@/lib/connect.functions";
import { connectService, disconnectService } from "@/lib/mesh.functions";
import { BulkLinkPanel } from "@/components/mesh/BulkLinkPanel";
import { SecretsPanel } from "@/components/mesh/SecretsPanel";

export const Route = createFileRoute("/_authenticated/connect")({
  component: ConnectPage,
  head: () => ({
    meta: [
      { title: "مركز الربط — TVCC" },
      { name: "description", content: "ربط المواقع بالخدمات وقواعد البيانات المحلية والسحابية وخدمات مجموعة HN من مكان واحد." },
      { property: "og:title", content: "مركز الربط — TVCC" },
      { property: "og:description", content: "ربط المواقع بالخدمات وقواعد البيانات المحلية والسحابية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SERVICE_TYPES = [
  "database", "redis", "storage", "ai_model", "api", "n8n", "smtp", "queue", "other",
];

function ConnectPage() {
  const qc = useQueryClient();
  const fetchHub = useServerFn(getConnectHub);
  const { data, isLoading } = useQuery({ queryKey: ["connect-hub"], queryFn: () => fetchHub() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["connect-hub"] });

  const regFn = useServerFn(registerService);
  const delSvcFn = useServerFn(deleteService);
  const connFn = useServerFn(connectService);
  const disconnFn = useServerFn(disconnectService);
  const linkDbFn = useServerFn(linkDatabase);
  const unlinkDbFn = useServerFn(unlinkDatabase);

  const mut = (fn: (v: any) => Promise<any>, msg: string) =>
    useMutation({
      mutationFn: (vars: any) => fn({ data: vars }),
      onSuccess: () => { toast.success(msg); refresh(); },
      onError: (e: any) => toast.error(e?.message ?? "فشلت العملية"),
    });

  const mReg = mut(regFn, "تم تسجيل الخدمة");
  const mDelSvc = mut(delSvcFn, "تم حذف الخدمة");
  const mConn = mut(connFn, "تم الربط وحقن المتغيرات");
  const mDisconn = mut(disconnFn, "تم فك الربط");
  const mLinkDb = mut(linkDbFn, "تم ربط قاعدة البيانات");
  const mUnlinkDb = mut(unlinkDbFn, "تم فك ربط القاعدة");

  const testFn = useServerFn(testConnection);
  const eventsFn = useServerFn(listConnectionEvents);
  const { data: events = [] } = useQuery({
    queryKey: ["connect-events"],
    queryFn: () => eventsFn(),
    refetchInterval: 15000,
  });
  const mTest = useMutation({
    mutationFn: (vars: { kind: "service" | "database" | "env"; id: string }) => testFn({ data: vars }),
    onSuccess: (res: any) => {
      const fn = res.status === "error" ? toast.error : res.status === "active" ? toast.success : toast.info;
      fn(res.message || res.status);
      refresh();
      qc.invalidateQueries({ queryKey: ["connect-events"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاختبار"),
  });

  const websites = data?.websites ?? [];
  const services = data?.services ?? [];
  const servers = data?.servers ?? [];
  const databases = data?.databases ?? [];

  // service form
  const [svc, setSvc] = useState({ websiteId: "", name: "", serviceType: "api", endpointUrl: "", vaultSecretName: "" });
  // consumer form
  const [cons, setCons] = useState({ consumerWebsiteId: "", serviceId: "" });
  // db form
  const [db, setDb] = useState({
    websiteId: "", databaseId: "", serverId: "", connectionKind: "cloud",
    dbEngine: "postgres", dbName: "", dbUser: "", host: "", port: "5432", envKey: "DATABASE_URL",
  });

  const siteName = (id: string) => websites.find((w: any) => w.id === id)?.domain ?? "—";

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Link2 className="w-7 h-7 text-primary" /> مركز الربط
        </h1>
        <p className="text-muted-foreground mt-1">
          اربط المواقع بالخدمات وقواعد البيانات — محلية على سيرفراتك أو سحابية أو أي خدمة من مجموعة HN.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "خدمات مُسجّلة", value: services.length, icon: Boxes },
          { label: "روابط نشطة", value: (data?.dependencies ?? []).length, icon: Plug },
          { label: "قواعد مرتبطة", value: (data?.siteDatabases ?? []).length, icon: Database },
          { label: "سيرفرات", value: servers.length, icon: Server },
        ].map((s) => (
          <Card key={s.label} className="ring-1 ring-border bg-card/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{isLoading ? "—" : s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
              <s.icon className="w-6 h-6 text-primary/70" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="services" dir="rtl">
        <TabsList>
          <TabsTrigger value="services">الخدمات والربط</TabsTrigger>
          <TabsTrigger value="databases">قواعد البيانات</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4 mt-4">
          <Card className="ring-1 ring-border bg-card/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cloud className="w-4 h-4" /> تسجيل خدمة جديدة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <Label className="text-xs">الموقع المزوّد</Label>
                <Select value={svc.websiteId} onValueChange={(v) => setSvc({ ...svc, websiteId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent>
                    {websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">اسم الخدمة</Label>
                <Input className="mt-1" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} placeholder="HN Redis" />
              </div>
              <div>
                <Label className="text-xs">النوع</Label>
                <Select value={svc.serviceType} onValueChange={(v) => setSvc({ ...svc, serviceType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">العنوان (Endpoint)</Label>
                <Input className="mt-1" value={svc.endpointUrl} onChange={(e) => setSvc({ ...svc, endpointUrl: e.target.value })} placeholder="http://10.0.0.5:6379" />
              </div>
              <Button
                disabled={!svc.websiteId || !svc.name || mReg.isPending}
                onClick={() => mReg.mutate({ ...svc, endpointUrl: svc.endpointUrl || undefined, vaultSecretName: svc.vaultSecretName || undefined })}
              >
                تسجيل
              </Button>
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardHeader><CardTitle className="text-base">ربط موقع بخدمة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">الموقع المستهلك</Label>
                <Select value={cons.consumerWebsiteId} onValueChange={(v) => setCons({ ...cons, consumerWebsiteId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent>
                    {websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الخدمة</Label>
                <Select value={cons.serviceId} onValueChange={(v) => setCons({ ...cons, serviceId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر خدمة" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.service_type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={!cons.consumerWebsiteId || !cons.serviceId || mConn.isPending}
                onClick={() => mConn.mutate(cons)}
              >
                <Plug className="w-4 h-4 ml-1" /> ربط
              </Button>
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardHeader><CardTitle className="text-base">الخدمات المسجّلة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {services.length === 0 && <p className="text-sm text-muted-foreground">لا توجد خدمات بعد.</p>}
              {services.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.service_type}</Badge>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.endpoint_url ?? "—"}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => mDelSvc.mutate({ serviceId: s.id })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardHeader><CardTitle className="text-base">الروابط النشطة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.dependencies ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد روابط بعد.</p>}
              {(data?.dependencies ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{siteName(d.consumer_website_id)}</span>
                    <Link2 className="w-4 h-4 text-primary" />
                    <span>{services.find((s: any) => s.id === d.service_id)?.name ?? "خدمة"}</span>
                    <Badge variant="outline">{d.status}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => mDisconn.mutate({ dependencyId: d.id })}>فك الربط</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="databases" className="space-y-4 mt-4">
          <Card className="ring-1 ring-border bg-card/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" /> ربط قاعدة بيانات بموقع</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">الموقع</Label>
                <Select value={db.websiteId} onValueChange={(v) => setDb({ ...db, websiteId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent>
                    {websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">نوع الاتصال</Label>
                <Select value={db.connectionKind} onValueChange={(v) => setDb({ ...db, connectionKind: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">محلي (نفس السيرفر)</SelectItem>
                    <SelectItem value="network">شبكة داخلية</SelectItem>
                    <SelectItem value="cloud">سحابي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المحرّك</Label>
                <Select value={db.dbEngine} onValueChange={(v) => setDb({ ...db, dbEngine: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">السيرفر (اختياري)</Label>
                <Select value={db.serverId} onValueChange={(v) => setDb({ ...db, serverId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المضيف</Label>
                <Input className="mt-1" value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} placeholder="127.0.0.1" />
              </div>
              <div>
                <Label className="text-xs">المنفذ</Label>
                <Input className="mt-1" value={db.port} onChange={(e) => setDb({ ...db, port: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">اسم القاعدة</Label>
                <Input className="mt-1" value={db.dbName} onChange={(e) => setDb({ ...db, dbName: e.target.value })} placeholder="app_db" />
              </div>
              <div>
                <Label className="text-xs">المستخدم</Label>
                <Input className="mt-1" value={db.dbUser} onChange={(e) => setDb({ ...db, dbUser: e.target.value })} placeholder="app" />
              </div>
              <div>
                <Label className="text-xs">قاعدة مُسجّلة (اختياري)</Label>
                <Select value={db.databaseId} onValueChange={(v) => setDb({ ...db, databaseId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {databases.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">مفتاح البيئة</Label>
                <Input className="mt-1" value={db.envKey} onChange={(e) => setDb({ ...db, envKey: e.target.value })} />
              </div>
              <Button
                disabled={!db.websiteId || mLinkDb.isPending}
                onClick={() =>
                  mLinkDb.mutate({
                    websiteId: db.websiteId,
                    databaseId: db.databaseId || undefined,
                    serverId: db.serverId || undefined,
                    connectionKind: db.connectionKind,
                    dbEngine: db.dbEngine,
                    dbName: db.dbName || undefined,
                    dbUser: db.dbUser || undefined,
                    host: db.host || undefined,
                    port: db.port ? Number(db.port) : undefined,
                    envKey: db.envKey || undefined,
                  })
                }
              >
                ربط القاعدة
              </Button>
            </CardContent>
          </Card>

          <Card className="ring-1 ring-border bg-card/60">
            <CardHeader><CardTitle className="text-base">القواعد المرتبطة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.siteDatabases ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد روابط قواعد بيانات بعد.</p>}
              {(data?.siteDatabases ?? []).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{l.db_engine}</Badge>
                    <span>{siteName(l.website_id)}</span>
                    <Link2 className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">{l.host ?? "—"}:{l.port ?? "—"}/{l.db_name ?? "—"}</span>
                    <Badge variant="outline">{l.connection_kind}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => mUnlinkDb.mutate({ linkId: l.id })}>فك الربط</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
