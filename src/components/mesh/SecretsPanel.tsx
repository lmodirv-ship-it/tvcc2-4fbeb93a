import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, RefreshCw, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listVaultSecrets, createVaultSecret, rotateVaultSecret, deleteVaultSecret,
} from "@/lib/server-ops.functions";

const CATEGORIES = ["database_url", "api_key", "token", "ssh_key", "generic"];

export function SecretsPanel({ websites, servers }: { websites: any[]; servers: any[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listVaultSecrets);
  const createFn = useServerFn(createVaultSecret);
  const rotateFn = useServerFn(rotateVaultSecret);
  const deleteFn = useServerFn(deleteVaultSecret);

  const { data: secrets = [] } = useQuery({
    queryKey: ["connect-secrets"],
    queryFn: () => listFn({ data: {} }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["connect-secrets"] });

  const [form, setForm] = useState({ name: "", value: "", category: "database_url", websiteId: "", serverId: "", description: "" });
  const [rotating, setRotating] = useState<{ id: string; name: string } | null>(null);
  const [newValue, setNewValue] = useState("");

  const mCreate = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name: form.name, value: form.value, category: form.category,
          description: form.description || undefined,
          websiteId: form.websiteId || null, serverId: form.serverId || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ السر مشفّراً");
      setForm({ ...form, name: "", value: "", description: "" });
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const mRotate = useMutation({
    mutationFn: () => rotateFn({ data: { id: rotating!.id, newValue } }),
    onSuccess: () => { toast.success("تم التدوير وحفظ نسخة سابقة"); setRotating(null); setNewValue(""); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التدوير"),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const label = (s: any) =>
    websites.find((w: any) => w.id === s.website_id)?.domain ??
    servers.find((v: any) => v.id === s.server_id)?.name ?? "عام";

  return (
    <div className="space-y-4">
      <Card className="ring-1 ring-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            كل القيم مشفّرة (AES-256-GCM) وتُعرض مقنّعة فقط. التدوير يحتفظ بنسخة سابقة في السجل، ولا تُكشف القيمة في هذه الصفحة لأي مستخدم.
          </p>
        </CardContent>
      </Card>

      <Card className="ring-1 ring-border bg-card/60">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> إضافة سر</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">الاسم</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="DATABASE_URL" />
          </div>
          <div>
            <Label className="text-xs">القيمة</Label>
            <Input type="password" className="mt-1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="••••••••" />
          </div>
          <div>
            <Label className="text-xs">التصنيف</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">الموقع (اختياري)</Label>
            <Select value={form.websiteId} onValueChange={(v) => setForm({ ...form, websiteId: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {websites.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!form.name || !form.value || mCreate.isPending} onClick={() => mCreate.mutate()}>حفظ مشفّراً</Button>
        </CardContent>
      </Card>

      <Card className="ring-1 ring-border bg-card/60">
        <CardHeader><CardTitle className="text-base">الأسرار المحفوظة ({secrets.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {secrets.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أسرار بعد.</p>}
          {secrets.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{s.kind}</Badge>
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.masked_value ?? "••••••"}</span>
                <span className="text-xs text-muted-foreground">{label(s)}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setRotating({ id: s.id, name: s.name }); setNewValue(""); }}>
                  <RefreshCw className="w-4 h-4 ml-1" /> تدوير
                </Button>
                <Button variant="ghost" size="icon" onClick={() => mDelete.mutate(s.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!rotating} onOpenChange={(o) => !o && setRotating(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تدوير السر: {rotating?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">القيمة الجديدة</Label>
            <Input type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="••••••••" />
            <p className="text-xs text-muted-foreground">تُحفظ النسخة القديمة في سجل الإصدارات ويمكن الرجوع إليها عند الحاجة.</p>
          </div>
          <DialogFooter>
            <Button disabled={!newValue || mRotate.isPending} onClick={() => mRotate.mutate()}>تدوير الآن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
