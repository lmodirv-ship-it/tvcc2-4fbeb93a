import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Plus, RefreshCw, Server as ServerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getSyncScript,
  listSyncState,
  resyncSyncTable,
  toggleSyncSource,
  toggleSyncTable,
  upsertSyncSource,
} from "@/lib/dbsync.functions";

function fmt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SyncPanel() {
  const qc = useQueryClient();
  const load = useServerFn(listSyncState);
  const saveSource = useServerFn(upsertSyncSource);
  const toggleSource = useServerFn(toggleSyncSource);
  const toggleTable = useServerFn(toggleSyncTable);
  const resync = useServerFn(resyncSyncTable);
  const script = useServerFn(getSyncScript);

  const { data, isLoading } = useQuery({
    queryKey: ["dbsync-state"],
    queryFn: () => load({ data: undefined as never }),
    refetchInterval: 30_000,
  });

  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "سوبابيز المحلي",
    host: "192.168.100.66",
    port: 8000,
    schemaName: "public",
    serverId: "",
    intervalSeconds: 60,
    pgUrl: "",
  });

  const sources = data?.sources ?? [];
  const activeSource = useMemo(
    () => sources.find((s: any) => s.id === selectedSource) ?? sources[0] ?? null,
    [sources, selectedSource],
  );
  const tables = (data?.tables ?? []).filter((t: any) => t.source_id === activeSource?.id);
  const batches = (data?.batches ?? []).filter((b: any) => b.source_id === activeSource?.id);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dbsync-state"] });

  const createMutation = useMutation({
    mutationFn: () =>
      saveSource({
        data: {
          label: form.label,
          host: form.host,
          port: Number(form.port) || 8000,
          schemaName: form.schemaName,
          serverId: form.serverId || null,
          intervalSeconds: Number(form.intervalSeconds) || 60,
        },
      }),
    onSuccess: (res: any) => {
      toast.success("تم حفظ المصدر");
      setSelectedSource(res?.source?.id ?? null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر الحفظ"),
  });

  const scriptMutation = useMutation({
    mutationFn: (kind: "script" | "edge" | "heartbeat") =>
      script({ data: { sourceId: activeSource!.id, kind, pgUrl: form.pgUrl || undefined } }),
    onSuccess: (res: any) => download(res.filename, res.content),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر توليد الملف"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">مصدر محلي جديد</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">الاسم</Label>
            <Input className="h-8 text-xs" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">عنوان السيرفر</Label>
            <Input className="h-8 text-xs" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">المنفذ</Label>
            <Input className="h-8 text-xs" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">المخطط</Label>
            <Input className="h-8 text-xs" value={form.schemaName} onChange={(e) => setForm({ ...form, schemaName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">السيرفر المرتبط</Label>
            <Select value={form.serverId} onValueChange={(v) => setForm({ ...form, serverId: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختياري" /></SelectTrigger>
              <SelectContent>
                {(data?.servers ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} · {s.public_ip || s.private_ip || s.hostname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">كل كم ثانية</Label>
            <Input className="h-8 text-xs" type="number" value={form.intervalSeconds} onChange={(e) => setForm({ ...form, intervalSeconds: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-3">
            <Button size="sm" className="h-8 text-xs" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              <Plus className="size-3.5" /> حفظ المصدر
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm">المصادر المحلية</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={invalidate}>
            <RefreshCw className="size-3.5" /> تحديث
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-xs">الاسم</TableHead>
                <TableHead className="text-xs">العنوان</TableHead>
                <TableHead className="text-xs">الحالة</TableHead>
                <TableHead className="text-xs">آخر نبضة</TableHead>
                <TableHead className="text-xs">مفعّل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-xs">جارٍ التحميل…</TableCell></TableRow>}
              {!isLoading && !sources.length && (
                <TableRow><TableCell colSpan={5} className="text-xs text-muted-foreground">لا يوجد مصدر بعد.</TableCell></TableRow>
              )}
              {sources.map((s: any) => (
                <TableRow
                  key={s.id}
                  className={`cursor-pointer text-xs ${activeSource?.id === s.id ? "bg-muted/50" : ""}`}
                  onClick={() => setSelectedSource(s.id)}
                >
                  <TableCell className="font-medium">
                    <ServerIcon className="ms-0 me-1 inline size-3.5" />{s.label}
                  </TableCell>
                  <TableCell dir="ltr">{s.host}:{s.port}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "online" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                  </TableCell>
                  <TableCell>{fmt(s.last_beacon_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={(v) => toggleSource({ data: { id: s.id, active: v } }).then(invalidate)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {activeSource && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">طريقة الربط — {activeSource.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">رابط القاعدة المحلية (Direct / Transaction pooler)</Label>
                <Input
                  dir="ltr"
                  className="h-8 text-xs"
                  placeholder={`postgresql://postgres:****@${activeSource.host}:5432/postgres`}
                  value={form.pgUrl}
                  onChange={(e) => setForm({ ...form, pgUrl: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => scriptMutation.mutate("script")}>
                  <Download className="size-3.5" /> تنزيل سكريبت Node
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => scriptMutation.mutate("edge")}>
                  <Download className="size-3.5" /> تنزيل دالة Edge
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => scriptMutation.mutate("heartbeat")}>
                  <Download className="size-3.5" /> تنزيل نبضة القاعدة المحلية
                </Button>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                شغّل السكريبت على السيرفر المحلي: <code dir="ltr">node tvcc-dbsync.js --once</code> للتجربة، ثم{" "}
                <code dir="ltr">nohup node tvcc-dbsync.js &amp;</code> للعمل المستمر. أو انشر دالة Edge على سوبابيز المحلي
                ونادِها كل دقيقة. الاتجاه دائماً من المحلي إلى المنصة، والبيانات تُكتب في مخطط <code dir="ltr">local_mirror</code> بدون
                المساس بأي جدول قائم.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">الجداول ({tables.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-xs">الجدول</TableHead>
                    <TableHead className="text-xs">محلي</TableHead>
                    <TableHead className="text-xs">المنصة</TableHead>
                    <TableHead className="text-xs">الفارق</TableHead>
                    <TableHead className="text-xs">آخر مزامنة</TableHead>
                    <TableHead className="text-xs">الحالة</TableHead>
                    <TableHead className="text-xs">مفعّل</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tables.length && (
                    <TableRow><TableCell colSpan={8} className="text-xs text-muted-foreground">لم يُسجَّل أي جدول بعد — شغّل السكريبت مرة واحدة.</TableCell></TableRow>
                  )}
                  {tables.map((t: any) => (
                    <TableRow key={t.id} className="text-xs">
                      <TableCell className="font-medium">{t.table_name}</TableCell>
                      <TableCell>{t.local_rows}</TableCell>
                      <TableCell>{t.mirror_rows}</TableCell>
                      <TableCell className={Number(t.local_rows) - Number(t.mirror_rows) > 0 ? "text-destructive" : ""}>
                        {Number(t.local_rows) - Number(t.mirror_rows)}
                      </TableCell>
                      <TableCell>{fmt(t.last_sync_at)}</TableCell>
                      <TableCell>
                        <Badge variant={t.last_status === "synced" ? "default" : t.last_status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                          {t.last_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={t.is_enabled} onCheckedChange={(v) => toggleTable({ data: { id: t.id, enabled: v } }).then(invalidate)} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => resync({ data: { id: t.id } }).then(invalidate)}>
                          مطابقة كاملة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">سجل الدفعات</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-xs">الوقت</TableHead>
                    <TableHead className="text-xs">الجدول</TableHead>
                    <TableHead className="text-xs">مُرسل</TableHead>
                    <TableHead className="text-xs">مطبّق</TableHead>
                    <TableHead className="text-xs">المدة</TableHead>
                    <TableHead className="text-xs">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!batches.length && (
                    <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground">لا دفعات بعد.</TableCell></TableRow>
                  )}
                  {batches.map((b: any) => (
                    <TableRow key={b.id} className="text-xs">
                      <TableCell>{fmt(b.created_at)}</TableCell>
                      <TableCell>{b.table_name}</TableCell>
                      <TableCell>{b.rows_sent}</TableCell>
                      <TableCell>{b.rows_applied}</TableCell>
                      <TableCell>{b.duration_ms}ms</TableCell>
                      <TableCell>
                        <Badge variant={b.status === "success" ? "default" : "destructive"} className="text-[10px]">{b.status}</Badge>
                        {b.error && <span className="ms-2 text-[10px] text-destructive">{b.error}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
