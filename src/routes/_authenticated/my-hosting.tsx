import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyHosting, subscribeToPlan, listPlans, replicateFile } from "@/lib/hosting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, HardDrive, Globe, Server, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-hosting")({
  component: MyHosting,
  head: () => ({
    meta: [
      { title: "استضافتي — TVCC" },
      { name: "description", content: "تابع باقتك، مساحتك التخزينية، خوادمك الممنوحة ونطاقات .HN الخاصة بك." },
      { property: "og:title", content: "استضافتي — TVCC" },
      { property: "og:description", content: "باقتك، مساحتك، خوادمك ونطاقات .HN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const GB = 1024 ** 3;
const STATUS_AR: Record<string, string> = { pending: "بانتظار التفعيل", active: "مفعّل", suspended: "موقوف", cancelled: "ملغى", provisioning: "قيد التجهيز", ready: "جاهز" };

function MyHosting() {
  const qc = useQueryClient();
  const load = useServerFn(getMyHosting);
  const plansFn = useServerFn(listPlans);
  const subscribe = useServerFn(subscribeToPlan);
  const replicate = useServerFn(replicateFile);
  const [open, setOpen] = useState(false);
  const [repFor, setRepFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["my-hosting"], queryFn: () => load({}) });
  const { data: plansData } = useQuery({ queryKey: ["public-plans"], queryFn: () => plansFn({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-hosting"] });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const quotaOf = (sid: string) => data!.quotas.find((q: any) => q.subscription_id === sid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">استضافتي</h1>
          <p className="text-muted-foreground mt-1">باقتك، مساحتك، خوادمك ونطاقات ‎.HN‎ الخاصة بك.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/pricing">عرض الباقات</Link></Button>
          <Button onClick={() => setOpen(true)}>اشتراك جديد</Button>
        </div>
      </div>

      {!data!.subscriptions.length && (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          لا يوجد اشتراك بعد — اختر باقة تبدأ من 2$ شهرياً.
        </CardContent></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data!.subscriptions.map((s: any) => {
          const q = quotaOf(s.id);
          const used = Number(q?.used_bytes ?? 0);
          const limit = Number(q?.limit_bytes ?? 1);
          const tenant = data!.tenants.find((t: any) => t.subscription_id === s.id);
          const grants = data!.grants.filter((g: any) => g.subscription_id === s.id);
          return (
            <Card key={s.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{s.plan?.name_ar || s.plan?.name}</CardTitle>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>{STATUS_AR[s.status] ?? s.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-1"><HardDrive className="w-4 h-4" /> التخزين</span>
                    <span>{(used / GB).toFixed(2)} / {(limit / GB).toFixed(0)} GB</span>
                  </div>
                  <Progress value={Math.min(100, (used / limit) * 100)} />
                </div>
                {tenant && (
                  <div className="text-sm space-y-1 bg-muted/40 rounded-md p-3">
                    <Row label="معرّف المستأجر" value={tenant.tenant_key} copy />
                    <Row label="العزل" value={tenant.isolation} />
                    <Row label="Schema" value={tenant.schema_name} copy />
                    <Row label="حاوية التخزين" value={tenant.bucket_name} copy />
                    <Row label="الحالة" value={STATUS_AR[tenant.status] ?? tenant.status} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-1 flex items-center gap-1"><Server className="w-4 h-4" /> الخوادم</p>
                  <div className="flex flex-wrap gap-1">
                    {grants.length ? grants.map((g: any) => (
                      <Badge key={g.id} variant="secondary">{g.server?.name} · {g.role} · {g.disk_quota_gb}GB</Badge>
                    )) : <span className="text-xs text-muted-foreground">لم تُمنح خوادم بعد</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRepFor(s.id)}>نسخ ملف على 3 خوادم</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> نطاقات ‎.HN‎</CardTitle></CardHeader>
        <CardContent>
          {data!.domains.length ? (
            <div className="space-y-2">
              {data!.domains.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="font-medium">{d.fqdn}</p>
                    {d.is_public && <p className="text-xs text-muted-foreground">{d.public_fqdn}</p>}
                  </div>
                  <Badge variant={d.status === "published" ? "default" : "secondary"}>{d.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد نطاقات — احجز نطاقك من <Link to="/hn-domains" className="text-primary underline">سجل ‎.HN‎</Link>.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>اشتراك جديد</DialogTitle></DialogHeader>
          <SubscribeForm
            plans={plansData?.plans ?? []}
            onSubmit={async (v) => {
              try { await subscribe({ data: v }); toast.success("تم إنشاء الاشتراك — بانتظار تفعيل الإدارة"); setOpen(false); refresh(); }
              catch (e: any) { toast.error(e?.message ?? "فشل"); }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!repFor} onOpenChange={(o) => !o && setRepFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>نسخ ملف مهم على 3 خوادم</DialogTitle></DialogHeader>
          <ReplicateForm
            onSubmit={async (path) => {
              try { await replicate({ data: { subscriptionId: repFor!, filePath: path } }); toast.success("تم بدء النسخ الثلاثي"); setRepFor(null); refresh(); }
              catch (e: any) { toast.error(e?.message ?? "فشل"); }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs flex items-center gap-1">
        {value}
        {copy && <button onClick={() => { navigator.clipboard.writeText(value); toast.success("تم النسخ"); }}><Copy className="w-3 h-3" /></button>}
      </span>
    </div>
  );
}

function SubscribeForm({ plans, onSubmit }: { plans: any[]; onSubmit: (v: any) => void }) {
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>الباقة</Label>
        <Select value={planCode} onValueChange={setPlanCode}>
          <SelectTrigger><SelectValue placeholder="اختر باقة" /></SelectTrigger>
          <SelectContent>
            {plans.map((p) => <SelectItem key={p.code} value={p.code}>{p.name_ar || p.name} — ${p.price_monthly}/شهر</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>الدورة</Label>
        <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">شهري</SelectItem>
            <SelectItem value="yearly">سنوي</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button disabled={!planCode || busy} onClick={async () => { setBusy(true); await onSubmit({ planCode, billingCycle }); setBusy(false); }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} اشترك
        </Button>
      </DialogFooter>
    </div>
  );
}

function ReplicateForm({ onSubmit }: { onSubmit: (path: string) => void }) {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>مسار الملف على الخادم</Label>
        <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/var/www/example.hn/data.db" dir="ltr" />
      </div>
      <DialogFooter>
        <Button disabled={!path || busy} onClick={async () => { setBusy(true); await onSubmit(path); setBusy(false); }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} ابدأ النسخ
        </Button>
      </DialogFooter>
    </div>
  );
}
