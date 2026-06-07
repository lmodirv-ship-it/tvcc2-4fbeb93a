import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LifeBuoy, Plus, Trash2, RotateCcw, Database, HardDrive, FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recovery")({
  component: RecoveryPage,
  head: () => ({ meta: [{ title: "مركز الاسترداد — TVCC" }] }),
});

function RecoveryPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ website_id: "", point_type: "full", label: "", notes: "" });

  const { data: websites } = useQuery({
    queryKey: ["websites-recovery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("websites").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: points, isLoading } = useQuery({
    queryKey: ["recovery-points"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("recovery_points").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const websiteName = (id: string) => websites?.find((w) => w.id === id)?.name || "—";

  const add = async () => {
    if (!f.website_id) return toast.error("اختر موقعاً");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("recovery_points").insert({
      owner_id: u.user!.id, website_id: f.website_id, point_type: f.point_type,
      label: f.label || `${f.point_type} - ${new Date().toISOString().slice(0, 10)}`,
      notes: f.notes || null, status: "available",
    });
    if (error) return toast.error(error.message);
    toast.success("أُنشئت نقطة استرداد");
    setF({ website_id: "", point_type: "full", label: "", notes: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["recovery-points"] });
  };

  const del = async (id: string) => {
    if (!confirm("حذف نقطة الاسترداد؟")) return;
    await (supabase as any).from("recovery_points").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["recovery-points"] });
  };

  const restore = (p: any) => {
    toast.info(`بدء الاسترداد من: ${p.label} (سيتم تنفيذه عبر HN-Cloud)`);
  };

  const typeIcon = (t: string) => t === "database" ? Database : t === "files" ? FileArchive : HardDrive;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LifeBuoy className="w-7 h-7 text-primary" /> مركز الاسترداد
          </h1>
          <p className="text-muted-foreground mt-1">نقاط استرداد للمواقع وقواعد البيانات — كل شيء من مكان واحد</p>
        </div>
        <Button onClick={() => setOpen(!open)} className="bg-primary"><Plus className="w-4 h-4 ml-1" /> نقطة استرداد جديدة</Button>
      </div>

      {open && (
        <Card className="ring-1 ring-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>الموقع *</Label>
                <Select value={f.website_id} onValueChange={(v) => setF({ ...f, website_id: v })}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {websites?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={f.point_type} onValueChange={(v) => setF({ ...f, point_type: v })}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">كامل (موقع + قاعدة بيانات + ملفات)</SelectItem>
                    <SelectItem value="database">قاعدة بيانات فقط</SelectItem>
                    <SelectItem value="files">ملفات فقط</SelectItem>
                    <SelectItem value="website">موقع فقط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>تسمية</Label><Input className="mt-1 bg-secondary/40" placeholder="قبل التحديث الكبير" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
            <Button onClick={add} className="bg-primary">إنشاء</Button>
          </CardContent>
        </Card>
      )}

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-0">
          {isLoading ? <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          : !points?.length ? <div className="p-12 text-center text-muted-foreground">لا نقاط استرداد بعد</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">التسمية</TableHead>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">الحجم</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {points.map((p: any) => {
                  const Icon = typeIcon(p.point_type);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.label}</TableCell>
                      <TableCell className="text-xs">{websiteName(p.website_id)}</TableCell>
                      <TableCell><Badge variant="outline" className="gap-1"><Icon className="w-3 h-3" /> {p.point_type}</Badge></TableCell>
                      <TableCell className="text-xs">{p.size_mb ? `${Number(p.size_mb).toFixed(1)} MB` : "—"}</TableCell>
                      <TableCell><Badge className={p.status === "available" ? "bg-success/20 text-success border-success/40" : ""}>{p.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("ar")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => restore(p)} title="استرداد"><RotateCcw className="w-4 h-4 text-primary" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
