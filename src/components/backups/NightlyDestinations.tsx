import { useMemo, useState } from "react";
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
import { HardDrive, Loader2, Play, Trash2, RefreshCw, Download } from "lucide-react";
import {
  listBackupDestinations, saveBackupDestination, toggleBackupDestination,
  deleteBackupDestination, runBackupDestinationNow,
} from "@/lib/backup-destinations.functions";

const copyStyle = (s: string) =>
  s === "completed"
    ? "bg-success/20 text-success border-success/40"
    : s === "failed"
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";

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

  const [form, setForm] = useState({
    name: "", host: "", username: "root", port: 22, password: "",
    basePath: "/srv/tvcc-backups", isEnabled: true,
  });
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["backup-destinations"],
    queryFn: () => load({ data: {} as never }),
    refetchInterval: 30000,
  });

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

  const create = useMutation({
    mutationFn: () => save({ data: form }),
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
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
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
                        <Button size="sm" variant="outline" onClick={() => run.mutate(d.id)} disabled={run.isPending}>
                          <Play className="w-3 h-3 ml-1" /> تشغيل الآن
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
