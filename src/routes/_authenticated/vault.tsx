import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KeyRound, Plus, Eye, EyeOff, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listVaultSecrets, createVaultSecret, rotateVaultSecret, deleteVaultSecret, revealVaultSecret } from "@/lib/server-ops.functions";

export const Route = createFileRoute("/_authenticated/vault")({
  component: VaultPage,
  head: () => ({
    meta: [
      { title: "خزنة الأسرار — TVCC" },
      { name: "description", content: "إدارة آمنة لمفاتيح API والرموز والكلمات السرية بتشفير AES-256-GCM." },
      { property: "og:title", content: "خزنة الأسرار — TVCC" },
      { property: "og:description", content: "إدارة آمنة لمفاتيح API والرموز والكلمات السرية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CATS = ["general", "api_key", "smtp", "database", "token", "oauth", "ssh", "vpn"];

function VaultPage() {
  const qc = useQueryClient();
  const fetchSecrets = useServerFn(listVaultSecrets);
  const createSecret = useServerFn(createVaultSecret);
  const rotate = useServerFn(rotateVaultSecret);
  const remove = useServerFn(deleteVaultSecret);
  const reveal = useServerFn(revealVaultSecret);

  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Record<string, { open: boolean; value: string }>>({});
  const [form, setForm] = useState({ name: "", category: "general", value: "", description: "" });

  const { data: secrets, isLoading } = useQuery({
    queryKey: ["vault"],
    queryFn: () => fetchSecrets({ data: {} }),
  });

  const add = async () => {
    if (!form.name || !form.value) return toast.error("الاسم والقيمة مطلوبان");
    try {
      await createSecret({ data: { name: form.name, category: form.category, value: form.value, description: form.description } });
      toast.success("تم حفظ السر بتشفير AES-256-GCM");
      setForm({ name: "", category: "general", value: "", description: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["vault"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا السر؟ لا يمكن التراجع.")) return;
    try {
      await remove({ data: { id } });
      toast.success("حُذف");
      qc.invalidateQueries({ queryKey: ["vault"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doRotate = async (id: string) => {
    const next = prompt("أدخل القيمة الجديدة للسر:");
    if (!next) return;
    try {
      await rotate({ data: { id, newValue: next } });
      toast.success("تم تدوير السر وحفظ نسخة سابقة");
      qc.invalidateQueries({ queryKey: ["vault"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" /> خزنة الأسرار
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تشفير AES-256-GCM للقيم، إخفاء تلقائي في الواجهة، وتدوير آمن مع حفظ النسخ السابقة.
          </p>
        </div>
        <Button onClick={() => setOpen(!open)}>
          <Plus className="w-4 h-4 ml-1" /> إضافة سر جديد
        </Button>
      </div>

      {open && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>اسم السر *</Label>
                <Input dir="ltr" className="mt-1" placeholder="OPENAI_API_KEY"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>القيمة *</Label>
              <Textarea dir="ltr" rows={2} className="mt-1 font-mono text-xs"
                value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div>
              <Label>وصف</Label>
              <Input className="mt-1"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button onClick={add}>حفظ بشكل آمن</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : !secrets?.length ? (
            <div className="p-12 text-center text-muted-foreground">لا أسرار محفوظة بعد</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-right">القيمة</TableHead>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-right">آخر تحديث</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {secrets.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs" dir="ltr">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      <div className="flex items-center gap-2">
                        {shown[s.id] ? <span className="truncate max-w-[220px]">{s.plaintext ?? "•••"}</span> : <span>••••••••••</span>}
                        <button onClick={() => setShown({ ...shown, [s.id]: !shown[s.id] })}>
                          {shown[s.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.description || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(s.updated_at).toLocaleString("ar")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="تدوير" onClick={() => doRotate(s.id)}>
                          <RefreshCw className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => del(s.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
