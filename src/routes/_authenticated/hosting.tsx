import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListHosting, setSubscriptionStatus, changeSubscriptionPlan,
  grantServer, revokeServer, setQuota,
} from "@/lib/hosting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Server, HardDrive, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hosting")({
  component: HostingAdmin,
  head: () => ({
    meta: [
      { title: "إدارة الاستضافة — TVCC" },
      { name: "description", content: "إدارة باقات الاستضافة، منح الخوادم والمساحات وحصص التخزين للمشتركين." },
      { property: "og:title", content: "إدارة الاستضافة — TVCC" },
      { property: "og:description", content: "منح الخوادم والمساحات وحصص التخزين للمشتركين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const GB = 1024 ** 3;
const STATUS_AR: Record<string, string> = { pending: "بانتظار التفعيل", active: "مفعّل", suspended: "موقوف", cancelled: "ملغى" };

function HostingAdmin() {
  const qc = useQueryClient();
  const load = useServerFn(adminListHosting);
  const doStatus = useServerFn(setSubscriptionStatus);
  const doPlan = useServerFn(changeSubscriptionPlan);
  const doGrant = useServerFn(grantServer);
  const doRevoke = useServerFn(revokeServer);
  const doQuota = useServerFn(setQuota);

  const [grantFor, setGrantFor] = useState<any>(null);
  const [quotaFor, setQuotaFor] = useState<any>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["hosting-admin"], queryFn: () => load({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["hosting-admin"] });

  const run = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "فشل التنفيذ"); }
  };

  if (error) return <p className="text-destructive">{(error as Error).message}</p>;
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const emailOf = (id: string) => data!.profiles.find((p: any) => p.id === id)?.email ?? "—";
  const quotaOf = (sid: string) => data!.quotas.find((q: any) => q.subscription_id === sid);
  const grantsOf = (sid: string) => data!.grants.filter((g: any) => g.subscription_id === sid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إدارة الاستضافة</h1>
        <p className="text-muted-foreground mt-1">منح الخوادم، ضبط المساحات، وتفعيل اشتراكات العملاء.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="الاشتراكات" value={data!.subscriptions.length} icon={ShieldCheck} />
        <Stat label="مفعّلة" value={data!.subscriptions.filter((s: any) => s.status === "active").length} icon={ShieldCheck} />
        <Stat label="الخوادم" value={data!.servers.length} icon={Server} />
        <Stat label="نطاقات .HN" value={data!.domains.length} icon={HardDrive} />
      </div>

      <Card>
        <CardHeader><CardTitle>المشتركون</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>الباقة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المساحة</TableHead>
                <TableHead>الخوادم الممنوحة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data!.subscriptions.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد اشتراكات</TableCell></TableRow>
              ) : data!.subscriptions.map((s: any) => {
                const q = quotaOf(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{emailOf(s.owner_id)}</TableCell>
                    <TableCell>
                      <Select value={s.plan_id} onValueChange={(v) => run(() => doPlan({ data: { id: s.id, planId: v } }), "تم تغيير الباقة")}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {data!.plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name_ar || p.name} — ${p.price_monthly}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={(v) => run(() => doStatus({ data: { id: s.id, status: v as any } }), "تم تحديث الحالة")}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["pending", "active", "suspended", "cancelled"].map((x) => <SelectItem key={x} value={x}>{STATUS_AR[x]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {q ? `${(Number(q.used_bytes || 0) / GB).toFixed(2)} / ${(Number(q.limit_bytes) / GB).toFixed(0)} GB` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {grantsOf(s.id).map((g: any) => (
                          <Badge key={g.id} variant="secondary" className="gap-1">
                            {g.server?.name ?? "خادم"} · {g.role}
                            <button onClick={() => run(() => doRevoke({ data: { id: g.id } }), "تم السحب")}><Trash2 className="w-3 h-3" /></button>
                          </Badge>
                        ))}
                        {!grantsOf(s.id).length && <span className="text-muted-foreground text-xs">لا يوجد</span>}
                      </div>
                    </TableCell>
                    <TableCell className="space-x-1 space-x-reverse whitespace-nowrap">
                      <Button size="sm" onClick={() => setGrantFor(s)}>منح خادم</Button>
                      <Button size="sm" variant="outline" onClick={() => setQuotaFor({ sub: s, quota: q })}>المساحة</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!grantFor} onOpenChange={(o) => !o && setGrantFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>منح خادم للمشترك</DialogTitle></DialogHeader>
          {grantFor && (
            <GrantForm
              servers={data!.servers}
              defaultDisk={grantFor.plan?.storage_gb ?? 5}
              onSubmit={async (v) => {
                await run(() => doGrant({ data: { subscriptionId: grantFor.id, ...v } }), "تم المنح وإرسال أمر التجهيز");
                setGrantFor(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!quotaFor} onOpenChange={(o) => !o && setQuotaFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ضبط المساحة</DialogTitle></DialogHeader>
          {quotaFor && (
            <QuotaForm
              defaults={{
                storageGb: Math.round(Number(quotaFor.quota?.limit_bytes ?? 0) / GB) || (quotaFor.sub.plan?.storage_gb ?? 5),
                transferGb: Math.round(Number(quotaFor.quota?.transfer_limit_bytes ?? 0) / GB) || (quotaFor.sub.plan?.transfer_gb ?? 20),
              }}
              onSubmit={async (v) => {
                await run(() => doQuota({ data: { subscriptionId: quotaFor.sub.id, ...v } }), "تم تحديث المساحة على الخوادم");
                setQuotaFor(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GrantForm({ servers, defaultDisk, onSubmit }: { servers: any[]; defaultDisk: number; onSubmit: (v: any) => void }) {
  const [serverId, setServerId] = useState("");
  const [role, setRole] = useState("web");
  const [cpu, setCpu] = useState(1);
  const [ramMb, setRamMb] = useState(1024);
  const [diskGb, setDiskGb] = useState(defaultDisk);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>الخادم</Label>
        <Select value={serverId} onValueChange={setServerId}>
          <SelectTrigger><SelectValue placeholder="اختر خادماً" /></SelectTrigger>
          <SelectContent>
            {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.role} ({s.host})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>الدور</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["web", "db_primary", "db_replica", "storage", "backup", "monitor", "control"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label>CPU</Label><Input type="number" value={cpu} onChange={(e) => setCpu(+e.target.value)} /></div>
        <div className="space-y-1"><Label>RAM (م.ب)</Label><Input type="number" value={ramMb} onChange={(e) => setRamMb(+e.target.value)} /></div>
        <div className="space-y-1"><Label>القرص (GB)</Label><Input type="number" value={diskGb} onChange={(e) => setDiskGb(+e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button disabled={!serverId || busy} onClick={async () => { setBusy(true); await onSubmit({ serverId, role, cpu, ramMb, diskGb }); setBusy(false); }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} منح وتجهيز
        </Button>
      </DialogFooter>
    </div>
  );
}

function QuotaForm({ defaults, onSubmit }: { defaults: { storageGb: number; transferGb: number }; onSubmit: (v: any) => void }) {
  const [storageGb, setStorageGb] = useState(defaults.storageGb);
  const [transferGb, setTransferGb] = useState(defaults.transferGb);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>مساحة التخزين (GB)</Label><Input type="number" value={storageGb} onChange={(e) => setStorageGb(+e.target.value)} /></div>
      <div className="space-y-1"><Label>نقل البيانات (GB)</Label><Input type="number" value={transferGb} onChange={(e) => setTransferGb(+e.target.value)} /></div>
      <DialogFooter>
        <Button disabled={busy} onClick={async () => { setBusy(true); await onSubmit({ storageGb, transferGb }); setBusy(false); }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ وتطبيق
        </Button>
      </DialogFooter>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card><CardContent className="p-4 flex items-center justify-between">
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
      <Icon className="w-6 h-6 text-primary" />
    </CardContent></Card>
  );
}
