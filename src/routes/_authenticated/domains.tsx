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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Server, Plus, Trash2, Loader2, Shuffle, ArrowLeft, Eye, Activity } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listRedirects, saveRedirect, checkRedirect, deleteRedirect } from "@/lib/redirects.functions";

export const Route = createFileRoute("/_authenticated/domains")({
  component: DomainsPage,
  head: () => ({
    meta: [
      { title: "مدير النطاقات وإعادة التوجيه — TVCC" },
      { name: "description", content: "إدارة النطاقات وتواريخ انتهائها وإنشاء إعادة توجيه بين النطاقات والمنافذ من مكان واحد." },
      { property: "og:title", content: "مدير النطاقات وإعادة التوجيه — TVCC" },
      { property: "og:description", content: "إدارة النطاقات وإنشاء إعادة توجيه بين النطاقات والمنافذ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MODE_LABELS: Record<string, string> = {
  redirect_301: "تحويل دائم 301",
  proxy: "بروكسي إلى منفذ",
  tcp_bridge: "جسر TCP",
};

function kindOf(v: string): "domain" | "port" | null {
  const s = v.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!s) return null;
  if (/^\d{1,5}$/.test(s)) return Number(s) >= 1 && Number(s) <= 65535 ? "port" : null;
  return /^[a-z0-9.-]{3,253}$/i.test(s) && s.includes(".") && !s.includes("..") ? "domain" : null;
}

function RedirectPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listRedirects);
  const save = useServerFn(saveRedirect);
  const check = useServerFn(checkRedirect);
  const del = useServerFn(deleteRedirect);

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [serverId, setServerId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["redirects"], queryFn: () => list({ data: {} }) });

  const sk = kindOf(from);
  const tk = kindOf(to);
  const mode =
    sk && tk
      ? sk === "domain" && tk === "domain" ? "redirect_301"
      : sk === "domain" && tk === "port" ? "proxy"
      : sk === "port" && tk === "port" ? "tcp_bridge"
      : null
      : null;

  const run = async (dryRun: boolean) => {
    if (!serverId) return toast.error("اختر السيرفر");
    setBusy(true);
    try {
      const res: any = await save({ data: { serverId, source: from, target: to, dryRun } });
      setPreview(res.preview);
      if (dryRun) toast.success("معاينة جاهزة — راجع الإعداد قبل التنفيذ");
      else {
        toast.success("تم إنشاء إعادة التوجيه وجُدولت الأوامر على السيرفر");
        setFrom(""); setTo("");
        qc.invalidateQueries({ queryKey: ["redirects"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "فشل التنفيذ");
    } finally {
      setBusy(false);
    }
  };

  const rows = data?.redirects ?? [];
  const servers = data?.servers ?? [];

  return (
    <>
      <Button
        onClick={() => setOpen((o) => !o)}
        className="bg-success text-success-foreground hover:bg-success/90"
      >
        <Shuffle className="w-4 h-4 ml-1" /> إعادة التوجيه
      </Button>

      {open && (
        <Card className="ring-1 ring-success/30 bg-success/5 w-full">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label>من (نطاق أو منفذ)</Label>
                <Input dir="ltr" className="mt-1 bg-secondary/40" placeholder="old.example.com أو 8080"
                  value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label>إلى (نطاق أو منفذ)</Label>
                <Input dir="ltr" className="mt-1 bg-secondary/40" placeholder="new.example.com أو 3000"
                  value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <Label>السيرفر المنفِّذ</Label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger className="mt-1 bg-secondary/40"><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name || s.hostname || s.public_ip}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {from && to && (
                mode
                  ? <Badge className="bg-primary/20 text-primary border-primary/40">{MODE_LABELS[mode]}</Badge>
                  : <Badge variant="destructive">تركيبة غير مدعومة (منفذ ← نطاق)</Badge>
              )}
              <Button variant="outline" disabled={busy || !mode} onClick={() => run(true)}>
                <Eye className="w-4 h-4 ml-1" /> معاينة
              </Button>
              <Button className="bg-primary" disabled={busy || !mode} onClick={() => run(false)}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Shuffle className="w-4 h-4 ml-1" />} تنفيذ
              </Button>
            </div>

            {preview && (
              <pre dir="ltr" className="text-[11px] bg-secondary/40 border border-border/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {preview}
              </pre>
            )}

            {rows.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">من ← إلى</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">أُنشئ</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        <span className="inline-flex items-center gap-1">{r.source} <ArrowLeft className="w-3 h-3" /> {r.target}</span>
                      </TableCell>
                      <TableCell className="text-xs">{MODE_LABELS[r.mode] || r.mode}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-xs" dir="ltr">{new Date(r.created_at).toLocaleDateString("ar")}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" title="فحص"
                          onClick={async () => { await check({ data: { id: r.id } }); toast.success("جُدول الفحص"); qc.invalidateQueries({ queryKey: ["redirects"] }); }}>
                          <Activity className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="حذف"
                          onClick={async () => { if (!confirm("حذف إعادة التوجيه؟")) return; await del({ data: { id: r.id } }); toast.success("حُذف"); qc.invalidateQueries({ queryKey: ["redirects"] }); }}>
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
      )}
    </>
  );
}

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
        <div className="flex flex-wrap items-center gap-2">
          <RedirectPanel />
          <Button onClick={() => setOpen(!open)} className="bg-primary"><Plus className="w-4 h-4 ml-1" /> إضافة دومين</Button>
        </div>
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
                      <TableCell className="flex items-center gap-1">
                        <Button asChild variant="outline" size="sm">
                          <Link to="/domain-settings/$domain" params={{ domain: d.domain }}>إعدادات</Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => del(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
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
