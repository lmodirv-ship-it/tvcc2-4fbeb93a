import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Play, Square, RotateCw, FileText, Trash2, Plus, Database, HardDrive,
  RefreshCw, Zap, ZapOff, GitBranch, ShieldCheck,
} from "lucide-react";
import {
  getRuntimeHub, saveSiteRuntime, controlSiteRuntime, deleteSiteRuntime,
  connectSiteDatabase, testSiteDatabase, disconnectSiteDatabase,
  provisionSiteStorage, setLiveSync, refreshStorageUsage, syncSiteNow, setClusterSyncMode,
} from "@/lib/runtime.functions";

type Props = { serverId: string; websites: any[]; dryRun: boolean };

const badgeFor = (s?: string | null) =>
  s === "running" || s === "active" || s === "connected" || s === "synced"
    ? "bg-success/20 text-success border-success/40"
    : s === "failed" || s === "error"
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";

export function RuntimeHub({ serverId, websites, dryRun }: Props) {
  const qc = useQueryClient();
  const hub = useServerFn(getRuntimeHub);
  const saveRt = useServerFn(saveSiteRuntime);
  const control = useServerFn(controlSiteRuntime);
  const rmRt = useServerFn(deleteSiteRuntime);
  const connectDb = useServerFn(connectSiteDatabase);
  const testDb = useServerFn(testSiteDatabase);
  const dropDb = useServerFn(disconnectSiteDatabase);
  const provision = useServerFn(provisionSiteStorage);
  const liveSync = useServerFn(setLiveSync);
  const refreshUsage = useServerFn(refreshStorageUsage);
  const syncNow = useServerFn(syncSiteNow);
  const clusterMode = useServerFn(setClusterSyncMode);

  const [busy, setBusy] = useState<string | null>(null);
  const [rt, setRt] = useState({ websiteId: "", domain: "", runtimeKind: "node", port: "3000", execStart: "" });
  const [db, setDb] = useState({ websiteId: "", engine: "postgres", connectionKind: "local", host: "", port: "", envKey: "DATABASE_URL" });
  const [storeSite, setStoreSite] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["runtime-hub", serverId],
    queryFn: () => hub({ data: { serverId } }),
    refetchInterval: 20000,
  });

  const runtimes = ((data as any)?.runtimes ?? []) as any[];
  const siteDatabases = ((data as any)?.siteDatabases ?? []) as any[];
  const storages = ((data as any)?.storages ?? []) as any[];
  const members = ((data as any)?.clusterMembers ?? []) as any[];
  const events = ((data as any)?.events ?? []) as any[];
  const kinds = ((data as any)?.runtimeKinds ?? []) as any[];

  const siteName = (id?: string | null) => websites.find((w) => w.id === id)?.domain ?? "—";

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
    <Tabs defaultValue="run" className="pt-1">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="run"><Play className="w-3 h-3 ml-1" /> التشغيل</TabsTrigger>
        <TabsTrigger value="db"><Database className="w-3 h-3 ml-1" /> قواعد البيانات</TabsTrigger>
        <TabsTrigger value="storage"><HardDrive className="w-3 h-3 ml-1" /> التخزين والمزامنة</TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------- runtimes */}
      <TabsContent value="run" className="space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">تشغيل مواقعك كخدمات systemd على هذا السيرفر مع تحكّم كامل وسجلات.</p>

        <div className="grid gap-1">
          {runtimes.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا يوجد تشغيل مُعرَّف بعد.</p>
          ) : runtimes.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span dir="ltr" className="font-mono">{r.domain}</span>
              <Badge variant="outline">{r.runtime_kind}</Badge>
              {r.port ? <Badge variant="outline" dir="ltr">:{r.port}</Badge> : null}
              <Badge variant="outline" className={badgeFor(r.status)}>{r.status}</Badge>
              <span className="text-muted-foreground" dir="ltr">{r.unit_name}</span>
              <div className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={busy === `st-${r.id}`}
                  onClick={() => run(`st-${r.id}`, () => control({ data: { id: r.id, op: "start", dryRun } }), "تم جدولة التشغيل")}>
                  <Play className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === `sp-${r.id}`}
                  onClick={() => run(`sp-${r.id}`, () => control({ data: { id: r.id, op: "stop", dryRun } }), "تم جدولة الإيقاف")}>
                  <Square className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === `rs-${r.id}`}
                  onClick={() => run(`rs-${r.id}`, () => control({ data: { id: r.id, op: "restart", dryRun } }), "تم جدولة إعادة التشغيل")}>
                  <RotateCw className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === `lg-${r.id}`}
                  onClick={() => run(`lg-${r.id}`, () => control({ data: { id: r.id, op: "logs" } }), "تم طلب السجلات — تظهر في تبويب الأدوات")}>
                  <FileText className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === `dl-${r.id}`}
                  onClick={() => run(`dl-${r.id}`, () => rmRt({ data: { id: r.id } }), "تم الحذف")}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium">تشغيل موقع جديد</p>
          <div className="grid gap-2 md:grid-cols-4">
            <Select value={rt.websiteId} onValueChange={(v) => {
              const w = websites.find((x) => x.id === v);
              setRt({ ...rt, websiteId: v, domain: w?.domain ?? "" });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="الموقع" /></SelectTrigger>
              <SelectContent>
                {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rt.runtimeKind} onValueChange={(v) => setRt({ ...rt, runtimeKind: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {kinds.map((k: any) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input dir="ltr" placeholder="المنفذ" value={rt.port} onChange={(e) => setRt({ ...rt, port: e.target.value })} className="h-8 text-xs" />
            <Input dir="ltr" placeholder="أمر التشغيل (اختياري)" value={rt.execStart} onChange={(e) => setRt({ ...rt, execStart: e.target.value })} className="h-8 text-xs" />
          </div>
          <Button size="sm" disabled={!rt.domain || busy === "rt"}
            onClick={() => run("rt", async () => {
              await saveRt({ data: {
                serverId, websiteId: rt.websiteId || null, domain: rt.domain,
                runtimeKind: rt.runtimeKind, port: rt.port ? Number(rt.port) : null,
                execStart: rt.execStart || null, dryRun,
              } });
              setRt({ websiteId: "", domain: "", runtimeKind: "node", port: "3000", execStart: "" });
            }, "تم إنشاء وحدة التشغيل وجدولة تجهيزها")}>
            <Plus className="w-3 h-3 ml-1" /> إنشاء التشغيل
          </Button>
        </div>
      </TabsContent>

      {/* ------------------------------------------------------ databases */}
      <TabsContent value="db" className="space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">
          اربط كل موقع بقاعدة بيانات محلية على السيرفر أو سحابية — تُنشأ القاعدة والمستخدم تلقائياً ويُحقن رابط الاتصال في متغيّرات الموقع بلا كتابة مفاتيح.
        </p>

        <div className="grid gap-1">
          {siteDatabases.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد روابط قواعد بيانات بعد.</p>
          ) : siteDatabases.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span className="font-medium">{siteName(l.website_id)}</span>
              <Badge variant="outline">{l.db_engine}</Badge>
              <Badge variant="outline">{l.connection_kind}</Badge>
              <span dir="ltr" className="font-mono text-muted-foreground">{l.host}:{l.port}/{l.db_name}</span>
              <Badge variant="outline" className={badgeFor(l.status)}>{l.status}</Badge>
              <Badge variant="outline"><ShieldCheck className="w-3 h-3 ml-1" /> {l.env_key}</Badge>
              <div className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={busy === `td-${l.id}`}
                  onClick={() => run(`td-${l.id}`, () => testDb({ data: { id: l.id } }), "تم جدولة فحص الاتصال")}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === `dd-${l.id}`}
                  onClick={() => run(`dd-${l.id}`, () => dropDb({ data: { id: l.id } }), "تم فصل الاتصال")}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium">ربط قاعدة بيانات بموقع</p>
          <div className="grid gap-2 md:grid-cols-3">
            <Select value={db.websiteId} onValueChange={(v) => setDb({ ...db, websiteId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="الموقع" /></SelectTrigger>
              <SelectContent>
                {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={db.engine} onValueChange={(v) => setDb({ ...db, engine: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
              </SelectContent>
            </Select>
            <Select value={db.connectionKind} onValueChange={(v) => setDb({ ...db, connectionKind: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">محلية على نفس السيرفر</SelectItem>
                <SelectItem value="lan">سيرفر آخر عبر الشبكة</SelectItem>
                <SelectItem value="cloud">سحابية</SelectItem>
              </SelectContent>
            </Select>
            <Input dir="ltr" placeholder="المضيف (افتراضي 127.0.0.1)" value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} className="h-8 text-xs" />
            <Input dir="ltr" placeholder="المنفذ" value={db.port} onChange={(e) => setDb({ ...db, port: e.target.value })} className="h-8 text-xs" />
            <div className="space-y-1">
              <Label className="text-[10px]">اسم المتغيّر</Label>
              <Input dir="ltr" value={db.envKey} onChange={(e) => setDb({ ...db, envKey: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button size="sm" disabled={!db.websiteId || busy === "db"}
            onClick={() => run("db", async () => {
              await connectDb({ data: {
                serverId, websiteId: db.websiteId, engine: db.engine, connectionKind: db.connectionKind,
                host: db.host || null, port: db.port ? Number(db.port) : null, envKey: db.envKey, dryRun,
              } });
              setDb({ websiteId: "", engine: "postgres", connectionKind: "local", host: "", port: "", envKey: "DATABASE_URL" });
            }, "تم الربط وحقن بيانات الاتصال")}>
            <Database className="w-3 h-3 ml-1" /> Connect
          </Button>
        </div>
      </TabsContent>

      {/* -------------------------------------------------------- storage */}
      <TabsContent value="storage" className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">تخزين كل موقع مُثبت الملكية، مع مزامنة لحظية ومزامنة بين السيرفرات.</span>
          <Button size="sm" variant="outline" disabled={busy === "usage"}
            onClick={() => run("usage", () => refreshUsage({ data: { serverId } }), "تم طلب قياس الاستهلاك")}>
            <RefreshCw className="w-3 h-3 ml-1" /> قياس الاستهلاك
          </Button>
        </div>

        <div className="grid gap-1">
          {storages.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد مساحات تخزين على هذا السيرفر بعد.</p>
          ) : storages.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span className="font-medium">{s.name}</span>
              <span dir="ltr" className="font-mono text-muted-foreground">{s.path}</span>
              <Badge variant="outline">{Number(s.used_gb ?? 0).toFixed(2)} GB</Badge>
              {s.identity_written ? <Badge variant="outline" className={badgeFor("active")}>ملكية مثبتة</Badge> : null}
              <Badge variant="outline" className={badgeFor(s.watch_enabled ? "running" : null)}>
                {s.watch_enabled ? "مزامنة لحظية" : "متوقفة"}
              </Badge>
              <div className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={busy === `ls-${s.id}`}
                  onClick={() => run(`ls-${s.id}`, () => liveSync({ data: { storageId: s.id, enabled: !s.watch_enabled, dryRun } }),
                    s.watch_enabled ? "تم إيقاف المزامنة اللحظية" : "تم تفعيل المزامنة اللحظية")}>
                  {s.watch_enabled ? <ZapOff className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium">تجهيز تخزين موقع (مجلد + ملف ملكية)</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Select value={storeSite} onValueChange={setStoreSite}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="الموقع" /></SelectTrigger>
              <SelectContent>
                {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!storeSite || busy === "prov"}
              onClick={() => run("prov", async () => {
                await provision({ data: { serverId, websiteId: storeSite, dryRun } });
                setStoreSite("");
              }, "تم تجهيز المجلد وكتابة ملف الملكية")}>
              <HardDrive className="w-3 h-3 ml-1" /> تجهيز
            </Button>
          </div>
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1"><GitBranch className="w-3 h-3" /> المزامنة بين السيرفرات</p>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد نسخ متعدّدة لأي موقع بعد.</p>
          ) : members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded bg-muted/40 p-2 text-xs">
              <span dir="ltr" className="font-mono">{m.domain}</span>
              <Badge variant="outline">{m.role === "primary" ? "أساسي" : "نسخة"}</Badge>
              <Badge variant="outline" className={badgeFor(m.sync_status)}>{m.sync_status}</Badge>
              <Select value={m.sync_mode} onValueChange={(v) => run(`cm-${m.id}`, () => clusterMode({ data: { memberId: m.id, syncMode: v } }), "تم تحديث وضع المزامنة")}>
                <SelectTrigger className="h-7 w-36 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">يدوي</SelectItem>
                  <SelectItem value="live">لحظي عند التغيير</SelectItem>
                  <SelectItem value="interval">كل فترة</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="ms-auto" disabled={busy === `sy-${m.id}`}
                onClick={() => run(`sy-${m.id}`, () => syncNow({ data: { memberId: m.id, dryRun } }), "تم جدولة المزامنة")}>
                مزامنة الآن
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-1">
          <p className="text-xs font-medium">آخر أحداث التخزين</p>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد أحداث بعد.</p>
          ) : events.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline">{e.event_kind}</Badge>
              <span dir="ltr">{e.path ?? "—"}</span>
              <span className="ms-auto">{new Date(e.created_at).toLocaleString("ar")}</span>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
