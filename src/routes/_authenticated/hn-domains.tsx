import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listHnDomains, checkHnDomain, reserveHnDomain, publishHnDomain, unpublishHnDomain } from "@/lib/hn-domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe, Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hn-domains")({
  component: HnDomainsPage,
  head: () => ({
    meta: [
      { title: "سجل نطاقات ‎.HN‎ — TVCC" },
      { name: "description", content: "احجز نطاق ‎.HN‎ الخاص بك وانشره على خوادم TVCC داخلياً وعلى الإنترنت العام." },
      { property: "og:title", content: "سجل نطاقات ‎.HN‎ — TVCC" },
      { property: "og:description", content: "حجز ونشر نطاقات ‎.HN‎ على شبكة TVCC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function HnDomainsPage() {
  const qc = useQueryClient();
  const load = useServerFn(listHnDomains);
  const check = useServerFn(checkHnDomain);
  const reserve = useServerFn(reserveHnDomain);
  const publish = useServerFn(publishHnDomain);
  const unpublish = useServerFn(unpublishHnDomain);

  const [name, setName] = useState("");
  const [avail, setAvail] = useState<null | { fqdn: string; publicFqdn: string; available: boolean }>(null);
  const [checking, setChecking] = useState(false);
  const [subId, setSubId] = useState<string>("");
  const [pubFor, setPubFor] = useState<any>(null);

  const { data, isLoading } = useQuery({ queryKey: ["hn-domains"], queryFn: () => load({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["hn-domains"] });

  const doCheck = async () => {
    setChecking(true); setAvail(null);
    try { const r = await check({ data: { name } }); setAvail(r); }
    catch (e: any) { toast.error(e?.message ?? "اسم غير صالح"); }
    finally { setChecking(false); }
  };

  const doReserve = async () => {
    try {
      await reserve({ data: { name, subscriptionId: subId || null } });
      toast.success("تم حجز النطاق");
      setName(""); setAvail(null); refresh();
    } catch (e: any) { toast.error(e?.message ?? "فشل الحجز"); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Globe className="w-7 h-7 text-primary" /> سجل نطاقات ‎.HN‎</h1>
        <p className="text-muted-foreground mt-1">احجز اسمك، ثم انشره على خادم DNS وخادم الويب — داخلياً وعلى الإنترنت العام.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>حجز نطاق جديد</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1 flex-1 min-w-[240px]">
              <Label>الاسم</Label>
              <div className="flex items-center gap-2" dir="ltr">
                <Input value={name} onChange={(e) => { setName(e.target.value); setAvail(null); }} placeholder="example" />
                <span className="text-muted-foreground font-mono">.hn</span>
              </div>
            </div>
            <div className="space-y-1 min-w-[200px]">
              <Label>الاشتراك (اختياري)</Label>
              <Select value={subId} onValueChange={setSubId}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  {(data!.subscriptions ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.plan?.name_ar || s.plan?.code} — {s.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={doCheck} disabled={!name || checking}>
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} تحقق
            </Button>
            <Button onClick={doReserve} disabled={!avail?.available}>احجز</Button>
          </div>
          {avail && (
            <div className={`flex items-center gap-2 text-sm ${avail.available ? "text-primary" : "text-destructive"}`}>
              {avail.available ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span dir="ltr" className="font-mono">{avail.fqdn}</span>
              <span>{avail.available ? "متاح" : "محجوز مسبقاً"}</span>
              {avail.available && <span className="text-muted-foreground">— عام: <span dir="ltr" className="font-mono">{avail.publicFqdn}</span></span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>نطاقاتي</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النطاق</TableHead>
                <TableHead>العنوان العام</TableHead>
                <TableHead>الوجهة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data!.domains.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد نطاقات</TableCell></TableRow>
              ) : data!.domains.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono" dir="ltr">{d.fqdn}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{d.is_public ? d.public_fqdn : "—"}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{d.target_ip ? `${d.target_ip}:${d.target_port}` : "—"}</TableCell>
                  <TableCell><Badge variant={d.status === "published" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                  <TableCell className="space-x-1 space-x-reverse whitespace-nowrap">
                    <Button size="sm" onClick={() => setPubFor(d)}>نشر</Button>
                    {d.status !== "reserved" && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try { await unpublish({ data: { id: d.id } }); toast.success("تم إيقاف النشر"); refresh(); }
                        catch (e: any) { toast.error(e?.message ?? "فشل"); }
                      }}>إيقاف</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!pubFor} onOpenChange={(o) => !o && setPubFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>نشر {pubFor?.fqdn}</DialogTitle></DialogHeader>
          {pubFor && (
            <PublishForm
              servers={data!.servers}
              onSubmit={async (v) => {
                try {
                  await publish({ data: { id: pubFor.id, ...v } });
                  toast.success("تم إرسال أوامر DNS و Nginx");
                  setPubFor(null); refresh();
                } catch (e: any) { toast.error(e?.message ?? "فشل النشر"); }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublishForm({ servers, onSubmit }: { servers: any[]; onSubmit: (v: any) => void }) {
  const [dnsServerId, setDns] = useState("");
  const [webServerId, setWeb] = useState("");
  const [port, setPort] = useState(80);
  const [targetIp, setIp] = useState("");
  const [publicRelease, setPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>خادم DNS (dnsmasq)</Label>
        <Select value={dnsServerId} onValueChange={setDns}>
          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
          <SelectContent>{servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>خادم الويب (Nginx)</Label>
        <Select value={webServerId} onValueChange={setWeb}>
          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
          <SelectContent>{servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>المنفذ</Label><Input type="number" value={port} onChange={(e) => setPort(+e.target.value)} /></div>
        <div className="space-y-1"><Label>IP الوجهة (اختياري)</Label><Input value={targetIp} onChange={(e) => setIp(e.target.value)} dir="ltr" placeholder="192.168.100.66" /></div>
      </div>
      <div className="flex items-center justify-between border rounded-md p-3">
        <div>
          <p className="text-sm font-medium">نشر على الإنترنت العام</p>
          <p className="text-xs text-muted-foreground">إضافة اسم عام عبر بوابة HTTPS إلى جانب الاسم الداخلي</p>
        </div>
        <Switch checked={publicRelease} onCheckedChange={setPublic} />
      </div>
      <DialogFooter>
        <Button disabled={!dnsServerId || !webServerId || busy} onClick={async () => { setBusy(true); await onSubmit({ dnsServerId, webServerId, port, targetIp: targetIp || null, publicRelease }); setBusy(false); }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} نشر الآن
        </Button>
      </DialogFooter>
    </div>
  );
}
