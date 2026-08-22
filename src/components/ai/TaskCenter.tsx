import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, Loader2, Play, Plus, Trash2, Terminal } from "lucide-react";
import { toast } from "sonner";
import { listAiTasks, saveAiTask, deleteAiTask, listTaskSteps, runAiTask } from "@/lib/workspace.functions";
import { listAiProviders } from "@/lib/ai-hub.functions";
import { EDIT_COMMAND_HINT, hasEditCommand } from "@/lib/ai-write-command";

const STAGE_LABEL: Record<string, string> = {
  planning: "التخطيط", reading: "القراءة والتحليل", editing: "التعديل", building: "البناء",
  verifying: "التحقّق", working: "قيد العمل", done: "منتهية", failed: "متوقفة",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-primary/15 text-primary",
  review: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
};

export function TaskCenter() {
  const qc = useQueryClient();
  const tasksFn = useServerFn(listAiTasks);
  const saveFn = useServerFn(saveAiTask);
  const delFn = useServerFn(deleteAiTask);
  const stepsFn = useServerFn(listTaskSteps);
  const runFn = useServerFn(runAiTask);
  const hubFn = useServerFn(listAiProviders);

  const [open, setOpen] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [command, setCommand] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ title: "", instructions: "", files: "", modelId: "" });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["ai-tasks"],
    queryFn: () => tasksFn(),
    refetchInterval: 5000,
  });
  const { data: hub } = useQuery({ queryKey: ["ai-hub"], queryFn: () => hubFn() });
  const models = (((hub as any)?.models ?? []) as any[]).filter((m) => m.is_active !== false);

  const { data: steps } = useQuery({
    queryKey: ["ai-task-steps", open?.id],
    enabled: !!open?.id,
    queryFn: () => stepsFn({ data: { taskId: open.id } }),
    refetchInterval: open ? 3000 : false,
  });

  const rows = (tasks as any[]) ?? [];

  async function handleRun(task: any) {
    const cmd = command[task.id] ?? "";
    setRunning(task.id);
    try {
      const r: any = await runFn({ data: { id: task.id, modelId: task.model_id ?? null, editCommand: cmd } });
      toast.success(r?.ok ? "انتهى تنفيذ المهمة" : "تم التشغيل");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(null);
      qc.invalidateQueries({ queryKey: ["ai-tasks"] });
      qc.invalidateQueries({ queryKey: ["ai-task-steps"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          كلّف نموذجاً بمهمة تطوير وتابع مراحلها لحظياً. {EDIT_COMMAND_HINT}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> مهمة نموذج</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>مهمة جديدة للنموذج</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>التعليمات</Label><Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
              <div><Label>الملفات المستهدفة (مفصولة بفاصلة)</Label><Input value={form.files} onChange={(e) => setForm({ ...form, files: e.target.value })} /></div>
              <div>
                <Label>النموذج المكلَّف</Label>
                <Select value={form.modelId} onValueChange={(v) => setForm({ ...form, modelId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر نموذجاً" /></SelectTrigger>
                  <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  if (!form.title.trim()) return toast.error("أدخل عنوان المهمة");
                  await saveFn({
                    data: {
                      title: form.title,
                      instructions: form.instructions,
                      filePaths: form.files.split(",").map((f) => f.trim()).filter(Boolean),
                      modelId: form.modelId || null,
                    },
                  });
                  setCreateOpen(false);
                  setForm({ title: "", instructions: "", files: "", modelId: "" });
                  qc.invalidateQueries({ queryKey: ["ai-tasks"] });
                  toast.success("تم إنشاء المهمة");
                }}
              >حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المهمة</TableHead>
                <TableHead className="text-right">النموذج</TableHead>
                <TableHead className="text-right">المرحلة</TableHead>
                <TableHead className="text-right">التقدّم</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">أمر التعديل</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline text-primary" /></TableCell></TableRow>
              ) : !rows.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد مهام للنماذج بعد</TableCell></TableRow>
              ) : rows.map((t) => (
                <TableRow key={t.id} className="hover:bg-secondary/40 cursor-pointer" onClick={() => setOpen(t)}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-xs">
                    <span onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={t.model_id ?? ""}
                        onValueChange={async (v) => {
                          await saveFn({ data: { id: t.id, title: t.title, instructions: t.instructions ?? "", filePaths: t.file_paths ?? [], modelId: v } });
                          qc.invalidateQueries({ queryKey: ["ai-tasks"] });
                        }}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="اختر نموذجاً" /></SelectTrigger>
                        <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{STAGE_LABEL[t.stage] ?? t.stage}</TableCell>
                  <TableCell className="w-40">
                    <div className="flex items-center gap-2">
                      <Progress value={Number(t.progress) || 0} className="h-2" />
                      <span className="text-xs text-muted-foreground">{Number(t.progress) || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={STATUS_TONE[t.status] ?? ""}>{t.status}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="w-52">
                    <Input
                      className="h-8 text-xs"
                      placeholder="مثال: عدّل الملف …"
                      value={command[t.id] ?? ""}
                      onChange={(e) => setCommand({ ...command, [t.id]: e.target.value })}
                    />
                    {hasEditCommand(command[t.id] ?? "") && (
                      <span className="text-[10px] text-success">أمر تعديل معتمد</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="w-8 h-8" disabled={running === t.id} onClick={() => handleRun(t)} title="تشغيل بالنموذج">
                        {running === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="w-8 h-8 text-destructive"
                        onClick={async () => { await delFn({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["ai-tasks"] }); }}
                        title="حذف"
                      ><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> {open?.title}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            <p className="text-muted-foreground whitespace-pre-wrap">{open?.instructions}</p>
            <div className="flex items-center gap-2">
              <Progress value={Number(open?.progress) || 0} className="h-2" />
              <span className="text-xs">{Number(open?.progress) || 0}%</span>
            </div>
            <div className="space-y-2">
              {((steps as any[]) ?? []).map((s) => (
                <div key={s.id} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.step_no}</Badge>
                    <span className="font-medium">{s.title}</span>
                    <Badge className={`ms-auto text-[10px] ${s.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                      {STAGE_LABEL[s.stage] ?? s.stage}
                    </Badge>
                  </div>
                  {s.tool_name && <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1"><Terminal className="w-3 h-3" /> {s.tool_name}</div>}
                  {s.detail && <pre className="text-[11px] mt-1 whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">{s.detail}</pre>}
                </div>
              ))}
              {!((steps as any[]) ?? []).length && <p className="text-muted-foreground text-xs">لا توجد خطوات مسجّلة بعد.</p>}
            </div>
            {open?.result && (
              <div><Label>النتيجة</Label><p className="whitespace-pre-wrap text-muted-foreground text-xs mt-1">{open.result}</p></div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
