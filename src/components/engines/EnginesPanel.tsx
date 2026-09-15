import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Download, Play, Rocket, Terminal, Cpu, Repeat, Pause } from "lucide-react";
import { ENGINES, defaultContext, type Engine, type EngineContext } from "@/lib/engines";
import {
  getEngineRuns,
  listEngineTargets,
  runEngine,
  runEngineBatch,
  listEngineSchedules,
  createEngineSchedule,
  updateEngineSchedule,
  runScheduleNow,
} from "@/lib/engines.functions";

export function EnginesPanel({ websites }: { websites: Array<{ id: string; name: string; domain: string; server_id: string | null }> }) {
  const qc = useQueryClient();
  const fetchTargets = useServerFn(listEngineTargets);
  const fetchRuns = useServerFn(getEngineRuns);
  const runOne = useServerFn(runEngine);
  const runMany = useServerFn(runEngineBatch);
  const fetchSchedules = useServerFn(listEngineSchedules);
  const addSchedule = useServerFn(createEngineSchedule);
  const patchSchedule = useServerFn(updateEngineSchedule);
  const fireSchedule = useServerFn(runScheduleNow);

  const [serverId, setServerId] = useState("");
  const [websiteId, setWebsiteId] = useState("");
  const [model, setModel] = useState("llama3.1");
  const [port, setPort] = useState("3000");
  const [rootPath, setRootPath] = useState("");
  const [repo, setRepo] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [open, setOpen] = useState<Engine | null>(null);
  const [busy, setBusy] = useState(false);
  const [intervalMin, setIntervalMin] = useState("60");

  const { data: targets } = useQuery({ queryKey: ["engine-targets"], queryFn: () => fetchTargets(), refetchInterval: 60000 });
  const { data: runs } = useQuery({
    queryKey: ["engine-runs", serverId],
    queryFn: () => fetchRuns({ data: { serverId } }),
    enabled: !!serverId,
    refetchInterval: 10000,
  });

  const { data: sched } = useQuery({
    queryKey: ["engine-schedules"],
    queryFn: () => fetchSchedules(),
    refetchInterval: 20000,
  });
  const schedules = (sched?.schedules ?? []) as any[];

  const servers = (targets?.servers ?? []) as any[];
  const agents = (targets?.agents ?? []) as any[];
  const models = (targets?.models ?? []) as any[];
  const site = websites.find((w) => w.id === websiteId);
  const server = servers.find((s) => s.id === serverId);

  const ctx: EngineContext = useMemo(
    () =>
      defaultContext({
        serverName: server?.name ?? "—",
        hostname: server?.hostname ?? "—",
        domain: site?.domain ?? "",
        siteName: site?.name ?? "",
        rootPath: rootPath || (site?.domain ? `/var/www/${site.domain}` : ""),
        port: Number(port) || 3000,
        model,
        repo,
      }),
    [server, site, rootPath, port, model, repo],
  );

  const hasAgent = agents.some((a) => a.server_id === serverId);

  const validate = (engine: Engine) => {
    if (!serverId) return "اختر سيرفراً أولاً";
    if (engine.needs.includes("site") && !websiteId) return "اختر موقعاً";
    if (engine.needs.includes("repo") && !repo) return "أدخل رابط المستودع";
    return "";
  };

  const execute = async (engine: Engine) => {
    setBusy(true);
    try {
      const res: any = await runOne({ data: { serverId, engineId: engine.id, websiteId: websiteId || null, ctx, dryRun } });
      toast.success(`أُرسلت ${res.queued} مهمة إلى الوكيل — ${engine.label}`);
      setOpen(null);
      qc.invalidateQueries({ queryKey: ["engine-runs", serverId] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  const executeAll = async (engine: Engine) => {
    const list = websites.filter((w) => w.server_id === serverId && w.domain);
    if (!list.length) return toast.error("لا توجد مواقع مرتبطة بهذا السيرفر");
    setBusy(true);
    try {
      const res: any = await runMany({
        data: {
          engineId: engine.id,
          dryRun,
          targets: list.map((w) => ({
            serverId,
            websiteId: w.id,
            ctx: { ...ctx, domain: w.domain, siteName: w.name, rootPath: `/var/www/${w.domain}` },
          })),
        },
      });
      toast.success(`أُرسلت ${res.queued} مهمة على ${list.length} موقعاً`);
      setOpen(null);
      qc.invalidateQueries({ queryKey: ["engine-runs", serverId] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التنفيذ الجماعي");
    } finally {
      setBusy(false);
    }
  };

  const schedule = async (engine: Engine) => {
    setBusy(true);
    try {
      await addSchedule({
        data: {
          engineId: engine.id,
          serverId,
          websiteId: websiteId || null,
          ctx,
          intervalMinutes: Number(intervalMin) || 60,
          dryRun,
          label: `${engine.label}${site?.domain ? ` — ${site.domain}` : ""}`,
        },
      });
      toast.success(`تم تفعيل التشغيل الدوري كل ${Number(intervalMin) || 60} دقيقة — بلا توقف`);
      setOpen(null);
      qc.invalidateQueries({ queryKey: ["engine-schedules"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر تفعيل الجدولة");
    } finally {
      setBusy(false);
    }
  };

  const toggleSchedule = async (id: string, isActive: boolean) => {
    try {
      await patchSchedule({ data: { id, isActive } });
      toast.success(isActive ? "استُؤنف التشغيل الدوري" : "أُوقف التشغيل الدوري");
      qc.invalidateQueries({ queryKey: ["engine-schedules"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التحديث");
    }
  };

  const script = open ? open.script(ctx) : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> شريط التشغيل
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1">
            <Label className="text-xs">السيرفر</Label>
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.hostname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الموقع</Label>
            <Select value={websiteId} onValueChange={(v) => { setWebsiteId(v); setRootPath(""); }}>
              <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
              <SelectContent>
                {websites.filter((w) => w.domain).slice(0, 300).map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name} — {w.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">النموذج المحلي</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} list="engine-models" placeholder="llama3.1" />
            <datalist id="engine-models">
              {models.map((m) => <option key={m.id} value={m.model_id ?? m.name} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">المنفذ</Label>
            <Input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">مستودع Git</Label>
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/..." dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">مسار الموقع</Label>
            <Input value={rootPath} onChange={(e) => setRootPath(e.target.value)} placeholder={ctx.rootPath} dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">التكرار (دقيقة)</Label>
            <Input value={intervalMin} onChange={(e) => setIntervalMin(e.target.value)} inputMode="numeric" />
          </div>
          <div className="md:col-span-3 lg:col-span-6 flex items-center gap-3 pt-1">
            <Switch id="dry" checked={dryRun} onCheckedChange={setDryRun} />
            <Label htmlFor="dry" className="text-sm">محاكاة (Dry Run) — بدون تغيير فعلي على السيرفر</Label>
            {serverId && (
              <Badge variant={hasAgent ? "default" : "destructive"} className="ms-auto">
                {hasAgent ? "وكيل متصل" : "لا يوجد وكيل مثبّت"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ENGINES.map((e) => (
          <Card key={e.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" /> {e.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground leading-5">{e.description}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[10px]">{e.group}</Badge>
                <Badge variant="outline" className="text-[10px] font-mono">{e.relation}</Badge>
              </div>
              <Button
                size="sm"
                className="mt-auto"
                onClick={() => {
                  const err = validate(e);
                  if (err) return toast.error(err);
                  setOpen(e);
                }}
              >
                <Play className="w-3.5 h-3.5 ml-1" /> معاينة وتشغيل
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" /> المحرّكات الدائمة (تشغيل دوري بلا توقف)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!schedules.length ? (
            <p className="text-sm text-muted-foreground">
              لا توجد جدولات بعد — افتح أي محرّك واضغط «تشغيل دوري» ليعمل تلقائياً بلا توقف.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المحرّك</TableHead><TableHead>كل</TableHead><TableHead>الحالة</TableHead>
                  <TableHead>آخر تشغيل</TableHead><TableHead>التشغيل القادم</TableHead><TableHead>مرات</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.label ?? s.engine_id}{s.dry_run ? " (محاكاة)" : ""}</TableCell>
                    <TableCell className="text-xs">{s.interval_minutes} د</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "secondary"}>
                        {s.is_active ? "يعمل" : "متوقف"}
                      </Badge>
                      {s.last_status === "failed" && (
                        <Badge variant="destructive" className="ms-1 text-[10px]">خطأ</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.last_run_at ? new Date(s.last_run_at).toLocaleString("ar") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.next_run_at ? new Date(s.next_run_at).toLocaleString("ar") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{s.run_count ?? 0}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => toggleSchedule(s.id, !s.is_active)}>
                        {s.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await fireSchedule({ data: { id: s.id } });
                            toast.success("سيبدأ التنفيذ خلال دقائق");
                            qc.invalidateQueries({ queryKey: ["engine-schedules"] });
                          } catch (e: any) {
                            toast.error(e?.message ?? "تعذّر التشغيل");
                          }
                        }}
                      >
                        تشغيل الآن
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" /> آخر المهام على السيرفر المختار
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!serverId ? (
            <p className="text-sm text-muted-foreground">اختر سيرفراً لعرض المهام الجارية.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الأمر</TableHead><TableHead>الحالة</TableHead><TableHead>المخرجات</TableHead><TableHead>الوقت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((runs?.commands ?? []) as any[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.action}{c.dry_run ? " (محاكاة)" : ""}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "done" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate font-mono text-[11px]" dir="ltr">{c.output ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader><DialogTitle>{open?.label} — السكربت الذي سيُنفَّذ</DialogTitle></DialogHeader>
          <Textarea value={script} readOnly rows={18} className="font-mono text-[11px]" dir="ltr" />
          <p className="text-xs text-muted-foreground">
            الأوامر المُرسلة إلى الوكيل: {open?.steps(ctx).map((s) => s.action).join(" ← ")}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(script); toast.success("نُسخ السكربت"); }}>
              <Copy className="w-4 h-4 ml-1" /> نسخ
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([script], { type: "text/x-shellscript" }));
                const a = document.createElement("a");
                a.href = url; a.download = `${open?.id}.sh`; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-4 h-4 ml-1" /> تنزيل .sh
            </Button>
            {open && open.needs.includes("site") && (
              <Button variant="secondary" disabled={busy} onClick={() => executeAll(open)}>
                تشغيل على كل مواقع السيرفر
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={() => open && schedule(open)}>
              <Repeat className="w-4 h-4 ml-1" /> تشغيل دوري كل {Number(intervalMin) || 60} دقيقة
            </Button>
            <Button disabled={busy} onClick={() => open && execute(open)}>
              <Play className="w-4 h-4 ml-1" /> تشغيل عبر الوكيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
