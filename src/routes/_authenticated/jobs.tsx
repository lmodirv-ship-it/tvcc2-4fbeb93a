import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListChecks, Loader2, Play, RotateCcw, Trash2, Plus, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createJob, runJob, deleteJob } from "@/lib/jobs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: JobsPage,
  head: () => ({ meta: [{ title: "المهام — TVCC" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  queued: "في الانتظار", running: "قيد التنفيذ", completed: "مكتملة", failed: "فاشلة",
};
const STATUS_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
};

function JobsPage() {
  const qc = useQueryClient();
  const createJobFn = useServerFn(createJob);
  const runJobFn = useServerFn(runJob);
  const deleteJobFn = useServerFn(deleteJob);
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["deployment_jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("deployment_jobs")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 5000,
  });

  const { data: targets } = useQuery({
    queryKey: ["deployment_job_targets", open?.id],
    enabled: !!open?.id,
    queryFn: async () =>
      (await (supabase as any).from("deployment_job_targets")
        .select("*, websites(name,domain)").eq("job_id", open.id)).data || [],
    refetchInterval: open ? 3000 : false,
  });

  useEffect(() => {
    const ch = supabase
      .channel("jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "deployment_jobs" }, () => {
        qc.invalidateQueries({ queryKey: ["deployment_jobs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deployment_job_targets" }, () => {
        qc.invalidateQueries({ queryKey: ["deployment_job_targets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function handleRun(id: string, retry = false) {
    setRunning(id);
    try {
      const r = await runJobFn({ data: { job_id: id, retry_failed: retry } });
      if (r.ok) toast.success(`تم التنفيذ — نجح ${r.success} / فشل ${r.failed}`);
      else toast.error(r.error || "فشل التنفيذ");
      qc.invalidateQueries({ queryKey: ["deployment_jobs"] });
      qc.invalidateQueries({ queryKey: ["deployment_job_targets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setRunning(null); }
  }
  async function handleDelete(id: string) {
    const r = await deleteJobFn({ data: { job_id: id } });
    if (r.ok) { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["deployment_jobs"] }); }
    else toast.error(r.error || "فشل الحذف");
  }

  const filtered = (jobs || []).filter((j) => {
    if (tab === "all") return true;
    if (tab === "pending") return j.status === "queued";
    return j.status === tab;
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ListChecks className="w-7 h-7 text-primary" /> مركز المهام
            </h1>
            <p className="text-muted-foreground mt-1">تنفيذ التغييرات الجماعية ومتابعة نتائجها</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["deployment_jobs"] })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary"><Plus className="w-4 h-4 ml-1" /> مهمة جديدة</Button>
              </DialogTrigger>
              <CreateJobDialog
                onDone={async (payload) => {
                  const r = await createJobFn({ data: payload });
                  if (!r.ok) { toast.error(r.error || "فشل الإنشاء"); return; }
                  toast.success(`تم إنشاء المهمة (${r.target_count} موقع)`);
                  setCreateOpen(false);
                  qc.invalidateQueries({ queryKey: ["deployment_jobs"] });
                  if (r.job_id) handleRun(r.job_id);
                }}
              />
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">الكل ({jobs?.length || 0})</TabsTrigger>
          <TabsTrigger value="pending">في الانتظار</TabsTrigger>
          <TabsTrigger value="running">قيد التنفيذ</TabsTrigger>
          <TabsTrigger value="completed">مكتملة</TabsTrigger>
          <TabsTrigger value="failed">فاشلة</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                    <TableHead className="text-right">النطاق</TableHead>
                    <TableHead className="text-right">التقدم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin inline text-primary" />
                    </TableCell></TableRow>
                  ) : !filtered.length ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      لا توجد مهام في هذا التصنيف
                    </TableCell></TableRow>
                  ) : filtered.map((j) => (
                    <TableRow key={j.id} className="cursor-pointer hover:bg-secondary/40" onClick={() => setOpen(j)}>
                      <TableCell className="font-medium">{j.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{j.action_type}</TableCell>
                      <TableCell className="text-sm">{j.scope_type}</TableCell>
                      <TableCell className="text-sm">
                        <span className="text-success">{j.success_count}</span>
                        {" / "}
                        <span className="text-destructive">{j.error_count}</span>
                        {" / "}
                        <span>{j.target_count}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_TONE[j.status] || ""}>{STATUS_LABEL[j.status] || j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(j.created_at).toLocaleString("ar")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {(j.status === "queued" || j.status === "running") && (
                            <Button size="icon" variant="ghost" className="w-8 h-8" disabled={running === j.id} onClick={() => handleRun(j.id)} title="تشغيل">
                              {running === j.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </Button>
                          )}
                          {j.status === "failed" && (
                            <Button size="icon" variant="ghost" className="w-8 h-8" disabled={running === j.id} onClick={() => handleRun(j.id, true)} title="إعادة المحاولة">
                              {running === j.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف المهمة؟</AlertDialogTitle>
                                <AlertDialogDescription>سيتم حذف المهمة وأهدافها نهائياً.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(j.id)}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="left" className="w-[480px] sm:w-[600px]" dir="rtl">
          <SheetHeader><SheetTitle>{open?.title}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <div className="text-2xl font-bold text-success">{open?.success_count || 0}</div>
                <div className="text-xs text-muted-foreground">نجح</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <div className="text-2xl font-bold text-destructive">{open?.error_count || 0}</div>
                <div className="text-xs text-muted-foreground">فشل</div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <div className="text-2xl font-bold">{open?.target_count || 0}</div>
                <div className="text-xs text-muted-foreground">الإجمالي</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-sm">المواقع المستهدفة</h3>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {targets?.length ? targets.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded border border-border/40 text-sm">
                    <Badge className={STATUS_TONE[t.status] || ""} variant="outline">{STATUS_LABEL[t.status] || t.status}</Badge>
                    <div className="text-right">
                      <div className="font-medium">{t.websites?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{t.websites?.domain}</div>
                    </div>
                  </div>
                )) : <div className="text-center text-muted-foreground text-sm py-6">لا توجد بيانات</div>}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CreateJobDialog({ onDone }: { onDone: (p: {
  title: string; action_type: "health_check" | "toggle_active" | "verify_dns" | "broadcast_footer";
  scope_type: "all" | "group"; scope_id?: string | null; payload?: Record<string, unknown>;
}) => Promise<void> | void }) {
  const [title, setTitle] = useState("فحص صحة جميع المواقع");
  const [action, setAction] = useState<"health_check" | "toggle_active" | "verify_dns" | "broadcast_footer">("health_check");
  const [scope, setScope] = useState<"all" | "group">("all");
  const [groupId, setGroupId] = useState<string>("");
  const [enable, setEnable] = useState(true);
  const [footerHtml, setFooterHtml] = useState('<div dir="rtl" style="text-align:center;padding:12px;color:#94a3b8;font-size:13px;">© 2026 جميع الحقوق محفوظة El Hassani Moulay Ismail · Groupe HN</div>');
  const [submitting, setSubmitting] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ["site_groups"],
    queryFn: async () => (await (supabase as any).from("site_groups").select("id,name").order("name")).data || [],
  });

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>مهمة جديدة</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>العنوان</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>الإجراء</Label>
          <Select value={action} onValueChange={(v) => setAction(v as never)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="health_check">فحص صحة</SelectItem>
              <SelectItem value="verify_dns">التحقق من DNS</SelectItem>
              <SelectItem value="toggle_active">تفعيل / تعطيل</SelectItem>
              <SelectItem value="broadcast_footer">نشر الفوتر</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>النطاق</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as never)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المواقع النشطة</SelectItem>
              <SelectItem value="group">مجموعة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scope === "group" && (
          <div>
            <Label>المجموعة</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="اختر مجموعة" /></SelectTrigger>
              <SelectContent>
                {(groups as any[] || []).map((g) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
        {action === "toggle_active" && (
          <div>
            <Label>الحالة</Label>
            <Select value={enable ? "on" : "off"} onValueChange={(v) => setEnable(v === "on")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">تفعيل</SelectItem>
                <SelectItem value="off">تعطيل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {action === "broadcast_footer" && (
          <div>
            <Label>HTML الفوتر</Label>
            <Input value={footerHtml} onChange={(e) => setFooterHtml(e.target.value)} />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          disabled={submitting || (scope === "group" && !groupId)}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onDone({
                title, action_type: action, scope_type: scope,
                scope_id: scope === "group" ? groupId : null,
                payload: action === "toggle_active" ? { enable } : action === "broadcast_footer" ? { html: footerHtml } : {},
              });
            } finally { setSubmitting(false); }
          }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Play className="w-4 h-4 ml-1" />}
          إنشاء وتشغيل
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
