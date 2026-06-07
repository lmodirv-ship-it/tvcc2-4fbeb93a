import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListChecks, Loader2 } from "lucide-react";

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
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<any>(null);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["deployment_jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("deployment_jobs")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: targets } = useQuery({
    queryKey: ["deployment_job_targets", open?.id],
    enabled: !!open?.id,
    queryFn: async () =>
      (await (supabase as any).from("deployment_job_targets")
        .select("*, websites(name,domain)").eq("job_id", open.id)).data || [],
  });

  const filtered = (jobs || []).filter((j) => {
    if (tab === "all") return true;
    if (tab === "pending") return j.status === "queued";
    return j.status === tab;
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ListChecks className="w-7 h-7 text-primary" /> مركز المهام
        </h1>
        <p className="text-muted-foreground mt-1">تنفيذ التغييرات الجماعية ومتابعة نتائجها</p>
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
