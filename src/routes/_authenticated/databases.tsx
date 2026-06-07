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
import { Plus, Trash2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/databases")({
  component: Page,
  head: () => ({ meta: [{ title: "قواعد البيانات — TVCC" }] }),
});

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["databases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("databases").select("id,name,db_type,host,db_user,size_mb,status,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = async (id: string) => {
    if (!confirm("حذف قاعدة البيانات؟")) return;
    await supabase.from("databases").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["databases"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">قواعد البيانات</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> كلمات المرور لا تُعرض بعد الحفظ</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> قاعدة بيانات جديدة</Button></DialogTrigger>
          <AddDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["databases"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>المضيف</TableHead><TableHead>المستخدم</TableHead><TableHead>الحجم (MB)</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow> :
                !data?.length ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد</TableCell></TableRow> :
                data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.db_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.host?.slice(0, 20) || "—"}</TableCell>
                    <TableCell>{d.db_user || "—"}</TableCell>
                    <TableCell>{d.size_mb || 0}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => del(d.id)}><Trash2 className="w-3 h-3" /></Button></TableCell>
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
  const [host, setHost] = useState("");
  const [db_user, setUser] = useState("");
  const [password, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // store password hash placeholder — real hashing should be server-side
    const password_hash = password ? btoa(password) : null;
    const { error } = await supabase.from("databases").insert({ owner_id: user.id, name, host, db_user, password_hash });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>قاعدة بيانات جديدة</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>الاسم</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>المضيف</Label><Input value={host} onChange={(e) => setHost(e.target.value)} /></div>
        <div className="space-y-2"><Label>المستخدم</Label><Input value={db_user} onChange={(e) => setUser(e.target.value)} /></div>
        <div className="space-y-2"><Label>كلمة المرور</Label><Input type="password" value={password} onChange={(e) => setPwd(e.target.value)} /><p className="text-xs text-muted-foreground">لن تُعرض مرة أخرى بعد الحفظ</p></div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
