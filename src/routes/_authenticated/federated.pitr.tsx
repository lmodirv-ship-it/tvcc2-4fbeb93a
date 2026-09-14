import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getBackupCenter, saveBackupSchedule, toggleBackupSchedule, runBackupNow, verifyBackup, restoreBackup, migrateDatabase,
} from "@/lib/federated-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, DatabaseBackup, Loader2, Play, RotateCcw, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/pitr")({
  component: BackupCenterPage,
  head: () => ({
    meta: [
      { title: "النسخ الاحتياطي والاستعادة — TVCC" },
      { name: "description", content: "سياسات نسخ احتياطي مشفّرة بثلاث نسخ لكل مجموعة مواقع، مع تحقق واستعادة وتهجير قواعد البيانات." },
    ],
  }),
});

const emptyForm = {
  id: undefined as string | undefined,
  groupId: "", schedule: "0 3 * * *", copies: 3, encrypt: true,
  destPath: "/var/backups/tvcc", label: "", targetServerId: "", serverId: "", retentionCount: 7, isActive: true,
};

function BackupCenterPage() {
  const qc = useQueryClient();
  const fetchData = useServerFn(getBackupCenter);
  const saveFn = useServerFn(saveBackupSchedule);
  const toggleFn = useServerFn(toggleBackupSchedule);
  const runFn = useServerFn(runBackupNow);
  const verifyFn = useServerFn(verifyBackup);
  const restoreFn = useServerFn(restoreBackup);
  const migrateFn = useServerFn(migrateDatabase);

  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [migSource, setMigSource] = useState("");
  const [migTarget, setMigTarget] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["backup-center"], queryFn: () => fetchData(), refetchInterval: 20000 });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل مركز النسخ…</div>;

  const groups = (data.groups as any[]).filter((g) => g.group_kind === "category");
  const groupName = (id: string) => (data.groups as any[]).find((g) => g.id === id)?.name ?? "—";
  const siteName = (id: string) => (data.websites as any[]).find((w) => w.id === id)?.domain ?? "—";
  const serverName = (id: string) => (data.servers as any[]).find((s) => s.id === id)?.name ?? "—";
  const refresh = () => qc.invalidateQueries({ queryKey: ["backup-center"] });

  const submit = async () => {
    if (!form.groupId) return toast.error("اختر المجموعة");
    setBusy(true);
    try {
      await saveFn({ data: {
        id: form.id, groupId: form.groupId, serverId: form.serverId || null, targetServerId: form.targetServerId || null,
        schedule: form.schedule, copies: Number(form.copies), encrypt: form.encrypt, destPath: form.destPath,
        label: form.label || `نسخ ${groupName(form.groupId)}`, isActive: form.isActive, retentionCount: Number(form.retentionCount),
      } });
      toast.success("حُفظت سياسة النسخ");
      setOpen(false); setForm(emptyForm); refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const doRun = async (id: string) => {
    setBusy(true);
    try {
      const r = await runFn({ data: { scheduleId: id } });
      toast.success(`أُنشئت ${r.created} نسخة لـ ${r.sites} موقعاً — أُرسل ${r.queued} أمراً للوكيل`);
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      await restoreFn({ data: { backupId: restoreTarget.id, confirm: confirmText } });
      toast.success("أُرسل أمر الاستعادة إلى الوكيل");
      setRestoreTarget(null); setConfirmText(""); refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const doMigrate = async () => {
    if (!migSource || !migTarget || migSource === migTarget) return toast.error("اختر قاعدة مصدر ووجهة مختلفتين");
    setBusy(true);
    try {
      await migrateFn({ data: { sourceId: migSource, targetId: migTarget } });
      toast.success("بدأ تهجير قاعدة البيانات عبر الوكيل");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Archive className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">النسخ الاحتياطي والاستعادة</h1>
            <p className="text-sm text-muted-foreground">ثلاث نسخ مشفّرة لكل مجموعة، مع تحقق دوري واستعادة نقطة زمنية</p>
          </div>
        </div>
        <Button onClick={() => { setForm(emptyForm); setOpen(true); }}><Plus className="w-4 h-4 ml-1" /> سياسة جديدة</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "سياسات نشطة", value: (data.schedules as any[]).filter((s) => s.is_active).length },
          { label: "نسخ محفوظة", value: (data.backups as any[]).length },
          { label: "مجموعات مشمولة", value: new Set((data.schedules as any[]).map((s) => s.group_id).filter(Boolean)).size },
          { label: "قواعد بيانات", value: (data.databases as any[]).length },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6"><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="schedules">
        <TabsList>
          <TabsTrigger value="schedules">السياسات</TabsTrigger>
          <TabsTrigger value="backups">النسخ</TabsTrigger>
          <TabsTrigger value="databases">قواعد البيانات والتهجير</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>المجموعة</TableHead><TableHead>الجدولة</TableHead><TableHead>النسخ</TableHead>
                <TableHead>تشفير</TableHead><TableHead>الوجهة</TableHead><TableHead>آخر تنفيذ</TableHead>
                <TableHead>نشط</TableHead><TableHead>إجراءات</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data.schedules as any[]).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.group_id ? groupName(s.group_id) : s.website_id ? siteName(s.website_id) : s.label}</TableCell>
                    <TableCell className="font-mono text-xs">{s.schedule}</TableCell>
                    <TableCell>{s.copies ?? 1}</TableCell>
                    <TableCell>{s.encrypt ? <Badge variant="secondary">مشفّر</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs">{s.target_server_id ? serverName(s.target_server_id) : "—"}<div className="text-muted-foreground font-mono">{s.dest_path}</div></TableCell>
                    <TableCell className="text-xs">{s.last_run_at ? new Date(s.last_run_at).toLocaleString("ar") : "لم يُنفَّذ"}</TableCell>
                    <TableCell>
                      <Switch checked={!!s.is_active} onCheckedChange={async (v) => { await toggleFn({ data: { id: s.id, isActive: v } }); refresh(); }} />
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => doRun(s.id)}><Play className="w-3 h-3 ml-1" /> تنفيذ الآن</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setForm({ id: s.id, groupId: s.group_id ?? "", schedule: s.schedule, copies: s.copies ?? 3, encrypt: !!s.encrypt, destPath: s.dest_path ?? "", label: s.label ?? "", targetServerId: s.target_server_id ?? "", serverId: s.server_id ?? "", retentionCount: s.retention_count ?? 7, isActive: !!s.is_active }); setOpen(true); }}>تعديل</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="backups">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>الموقع</TableHead><TableHead>الوسم</TableHead><TableHead>نسخة</TableHead>
                <TableHead>الحالة</TableHead><TableHead>مشفّرة</TableHead><TableHead>تحقق</TableHead>
                <TableHead>التاريخ</TableHead><TableHead>إجراءات</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data.backups as any[]).slice(0, 100).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{siteName(b.website_id)}</TableCell>
                    <TableCell className="text-xs">{b.label}</TableCell>
                    <TableCell>{b.copy_index ?? 1}</TableCell>
                    <TableCell><Badge variant={b.status === "completed" ? "default" : b.status === "failed" ? "destructive" : "secondary"}>{b.status}</Badge></TableCell>
                    <TableCell>{b.encrypted ? "نعم" : "لا"}</TableCell>
                    <TableCell className="text-xs">{b.verified_at ? new Date(b.verified_at).toLocaleDateString("ar") : "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(b.created_at).toLocaleString("ar")}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={async () => { try { await verifyFn({ data: { backupId: b.id } }); toast.success("أُرسل أمر التحقق"); } catch (e: any) { toast.error(e.message); } }}><ShieldCheck className="w-3 h-3 ml-1" /> تحقق</Button>
                      <Button size="sm" variant="destructive" onClick={() => setRestoreTarget(b)}><RotateCcw className="w-3 h-3 ml-1" /> استعادة</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(data.backups as any[]).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد نسخ بعد — نفّذ سياسة لإنشاء أول نسخة</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="databases">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><DatabaseBackup className="w-4 h-4 text-primary" /> تهجير ومزامنة قواعد البيانات</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={migSource} onValueChange={setMigSource}>
                  <SelectTrigger><SelectValue placeholder="قاعدة المصدر" /></SelectTrigger>
                  <SelectContent>{(data.databases as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.name} — {d.host}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={migTarget} onValueChange={setMigTarget}>
                  <SelectTrigger><SelectValue placeholder="قاعدة الوجهة" /></SelectTrigger>
                  <SelectContent>{(data.databases as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.name} — {d.host}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={doMigrate} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "بدء التهجير"}</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>القاعدة</TableHead><TableHead>النوع</TableHead><TableHead>المضيف</TableHead>
                  <TableHead>الحالة</TableHead><TableHead>التهجير</TableHead><TableHead>جداول / صفوف</TableHead><TableHead>آخر مزامنة</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.databases as any[]).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}{d.is_primary && <Badge className="mr-2">رئيسية</Badge>}</TableCell>
                      <TableCell>{d.db_kind}</TableCell>
                      <TableCell className="font-mono text-xs">{d.host}{d.port ? `:${d.port}` : ""}</TableCell>
                      <TableCell><Badge variant={d.status === "online" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                      <TableCell><Badge variant={d.migration_status === "completed" ? "default" : "outline"}>{d.migration_status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs">{d.tables_count ?? 0} / {d.rows_count ?? 0}</TableCell>
                      <TableCell className="text-xs">{d.last_sync_at ? new Date(d.last_sync_at).toLocaleString("ar") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{form.id ? "تعديل سياسة النسخ" : "سياسة نسخ جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.groupId} onValueChange={(v) => setForm({ ...form, groupId: v })}>
              <SelectTrigger><SelectValue placeholder="المجموعة" /></SelectTrigger>
              <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="الجدولة (cron)" className="font-mono" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" min={1} max={5} value={form.copies} onChange={(e) => setForm({ ...form, copies: Number(e.target.value) })} placeholder="عدد النسخ" />
              <Input type="number" min={1} value={form.retentionCount} onChange={(e) => setForm({ ...form, retentionCount: Number(e.target.value) })} placeholder="مدة الاحتفاظ" />
            </div>
            <Input value={form.destPath} onChange={(e) => setForm({ ...form, destPath: e.target.value })} placeholder="مسار التخزين" className="font-mono" />
            <Select value={form.targetServerId} onValueChange={(v) => setForm({ ...form, targetServerId: v })}>
              <SelectTrigger><SelectValue placeholder="سيرفر الوجهة" /></SelectTrigger>
              <SelectContent>{(data.servers as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center justify-between"><span className="text-sm">تشفير النسخ</span><Switch checked={form.encrypt} onCheckedChange={(v) => setForm({ ...form, encrypt: v })} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">نشطة</span><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /></div>
          </div>
          <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تأكيد الاستعادة</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">ستُستبدل بيانات الموقع الحالية بمحتوى النسخة. اكتب «استعادة» للمتابعة.</p>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="استعادة" />
          <DialogFooter><Button variant="destructive" onClick={doRestore} disabled={busy}>تأكيد</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
