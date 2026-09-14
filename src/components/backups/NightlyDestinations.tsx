import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HardDrive, Loader2, Play, Trash2, RefreshCw, Download, FileCode } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listBackupDestinations, saveBackupDestination, toggleBackupDestination,
  deleteBackupDestination, runBackupDestinationNow, listOwnerServers, getStorageScript,
} from "@/lib/backup-destinations.functions";

const copyStyle = (s: string) =>
  s === "completed"
    ? "bg-success/20 text-success border-success/40"
    : s === "failed"
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";

const pctStyle = (p?: number | null) =>
  p == null
    ? "bg-muted text-muted-foreground border-border"
    : p >= 90
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : p >= 75
        ? "bg-warning/20 text-warning border-warning/40"
        : "bg-success/20 text-success border-success/40";

const fmtMb = (mb?: number | null) =>
  mb == null ? "—" : mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

const fmtSize = (b?: number | null) =>
  !b ? "—" : b > 1024 * 1024 * 1024
    ? `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;

/** وجهات النسخ الليلي: سيرفر التخزين + حالة نسخة كل موقع (أولى/حالية). */
export function NightlyDestinations() {
  const qc = useQueryClient();
  const load = useServerFn(listBackupDestinations);
  const save = useServerFn(saveBackupDestination);
  const toggle = useServerFn(toggleBackupDestination);
  const remove = useServerFn(deleteBackupDestination);
  const runNow = useServerFn(runBackupDestinationNow);
  const loadServers = useServerFn(listOwnerServers);
  const script = useServerFn(getStorageScript);

  const [form, setForm] = useState({
    name: "", host: "", username: "root", port: 22, password: "",
    basePath: "/srv/tvcc-backups", isEnabled: true,
    storageServerId: "" as string,
    scope: "all" as "all" | "verified",
  });
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["backup-destinations"],
    queryFn: () => load({ data: {} as never }),
    refetchInterval: 30000,
  });

  const { data: serversData } = useQuery({
    queryKey: ["owner-servers"],
    queryFn: () => loadServers({ data: {} as never }),
  });
  const servers = (serversData?.servers ?? []) as any[];

  const destinations = (data?.destinations ?? []) as any[];
  const copies = (data?.copies ?? []) as any[];

  const bySite = useMemo(() => {
    type Row = { domain: string; first?: any; current?: any };
    const map = new Map<string, Row>();
    for (const c of copies) {
      const entry: { domain: string; first?: any; current?: any } =
        map.get(c.domain) ?? { domain: c.domain };
      if (c.copy_kind === "first") entry.first = c;
      else entry.current = c;
      map.set(c.domain, entry);
    }
    const list = [...map.values()].sort((a, b) => a.domain.localeCompare(b.domain));
    const q = search.trim().toLowerCase();
    return q ? list.filter((r) => r.domain.toLowerCase().includes(q)) : list;
  }, [copies, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["backup-destinations"] });

  const formValid =
    form.name.trim().length > 0 && form.host.trim().length > 0 && form.basePath.trim().length > 0;

  const create = useMutation({
    mutationFn: async () => {
      if (!formValid) throw new Error("املأ الاسم وعنوان السيرفر والمسار");
      return save({ data: form });
    },
    onSuccess: () => {
      toast.success("تم حفظ وجهة النسخ");
      setForm({ ...form, name: "", host: "", password: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "تعذّر الحفظ"),
  });

  const run = useMutation({
    mutationFn: (id: string) => runNow({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`تم جدولة ${r.queued} نسخة (${r.sites} موقع مُثبت الملكية)`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "تعذّر التشغيل"),
  });

  // تشغيل تلقائي بدون تدخل: أي وجهة جاهزة لم تعمل منذ 24 ساعة تُشغَّل تلقائياً.
  const autoFired = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const d of destinations) {
      if (!d.ready || autoFired.current.has(d.id)) continue;
      const last = d.last_run_at ? new Date(d.last_run_at).getTime() : 0;
      if (Date.now() - last < 24 * 3600 * 1000) continue;
      autoFired.current.add(d.id);
      runNow({ data: { id: d.id } })
        .then(() => { toast.success(`تشغيل تلقائي للنسخ: ${d.name}`); invalidate(); })
        .catch(() => autoFired.current.delete(d.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations]);

  const exportCsv = () => {
    const header = "domain,first_status,first_size,current_status,current_updated\n";
    const body = bySite
      .map((r) =>
        [r.domain, r.first?.status ?? "-", r.first?.size_bytes ?? "", r.current?.status ?? "-", r.current?.updated_at ?? ""].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "site-backup-copies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">إضافة سيرفر تخزين للنسخ الليلي</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم الوجهة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="سيرفر النسخ الرئيسي" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">عنوان السيرفر</Label>
              <Input dir="ltr" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.100.66" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">اسم المستخدم</Label>
              <Input dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">كلمة السر</Label>
              <Input dir="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="تُحفظ مشفّرة" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المسار</Label>
              <Input dir="ltr" value={form.basePath} onChange={(e) => setForm({ ...form, basePath: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المنفذ</Label>
              <Input dir="ltr" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 22 })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={form.isEnabled} onCheckedChange={(v) => setForm({ ...form, isEnabled: v })} />
              تفعيل النسخ الليلي (كل يوم 00:00)
            </label>
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !formValid}>
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null} حفظ الوجهة
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            داخل المسار يُنشأ مجلد باسم كل موقع، وبداخله <span dir="ltr">first/</span> للنسخة الأولى (لا تُستبدل) و<span dir="ltr">current/</span> للنسخة الحالية (تُستبدل كل ليلة). يشمل ذلك المواقع المُثبتة ملكيتها عبر سجل TXT في إعدادات DNS فقط.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : destinations.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">لا توجد وجهات نسخ بعد.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوجهة</TableHead>
                  <TableHead>السيرفر</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>الذاكرة (مستعملة / حرة)</TableHead>
                  <TableHead>التخزين (ممتلئ / فارغ)</TableHead>
                  <TableHead>التفاعل</TableHead>
                  <TableHead>سرعة الاستجابة</TableHead>
                  <TableHead>آخر تشغيل</TableHead>
                  <TableHead>مفعّل</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {destinations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs font-medium">{d.name}</TableCell>
                    <TableCell className="text-xs" dir="ltr">{d.username}@{d.host}:{d.port}</TableCell>
                    <TableCell className="text-xs" dir="ltr">{d.base_path}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {d.metrics?.mem_total_mb ? (
                        <>
                          <span className="tabular-nums">{fmtMb(d.metrics.mem_used_mb)} / {fmtMb(d.metrics.mem_free_mb)}</span>
                          <Badge variant="outline" className={`mr-1 text-[10px] ${pctStyle(d.metrics.mem_percent)}`}>{d.metrics.mem_percent}%</Badge>
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {d.metrics?.disk_total_gb ? (
                        <>
                          <span className="tabular-nums">{d.metrics.disk_used_gb ?? 0} / {d.metrics.disk_free_gb} GB</span>
                          <Badge variant="outline" className={`mr-1 text-[10px] ${pctStyle(d.metrics.disk_percent)}`}>{d.metrics.disk_percent}%</Badge>
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge variant="outline" className={d.agent_online ? "bg-success/20 text-success border-success/40 text-[10px]" : "bg-destructive/20 text-destructive border-destructive/40 text-[10px]"}>
                        {d.agent_online ? "متفاعل" : "غير متفاعل"}
                      </Badge>
                      {d.metrics?.link_quality != null && (
                        <span className="text-muted-foreground mr-1">{d.metrics.link_quality}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap tabular-nums">
                      {d.metrics?.latency_ms != null ? `${Math.round(d.metrics.latency_ms)} ms` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.last_run_at ? new Date(d.last_run_at).toLocaleString("ar") : "—"}
                      {d.last_run_summary?.queued != null && (
                        <Badge variant="outline" className="mr-1 text-[10px]">{d.last_run_summary.queued} مهمة</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={d.is_enabled}
                        onCheckedChange={async (v) => {
                          await toggle({ data: { id: d.id, isEnabled: v } });
                          invalidate();
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          title={d.ready ? "يعمل تلقائياً كل 24 ساعة" : !d.is_enabled ? "الوجهة غير مفعّلة" : "لا يوجد وكيل متصل على سيرفر الوجهة"}
                          className={d.ready
                            ? "border-success/50 bg-success/15 text-success hover:bg-success/25"
                            : "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25"}
                          onClick={() => run.mutate(d.id)}
                          disabled={run.isPending}
                        >
                          {run.isPending ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Play className="w-3 h-3 ml-1" />} تشغيل الآن
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`حذف الوجهة «${d.name}»؟ لن تُحذف أي نسخة على السيرفر.`)) return;
                            await remove({ data: { id: d.id } });
                            invalidate();
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">نسخ المواقع ({bySite.length})</h3>
            <div className="flex items-center gap-2">
              <Input className="h-8 w-48" placeholder="بحث بالنطاق…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button size="sm" variant="outline" onClick={invalidate}><RefreshCw className="w-3 h-3 ml-1" /> تحديث</Button>
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-3 h-3 ml-1" /> CSV</Button>
            </div>
          </div>
          {bySite.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد نسخ بعد — فعّل وجهة ثم اضغط «تشغيل الآن».</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموقع</TableHead>
                  <TableHead>النسخة الأولى</TableHead>
                  <TableHead>النسخة الحالية</TableHead>
                  <TableHead>الحجم</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySite.map((r) => (
                  <TableRow key={r.domain}>
                    <TableCell className="text-xs" dir="ltr">{r.domain}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={copyStyle(r.first?.status ?? "")}>{r.first?.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={copyStyle(r.current?.status ?? "")}>{r.current?.status ?? "—"}</Badge>
                      {r.current?.error_message && (
                        <span className="block text-[10px] text-destructive mt-1">{String(r.current.error_message).slice(0, 80)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{fmtSize(r.current?.size_bytes ?? r.first?.size_bytes)}</TableCell>
                    <TableCell className="text-xs">
                      {r.current?.updated_at ? new Date(r.current.updated_at).toLocaleString("ar") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
