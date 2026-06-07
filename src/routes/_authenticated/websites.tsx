import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw, Power, PowerOff, Copy, Loader2, Globe, CheckCircle2, WifiOff, XCircle } from "lucide-react";
import { verifyDns } from "@/lib/dns.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/websites")({
  component: WebsitesPage,
  head: () => ({ meta: [{ title: "المواقع — TVCC" }] }),
});

function WebsitesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: websites, isLoading } = useQuery({
    queryKey: ["websites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("websites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (websites || []).filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.domain.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((w) => w.id)));
  };

  const toggleOne = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    const { error } = await supabase.from("websites").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`تم حذف ${ids.length} موقع`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["websites"] });
  };

  const bulkToggleActive = async (active: boolean) => {
    const ids = Array.from(selected);
    const { error } = await supabase.from("websites").update({ is_active: active }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`تم ${active ? "تفعيل" : "تعطيل"} ${ids.length} موقع`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["websites"] });
  };

  const verifyWebsite = async (id: string, domain: string) => {
    toast.loading("جاري فحص DNS...", { id: `verify-${id}` });
    try {
      const res = await verifyDns({ data: { domain } });
      await supabase
        .from("websites")
        .update({
          verified: res.verified,
          status: res.verified ? "online" : "offline",
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", id);
      toast.success(
        res.verified ? `تم التحقق عبر ${res.method} — الموقع في الشبكة` : "لم يتم العثور على سجل _tvcc في DNS",
        { id: `verify-${id}` }
      );
      qc.invalidateQueries({ queryKey: ["websites"] });
    } catch {
      toast.error("تعذر فحص DNS", { id: `verify-${id}` });
    }
  };

  const statusVariant = (s: string) =>
    s === "online" ? "default" : s === "warning" ? "secondary" : s === "offline" ? "destructive" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">إدارة المواقع</h1>
          <p className="text-muted-foreground mt-1">جميع مواقعك في مكان واحد</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-1" /> إضافة موقع</Button>
          </DialogTrigger>
          <AddWebsiteDialog onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["websites"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            {selected.size > 0 && (
              <>
                <Badge variant="secondary">{selected.size} محدّد</Badge>
                <Button size="sm" variant="outline" onClick={() => bulkToggleActive(true)}>
                  <Power className="w-3 h-3 ml-1" /> تفعيل
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkToggleActive(false)}>
                  <PowerOff className="w-3 h-3 ml-1" /> تعطيل
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><Trash2 className="w-3 h-3 ml-1" /> حذف</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف {selected.size} موقع نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={bulkDelete}>تأكيد الحذف</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الدومين</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>كود التحقق</TableHead>
                <TableHead>مفعّل</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد مواقع</TableCell></TableRow>
              ) : (
                filtered.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggleOne(w.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{w.domain}</TableCell>
                    <TableCell><Badge variant={statusVariant(w.status)}>{w.status}</Badge></TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1 w-fit">
                        {w.verify_code.slice(0, 12)}…
                        <button onClick={() => { navigator.clipboard.writeText(w.verify_code); toast.success("تم النسخ"); }}>
                          <Copy className="w-3 h-3" />
                        </button>
                      </code>
                    </TableCell>
                    <TableCell>{w.is_active ? "نعم" : "لا"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => verifyWebsite(w.id, w.domain, w.verify_code)}>
                        <RefreshCw className="w-3 h-3 ml-1" /> تحقق
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddWebsiteDialog({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("websites").insert({ owner_id: user.id, name, domain, description });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم إضافة الموقع");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>إضافة موقع جديد</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>اسم الموقع</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>الدومين</Label>
          <Input required placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>الوصف (اختياري)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            حفظ
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
