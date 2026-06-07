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

export const Route = createFileRoute("/_authenticated/users")({
  component: Page,
  head: () => ({ meta: [{ title: "المستخدمون الموحدون — TVCC" }] }),
});

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["site_users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_users").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المستخدمون الموحدون</h1>
          <p className="text-muted-foreground mt-1">حساب واحد يصل لعدة مواقع</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> مستخدم جديد</Button></DialogTrigger>
          <AddDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["site_users"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>المعرف</TableHead><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow> :
                !data?.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا يوجد</TableCell></TableRow> :
                data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{u.external_id}</code></TableCell>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={async () => { if (confirm("حذف؟")) { await supabase.from("site_users").delete().eq("id", u.id); qc.invalidateQueries({ queryKey: ["site_users"] }); } }}><Trash2 className="w-3 h-3" /></Button></TableCell>
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
  const [email, setEmail] = useState("");
  const [full_name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("site_users").insert({ owner_id: user.id, email, full_name });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>مستخدم موحد جديد</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>الاسم</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>البريد</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
