import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { KeyRound, Plus, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vault")({
  component: VaultPage,
  head: () => ({ meta: [{ title: "مدير الأسرار — TVCC" }] }),
});

const CATS = ["general", "api_key", "smtp", "database", "token", "oauth"];

function VaultPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ name: "", category: "general", value: "", description: "" });

  const { data: secrets, isLoading } = useQuery({
    queryKey: ["vault"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vault_secrets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const add = async () => {
    if (!form.name || !form.value) return toast.error("الاسم والقيمة مطلوبان");
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    // simple obfuscation (base64) — server-side encryption recommended for production
    const encoded = typeof window !== "undefined" ? btoa(unescape(encodeURIComponent(form.value))) : form.value;
    const { error } = await (supabase as any).from("vault_secrets").insert({
      owner_id: uid,
      name: form.name,
      category: form.category,
      value_encrypted: encoded,
      description: form.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ السر");
    setForm({ name: "", category: "general", value: "", description: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["vault"] });
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا السر؟")) return;
    const { error } = await (supabase as any).from("vault_secrets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("حُذف");
    qc.invalidateQueries({ queryKey: ["vault"] });
  };

  const decode = (s: string) => {
    try { return decodeURIComponent(escape(atob(s))); } catch { return s; }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <KeyRound className="w-7 h-7 text-primary" /> مدير الأسرار
          </h1>
          <p className="text-muted-foreground mt-1">
            خزنة مركزية لمفاتيح API والكلمات السرية ورموز الوصول
          </p>
        </div>
        <Button onClick={() => setOpen(!open)} className="bg-primary">
          <Plus className="w-4 h-4 ml-1" /> إضافة سر جديد
        </Button>
      </div>

      {open && (
        <Card className="ring-1 ring-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>اسم السر *</Label>
                <Input dir="ltr" className="mt-1 bg-secondary/40" placeholder="OPENAI_API_KEY"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>القيمة *</Label>
              <Textarea dir="ltr" rows={2} className="mt-1 bg-secondary/40 font-mono text-xs"
                value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div>
              <Label>وصف</Label>
              <Input className="mt-1 bg-secondary/40"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button onClick={add} className="bg-primary">حفظ</Button>
          </CardContent>
        </Card>
      )}

      <Card className="ring-1 ring-border bg-card/60">
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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {secrets.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs" dir="ltr">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      <div className="flex items-center gap-2">
                        {shown[s.id] ? <span className="truncate max-w-[200px]">{decode(s.value_encrypted)}</span> : <span>••••••••••</span>}
                        <button onClick={() => setShown({ ...shown, [s.id]: !shown[s.id] })}>
                          {shown[s.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.description || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => del(s.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
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
