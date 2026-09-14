import { NightlyDestinations } from "@/components/backups/NightlyDestinations";
import { SiteTransfersTable } from "@/components/backups/SiteTransfersTable";

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, Loader2, Trash2, RotateCcw, Download, Upload, Plus, Clock, Server, Database, RefreshCw, Link2, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listBackups, createBackup, deleteBackup, restoreBackup, exportSiteData, importSiteData,
  listBackupSchedules, saveBackupSchedule, deleteBackupSchedule,
} from "@/lib/server-ops.functions";
import {
  getBackupHub, runFleetBackup, saveDatabaseEntry, deleteDatabaseEntry,
  pairDatabases, syncDatabasePair, testDatabaseEntry,
} from "@/lib/backup-hub.functions";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
  head: () => ({
    meta: [
      { title: "النسخ الاحتياطي والتصدير — TVCC" },
      { name: "description", content: "أنشئ نسخاً احتياطية للمواقع وقواعد بياناتها، واستعدها، وصدّر أو استورد بيانات أي موقع." },
      { property: "og:title", content: "النسخ الاحتياطي والتصدير — TVCC" },
      { property: "og:description", content: "نسخ احتياطية واستعادة وتصدير واستيراد لبيانات المواقع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const statusStyle = (s: string) =>
  s === "completed"
    ? "bg-success/20 text-success border-success/40"
    : s === "failed"
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";

function BackupsPage() {
  const qc = useQueryClient();
  const fetchBackups = useServerFn(listBackups);
  const make = useServerFn(createBackup);
  const remove = useServerFn(deleteBackup);
  const restore = useServerFn(restoreBackup);
  const doExport = useServerFn(exportSiteData);
  const doImport = useServerFn(importSiteData);
  const fetchSchedules = useServerFn(listBackupSchedules);
  const saveSchedule = useServerFn(saveBackupSchedule);
  const deleteSchedule = useServerFn(deleteBackupSchedule);

  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState("full");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedCron, setSchedCron] = useState("0 2 * * *");
  const [schedType, setSchedType] = useState("full");
  const [schedRetention, setSchedRetention] = useState(7);
  const [schedLabel, setSchedLabel] = useState("");

  // destination + fleet backup
  const fetchHub = useServerFn(getBackupHub);
  const fleet = useServerFn(runFleetBackup);
  const saveDb = useServerFn(saveDatabaseEntry);
  const delDb = useServerFn(deleteDatabaseEntry);
  const pairDb = useServerFn(pairDatabases);
  const syncDb = useServerFn(syncDatabasePair);
  const testDb = useServerFn(testDatabaseEntry);

  const [targetServerId, setTargetServerId] = useState("");
  const [destPath, setDestPath] = useState("/var/backups/tvcc");
  const [dbForm, setDbForm] = useState({
    name: "", dbKind: "local", dbType: "postgres", host: "", port: "5432",
    dbName: "", dbUser: "", serverId: "", connectionUrl: "", envKey: "DATABASE_URL",
  });
  const [pair, setPair] = useState({ primaryId: "", replicaId: "", syncMode: "mirror" });

  const { data: hub, isLoading: hubLoading } = useQuery({
    queryKey: ["backup-hub"],
    queryFn: () => fetchHub(),
    refetchInterval: 60000,
  });
  const hubServers = (hub?.servers ?? []) as any[];
  const hubDatabases = (hub?.databases ?? []) as any[];
  const refreshHub = () => qc.invalidateQueries({ queryKey: ["backup-hub"] });

  const { data: sites } = useQuery({
    queryKey: ["backup-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("websites")
        .select("id, name, domain, server_id")
        .order("domain");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => fetchBackups(),
    refetchInterval: 30000,
  });

  const { data: schedules, isLoading: schedLoading } = useQuery({
    queryKey: ["backup-schedules"],
    queryFn: () => fetchSchedules({ data: {} }),
    refetchInterval: 60000,
  });

  const rows = (data ?? []) as any[];

  const downloadExport = async () => {
    if (!siteId) return toast.error("اختر موقعاً أولاً");
    setBusy(true);
    try {
      const payload = await doExport({ data: { websiteId: siteId } });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(payload as any).site.domain}-export.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("تم التصدير");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadImport = async (file: File) => {
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text());
      const r: any = await doImport({ data: { payload } });
      toast.success(`تم الاستيراد (${r.envCount} متغيّر بيئة)`);
      qc.invalidateQueries({ queryKey: ["backup-sites"] });
      qc.invalidateQueries({ queryKey: ["operations"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Archive className="w-6 h-6 text-primary" /> النسخ الاحتياطي والتصدير</h1>
        <p className="text-sm text-muted-foreground mt-1">نسخة كاملة للملفات وقاعدة البيانات لكل موقع، مع استعادة وتصدير/استيراد للبيانات.</p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4 items-end">
          <div className="md:col-span-2">
            <Label>الموقع</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
              <SelectContent>
                {((sites ?? []) as any[]).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>نوع النسخة</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">كاملة (ملفات + قاعدة)</SelectItem>
                <SelectItem value="files">الملفات فقط</SelectItem>
                <SelectItem value="database">قاعدة البيانات فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              disabled={!siteId || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await make({ data: { websiteId: siteId, backupType: type } });
                  qc.invalidateQueries({ queryKey: ["backups"] });
                  toast.success("تم جدولة النسخة الاحتياطية");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus className="w-4 h-4 ml-1" /> نسخة جديدة
            </Button>
            <Button variant="outline" disabled={!siteId || busy} onClick={downloadExport}>
              <Download className="w-4 h-4 ml-1" /> تصدير
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 ml-1" /> استيراد
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImport(f);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardContent className="p-4 grid gap-3 md:grid-cols-4 items-end">
          <div>
            <Label className="flex items-center gap-1"><Server className="w-3 h-3" /> سيرفر الوجهة</Label>
            <Select value={targetServerId} onValueChange={setTargetServerId}>
              <SelectTrigger><SelectValue placeholder={hubLoading ? "جارٍ التحميل…" : "اختر سيرفراً"} /></SelectTrigger>
              <SelectContent>
                {hubServers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.hostname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>مسار التخزين على الوجهة</Label>
            <Input className="ltr text-left" value={destPath} onChange={(e) => setDestPath(e.target.value)} placeholder="/var/backups/tvcc" />
          </div>
          <Button
            disabled={!targetServerId || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r: any = await fleet({ data: { targetServerId, destPath, backupType: type } });
                toast.success(`تم إرسال ${r.total} مهمة نسخ إلى الوكلاء`);
                qc.invalidateQueries({ queryKey: ["backups"] });
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Archive className="w-4 h-4 ml-1" /> نسخ كل المواقع
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="backups">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="backups"><Archive className="w-3 h-3 ml-1" /> النسخ الاحتياطية</TabsTrigger>
          <TabsTrigger value="schedules"><Clock className="w-3 h-3 ml-1" /> الجدولة التلقائية</TabsTrigger>
          <TabsTrigger value="databases"><Database className="w-3 h-3 ml-1" /> قواعد البيانات</TabsTrigger>
          <TabsTrigger value="nightly"><Clock className="w-3 h-3 ml-1" /> النسخ الليلي للمواقع</TabsTrigger>
        </TabsList>

        <TabsContent value="nightly" className="pt-4">
          <NightlyDestinations />
        </TabsContent>


        <TabsContent value="backups" className="pt-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد نسخ احتياطية بعد.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الوقت</TableHead>
                      <TableHead>الموقع</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الحجم</TableHead>
                      <TableHead>المسار</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(b.created_at).toLocaleString("ar")}</TableCell>
                        <TableCell className="text-xs">{b.websites?.domain ?? "—"}</TableCell>
                        <TableCell className="text-xs">{b.backup_type}</TableCell>
                        <TableCell><Badge variant="outline" className={statusStyle(b.status)}>{b.status}</Badge></TableCell>
                        <TableCell className="text-xs">{b.size_mb ? `${b.size_mb}MB` : "—"}</TableCell>
                        <TableCell className="text-[11px] ltr text-left max-w-[18rem] truncate">{b.storage_path ?? "—"}</TableCell>
                        <TableCell className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={b.status !== "completed"}
                            onClick={async () => {
                              try {
                                await restore({ data: { id: b.id } });
                                toast.success("تم إرسال طلب الاستعادة للوكيل");
                                qc.invalidateQueries({ queryKey: ["backups"] });
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <RotateCcw className="w-3 h-3 ml-1" /> استعادة
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={async () => {
                              await remove({ data: { id: b.id } });
                              qc.invalidateQueries({ queryKey: ["backups"] });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="pt-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid gap-3 md:grid-cols-7 items-end">
              <div className="md:col-span-2">
                <Label>الموقع</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
                  <SelectContent>
                    {((sites ?? []) as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>التكرار (Cron)</Label>
                <Input value={schedCron} onChange={(e) => setSchedCron(e.target.value)} placeholder="0 2 * * *" />
              </div>
              <div>
                <Label>نوع النسخة</Label>
                <Select value={schedType} onValueChange={setSchedType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">كاملة</SelectItem>
                    <SelectItem value="files">ملفات</SelectItem>
                    <SelectItem value="database">قاعدة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الاحتفاظ (نسخ)</Label>
                <Input type="number" min={1} max={100} value={schedRetention} onChange={(e) => setSchedRetention(Number(e.target.value))} />
              </div>
              <div>
                <Label>مسمّى</Label>
                <Input value={schedLabel} onChange={(e) => setSchedLabel(e.target.value)} placeholder="يومي ٢ ص" />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch id="schedOn" checked={schedEnabled} onCheckedChange={setSchedEnabled} />
                <Label htmlFor="schedOn" className="text-xs">مفعّل</Label>
              </div>
              <Button
                disabled={!siteId}
                onClick={async () => {
                  const site = (sites as any[]).find((s) => s.id === siteId);
                  if (!site?.server_id) return toast.error("الموقع غير مرتبط بسيرفر");
                  try {
                    await saveSchedule({
                      data: {
                        websiteId: siteId,
                        serverId: site.server_id,
                        cron: schedCron,
                        backupType: schedType,
                        retentionCount: schedRetention,
                        enabled: schedEnabled,
                        label: schedLabel,
                        targetServerId: targetServerId || null,
                        destPath: destPath || null,
                      },
                    });
                    qc.invalidateQueries({ queryKey: ["backup-schedules"] });
                    toast.success("تم حفظ الجدولة");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Plus className="w-4 h-4 ml-1" /> حفظ جدولة
              </Button>
            </CardContent>
          </Card>

          {schedLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (schedules ?? []).length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد جداول نسخ احتياطي تلقائية.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموقع</TableHead>
                      <TableHead>التكرار</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الاحتفاظ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(schedules as any[]).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{s.websites?.domain ?? "—"}</TableCell>
                        <TableCell className="text-xs ltr text-left">{s.schedule}</TableCell>
                        <TableCell className="text-xs">{s.backup_type}</TableCell>
                        <TableCell className="text-xs">{s.retention_count}</TableCell>
                        <TableCell><Badge variant="outline" className={s.is_active ? statusStyle("completed") : statusStyle("pending")}>{s.is_active ? "مفعّل" : "معطّل"}</Badge></TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={async () => {
                              await deleteSchedule({ data: { id: s.id } });
                              qc.invalidateQueries({ queryKey: ["backup-schedules"] });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="databases" className="pt-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid gap-3 md:grid-cols-4 items-end">
              <div>
                <Label>الاسم</Label>
                <Input value={dbForm.name} onChange={(e) => setDbForm({ ...dbForm, name: e.target.value })} placeholder="قاعدة المتجر" />
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={dbForm.dbKind} onValueChange={(v) => setDbForm({ ...dbForm, dbKind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">محلية (على سيرفر)</SelectItem>
                    <SelectItem value="cloud">سحابية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المحرّك</Label>
                <Select value={dbForm.dbType} onValueChange={(v) => setDbForm({ ...dbForm, dbType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["postgres", "mysql", "mongodb", "redis", "supabase"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>السيرفر</Label>
                <Select value={dbForm.serverId} onValueChange={(v) => setDbForm({ ...dbForm, serverId: v })}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    {hubServers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المضيف</Label>
                <Input className="ltr text-left" value={dbForm.host} onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })} placeholder="192.168.100.66" />
              </div>
              <div>
                <Label>المنفذ</Label>
                <Input className="ltr text-left" value={dbForm.port} onChange={(e) => setDbForm({ ...dbForm, port: e.target.value })} placeholder="5432" />
              </div>
              <div>
                <Label>اسم القاعدة</Label>
                <Input className="ltr text-left" value={dbForm.dbName} onChange={(e) => setDbForm({ ...dbForm, dbName: e.target.value })} />
              </div>
              <div>
                <Label>المستخدم</Label>
                <Input className="ltr text-left" value={dbForm.dbUser} onChange={(e) => setDbForm({ ...dbForm, dbUser: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>رابط الاتصال (اختياري)</Label>
                <Input className="ltr text-left" value={dbForm.connectionUrl} onChange={(e) => setDbForm({ ...dbForm, connectionUrl: e.target.value })} placeholder="https://db.hn-groupe.org" />
              </div>
              <div>
                <Label>مفتاح البيئة</Label>
                <Input className="ltr text-left" value={dbForm.envKey} onChange={(e) => setDbForm({ ...dbForm, envKey: e.target.value })} />
              </div>
              <Button
                disabled={!dbForm.name}
                onClick={async () => {
                  try {
                    await saveDb({
                      data: {
                        name: dbForm.name,
                        dbKind: dbForm.dbKind,
                        dbType: dbForm.dbType,
                        host: dbForm.host || undefined,
                        port: dbForm.port ? Number(dbForm.port) : undefined,
                        dbName: dbForm.dbName || undefined,
                        dbUser: dbForm.dbUser || undefined,
                        serverId: dbForm.serverId || undefined,
                        connectionUrl: dbForm.connectionUrl || undefined,
                        envKey: dbForm.envKey || undefined,
                      },
                    });
                    setDbForm({ ...dbForm, name: "", dbName: "", connectionUrl: "" });
                    refreshHub();
                    toast.success("تم حفظ القاعدة");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Plus className="w-4 h-4 ml-1" /> إضافة قاعدة
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 grid gap-3 md:grid-cols-4 items-end">
              <div>
                <Label>القاعدة الأساسية</Label>
                <Select value={pair.primaryId} onValueChange={(v) => setPair({ ...pair, primaryId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {hubDatabases.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.db_kind})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>القاعدة المرتبطة</Label>
                <Select value={pair.replicaId} onValueChange={(v) => setPair({ ...pair, replicaId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {hubDatabases.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.db_kind})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>وضع المزامنة</Label>
                <Select value={pair.syncMode} onValueChange={(v) => setPair({ ...pair, syncMode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mirror">ازدواجية (Mirror)</SelectItem>
                    <SelectItem value="primary_replica">أساسي/نسخة</SelectItem>
                    <SelectItem value="none">بدون</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!pair.primaryId || !pair.replicaId}
                onClick={async () => {
                  try {
                    await pairDb({ data: pair });
                    refreshHub();
                    toast.success("تم الربط الازدواجي");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Link2 className="w-4 h-4 ml-1" /> ربط ازدواجي
              </Button>
            </CardContent>
          </Card>

          {hubDatabases.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد قواعد بيانات مسجّلة.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المحرّك</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>المزامنة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hubDatabases.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs">{d.name}</TableCell>
                        <TableCell className="text-xs">{d.db_kind === "local" ? "محلية" : "سحابية"}</TableCell>
                        <TableCell className="text-xs">{d.db_type}</TableCell>
                        <TableCell className="text-[11px] ltr text-left max-w-[16rem] truncate">{d.connection_url || `${d.host ?? "—"}:${d.port ?? ""}`}</TableCell>
                        <TableCell className="text-xs">{d.linked_database_id ? (d.sync_mode ?? "mirror") : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={statusStyle(d.status === "active" ? "completed" : d.status === "error" ? "failed" : "pending")}>{d.status}</Badge></TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              const r: any = await testDb({ data: { id: d.id } });
                              toast.info(r.message);
                              refreshHub();
                            } catch (e) { toast.error((e as Error).message); }
                          }}>
                            <Activity className="w-3 h-3 ml-1" /> فحص
                          </Button>
                          <Button size="sm" variant="outline" disabled={!d.linked_database_id} onClick={async () => {
                            try {
                              await syncDb({ data: { id: d.id } });
                              toast.success("تم إرسال مهمة المزامنة");
                              refreshHub();
                            } catch (e) { toast.error((e as Error).message); }
                          }}>
                            <RefreshCw className="w-3 h-3 ml-1" /> مزامنة
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                            await delDb({ data: { id: d.id } });
                            refreshHub();
                          }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <SiteTransfersTable />
    </div>

  );
}
