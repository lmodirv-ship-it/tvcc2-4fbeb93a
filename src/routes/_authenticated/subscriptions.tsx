import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  component: SubscriptionsPage,
  head: () => ({ meta: [{ title: "الاشتراكات — TVCC" }] }),
});

function SubscriptionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: subs, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = subs?.reduce((s, x) => s + Number(x.price || 0), 0) || 0;

  const del = async (id: string) => {
    if (!confirm("حذف الاشتراك؟")) return;
    await supabase.from("subscriptions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subscriptions"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الاشتراكات</h1>
          <p className="text-muted-foreground mt-1">إجمالي الإيرادات: <span className="text-primary font-semibold">{total} USD</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> اشتراك جديد</Button></DialogTrigger>
          <AddDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["subscriptions"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الخطة</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ البدء</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow> :
                !subs?.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد اشتراكات</TableCell></TableRow> :
                subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.plan_name}</TableCell>
                    <TableCell>{s.price} {s.currency}</TableCell>
                    <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell>{new Date(s.starts_at).toLocaleDateString("ar")}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="w-3 h-3" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddDialog({ onDone }: { onDone: () => void }) {
  const [plan_name, setPlan] = useState("");
  const [price, setPrice] = useState("0");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("subscriptions").insert({ owner_id: user.id, plan_name, price: Number(price) });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>اشتراك جديد</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>اسم الخطة</Label><Input required value={plan_name} onChange={(e) => setPlan(e.target.value)} /></div>
        <div className="space-y-2"><Label>السعر</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
