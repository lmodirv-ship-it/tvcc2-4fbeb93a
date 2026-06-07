import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Server, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/domains")({
  component: DomainsPage,
  head: () => ({ meta: [{ title: "مدير النطاقات — TVCC" }] }),
});

function DomainsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ domain: "", registrar: "", expires_at: "", auto_renew: true, notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("domains").select("*").order("expires_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const add = async () => {
    if (!f.domain) return toast.error("الدومين مطلوب");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("domains").insert({
      owner_id: u.user!.id,
      domain: f.domain,
      registrar: f.registrar || null,
      expires_at: f.expires_at || null,
      auto_renew: f.auto_renew,
      notes: f.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("أُضيف الدومين");
    setF({ domain: "", registrar: "", expires_at: "", auto_renew: true, notes: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["domains"] });
  };

  const del = async (id: string) => {
    if (!confirm("حذف الدومين؟")) return;
    await (supabase as any).from("domains").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["domains"] });
  };

  const daysLeft = (d: string | null) => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Server className="w-7 h-7 text-primary" /> مدير النطاقات
          </h1>
          <p className="text-muted-foreground mt-1">إدارة جميع الدومينات وتواريخ انتهاء التسجيل</p>
        </div>
        <Button onClick={() => setOpen(!open)} className="bg-primary"><Plus className="w-4 h-4 ml-1" /> إضافة دومين</Button>
      </div>

      {open && (
        <Card className="ring-1 ring-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>الدومين *</Label><Input dir="ltr" className="mt-1 bg-secondary/40" placeholder="example.com" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} /></div>
              <div><Label>المسجل</Label><Input className="mt-1 bg-secondary/40" placeholder="GoDaddy / Namecheap" value={f.registrar} onChange={(e) => setF({ ...f, registrar: e.target.value })} /></div>
              <div><Label>ينتهي في</Label><Input type="date" className="mt-1 bg-secondary/40" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
              <div className="flex items-end"><div className="flex items-center justify-between w-full rounded-md border border-border/40 p-3 bg-secondary/30"><Switch checked={f.auto_renew} onCheckedChange={(c) => setF({ ...f, auto_renew: c })} /><Label className="text-sm">تجديد تلقائي</Label></div></div>
            </div>
            <Button onClick={add} className="bg-primary">حفظ</Button>
          </CardContent>
        </Card>
      )}

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-0">
          {isLoading ? <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          : !data?.length ? <div className="p-12 text-center text-muted-foreground">لا دومينات بعد</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">الدومين</TableHead>
                <TableHead className="text-right">المسجل</TableHead>
                <TableHead className="text-right">ينتهي</TableHead>
                <TableHead className="text-right">الأيام المتبقية</TableHead>
                <TableHead className="text-right">تجديد</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((d) => {
                  const dl = daysLeft(d.expires_at);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{d.domain}</TableCell>
                      <TableCell className="text-xs">{d.registrar || "—"}</TableCell>
                      <TableCell className="text-xs" dir="ltr">{d.expires_at ? new Date(d.expires_at).toLocaleDateString("ar") : "—"}</TableCell>
                      <TableCell>{dl === null ? "—" : <Badge variant={dl < 15 ? "destructive" : dl < 30 ? "outline" : "secondary"}>{dl} يوم</Badge>}</TableCell>
                      <TableCell>{d.auto_renew ? <Badge className="bg-success/20 text-success border-success/40">نعم</Badge> : <Badge variant="outline">لا</Badge>}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => del(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
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
