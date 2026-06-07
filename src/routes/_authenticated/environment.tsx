import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileCog, Plus, Trash2, Loader2, Download, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/environment")({
  component: EnvPage,
  head: () => ({ meta: [{ title: "متغيرات البيئة — TVCC" }] }),
});

function EnvPage() {
  const qc = useQueryClient();
  const [siteId, setSiteId] = useState<string>("");
  const [env, setEnv] = useState("production");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [f, setF] = useState({ key: "", value: "", is_secret: true, description: "" });

  const { data: websites } = useQuery({
    queryKey: ["websites-env"],
    queryFn: async () => {
      const { data, error } = await supabase.from("websites").select("id, name, domain").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: vars, isLoading } = useQuery({
    queryKey: ["env-vars", siteId, env],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("website_env_vars")
        .select("*").eq("website_id", siteId).eq("environment", env).order("key");
      if (error) throw error;
      return data as any[];
    },
  });

  const site = useMemo(() => websites?.find((w) => w.id === siteId), [websites, siteId]);

  const add = async () => {
    if (!siteId) return toast.error("اختر موقعاً");
    if (!f.key || !f.value) return toast.error("المفتاح والقيمة مطلوبان");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("website_env_vars").insert({
      owner_id: u.user!.id, website_id: siteId, environment: env,
      key: f.key, value: f.value, is_secret: f.is_secret, description: f.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    setF({ key: "", value: "", is_secret: true, description: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["env-vars", siteId, env] });
  };

  const del = async (id: string) => {
    await (supabase as any).from("website_env_vars").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["env-vars", siteId, env] });
  };

  const exportEnv = () => {
    if (!vars?.length) return;
    const content = vars.map((v: any) => `${v.key}=${v.value}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `.env.${env}`;
    a.click();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileCog className="w-7 h-7 text-primary" /> متغيرات البيئة
          </h1>
          <p className="text-muted-foreground mt-1">إدارة ملفات .env لكل موقع وبيئة دون الدخول للسيرفر</p>
        </div>
        {!!vars?.length && <Button variant="outline" onClick={exportEnv}><Download className="w-4 h-4 ml-1" /> تصدير .env</Button>}
      </div>

      <Card className="ring-1 ring-border bg-card/60">
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>الموقع</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue placeholder="اختر موقعاً" /></SelectTrigger>
              <SelectContent>
                {websites?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>البيئة</Label>
            <Select value={env} onValueChange={setEnv}>
              <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button disabled={!siteId} className="bg-primary w-full" onClick={() => setOpen(!open)}>
              <Plus className="w-4 h-4 ml-1" /> إضافة متغير
            </Button>
          </div>
        </CardContent>
      </Card>

      {open && siteId && (
        <Card className="ring-1 ring-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>المفتاح *</Label><Input dir="ltr" className="mt-1 bg-secondary/40 font-mono" placeholder="DATABASE_URL" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></div>
              <div><Label>القيمة *</Label><Input dir="ltr" className="mt-1 bg-secondary/40 font-mono text-xs" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={f.is_secret} onCheckedChange={(c) => setF({ ...f, is_secret: c })} />
              <Label className="text-sm">سرّي (يُخفى في العرض)</Label>
            </div>
            <Button onClick={add} className="bg-primary">حفظ</Button>
          </CardContent>
        </Card>
      )}

      {siteId && (
        <Card className="ring-1 ring-border bg-card/60">
          <CardContent className="p-0">
            {isLoading ? <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            : !vars?.length ? <div className="p-12 text-center text-muted-foreground">لا متغيرات لهذه البيئة</div>
            : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">المفتاح</TableHead>
                  <TableHead className="text-right">القيمة</TableHead>
                  <TableHead className="text-right">نوع</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vars.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{v.key}</TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        <div className="flex items-center gap-2">
                          {v.is_secret && !shown[v.id] ? "••••••••" : <span className="truncate max-w-[300px]">{v.value}</span>}
                          {v.is_secret && <button onClick={() => setShown({ ...shown, [v.id]: !shown[v.id] })}>{shown[v.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>}
                        </div>
                      </TableCell>
                      <TableCell>{v.is_secret ? <Badge variant="destructive">سرّي</Badge> : <Badge variant="outline">عام</Badge>}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => del(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
