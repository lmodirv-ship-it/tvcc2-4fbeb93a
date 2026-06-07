import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/storage")({
  component: Page,
  head: () => ({ meta: [{ title: "التخزين — TVCC" }] }),
});

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["storages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("storages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalUsed = data?.reduce((s, x) => s + Number(x.used_gb || 0), 0) || 0;
  const totalSize = data?.reduce((s, x) => s + Number(x.size_gb || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">التخزين</h1>
          <p className="text-muted-foreground mt-1">المستخدم: <span className="text-primary font-semibold">{totalUsed} GB</span> من {totalSize} GB</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> مساحة جديدة</Button></DialogTrigger>
          <AddDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["storages"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>المنطقة</TableHead><TableHead>الحجم</TableHead><TableHead>المستخدم</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow> :
                !data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد</TableCell></TableRow> :
                data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.storage_type}</TableCell>
                    <TableCell>{s.region || "—"}</TableCell>
                    <TableCell>{s.size_gb} GB</TableCell>
                    <TableCell>{s.used_gb} GB</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={async () => { if (confirm("حذف؟")) { await supabase.from("storages").delete().eq("id", s.id); qc.invalidateQueries({ queryKey: ["storages"] }); } }}><Trash2 className="w-3 h-3" /></Button></TableCell>
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
  const [name, setName] = useState("");
  const [storage_type, setType] = useState("s3");
  const [region, setRegion] = useState("");
  const [size_gb, setSize] = useState("0");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("storages").insert({ owner_id: user.id, name, storage_type, region, size_gb: Number(size_gb) });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>مساحة تخزين جديدة</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>الاسم</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>النوع</Label><Input value={storage_type} onChange={(e) => setType(e.target.value)} /></div>
        <div className="space-y-2"><Label>المنطقة</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
        <div className="space-y-2"><Label>الحجم (GB)</Label><Input type="number" value={size_gb} onChange={(e) => setSize(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
