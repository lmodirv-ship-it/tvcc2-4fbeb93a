import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Fingerprint, Copy, Loader2, Ban, Radio, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  listGroupIdentities, listIdentitySignals, revokeIdentity, getIdentityHubConfig,
} from "@/lib/group-identity.functions";

export const Route = createFileRoute("/_authenticated/group-ids")({
  component: GroupIdsPage,
  head: () => ({
    meta: [
      { title: "هويات المجموعة — TVCC" },
      { name: "description", content: "سجل هويات مجموعة HN وإشاراتها الواردة إلى مركز TVCC." },
      { property: "og:title", content: "هويات المجموعة — TVCC" },
      { property: "og:description", content: "سجل هويات مجموعة HN وإشاراتها الواردة إلى مركز TVCC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  discovered: "مُكتشفة",
  connected: "متصل",
  revoked: "ملغاة",
};

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`نُسخ ${label}`);
}

function GroupIdsPage() {
  const qc = useQueryClient();
  const fetchIdentities = useServerFn(listGroupIdentities);
  const fetchSignals = useServerFn(listIdentitySignals);
  const fetchConfig = useServerFn(getIdentityHubConfig);
  const revoke = useServerFn(revokeIdentity);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<{ id: string; code: string } | null>(null);

  const { data: config } = useQuery({ queryKey: ["hn-hub-config"], queryFn: () => fetchConfig({}) });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["group-identities"],
    queryFn: () => fetchIdentities({}),
    refetchInterval: 30_000,
  });

  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ["identity-signals", detail?.id],
    enabled: !!detail,
    queryFn: () => fetchSignals({ data: { identityId: detail!.id } }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((r: any) => {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      return [r.code, r.service_name, r.site_url, r.origin]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(term));
    });
  }, [rows, q, status]);

  const doRevoke = async (id: string) => {
    if (!confirm("إلغاء هذه الهوية؟ ستُرفض إشاراتها القادمة.")) return;
    try {
      await revoke({ data: { id } });
      toast.success("أُلغيت الهوية");
      qc.invalidateQueries({ queryKey: ["group-identities"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fingerprint className="w-6 h-6 text-primary" /> هويات المجموعة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          TVCC هو مركز مجموعة HN ومالك اللائحة: كل إشارة "اتصال" من أي موقع تصل هنا وتُسجَّل.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            {config?.secretConfigured ? (
              <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> التوقيع مفعّل</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3.5 h-3.5" /> مفتاح التوقيع غير مضبوط</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              أضف السر <code className="font-mono">HN_HUB_VERIFICATION_SALT</code> لتفعيل التحقق من التوقيع.
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              { label: "نقطة استقبال الإشارات", value: config?.announceUrl },
              { label: "نقطة التحقق العامة", value: config?.lookupUrl },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="font-mono text-xs truncate flex-1">{item.value ?? "—"}</code>
                  <Button variant="ghost" size="icon" onClick={() => item.value && copy(item.value, item.label)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="بحث بالرمز أو الخدمة أو الرابط…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="connected">متصل</SelectItem>
            <SelectItem value="discovered">مُكتشفة</SelectItem>
            <SelectItem value="revoked">ملغاة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : !filtered.length ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد هويات بعد — ستظهر تلقائياً عند أول إشارة اتصال.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرمز</TableHead>
                  <TableHead className="text-right">الخدمة</TableHead>
                  <TableHead className="text-right">الرقم</TableHead>
                  <TableHead className="text-right">الموقع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر إشارة</TableHead>
                  <TableHead className="text-right">العدد</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs" dir="ltr">{r.code}</TableCell>
                    <TableCell className="text-sm">{r.service_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.service_number ?? "—"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[220px]" dir="ltr">{r.site_url || r.origin || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "connected" ? "default" : r.status === "revoked" ? "destructive" : "outline"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.last_signal_at ? new Date(r.last_signal_at).toLocaleString("ar") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.signal_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="نسخ الرمز" onClick={() => copy(r.code, "الرمز")}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="سجل الإشارات" onClick={() => setDetail({ id: r.id, code: r.code })}>
                          <Radio className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" title="إلغاء" onClick={() => doRevoke(r.id)}>
                          <Ban className="w-4 h-4 text-destructive" />
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

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>سجل إشارات {detail?.code}</DialogTitle>
          </DialogHeader>
          {signalsLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
          ) : !signals?.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">لا إشارات مسجّلة</div>
          ) : (
            <div className="max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">التوقيع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleString("ar")}</TableCell>
                      <TableCell className="text-xs truncate max-w-[260px]" dir="ltr">{s.origin || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.signature_valid ? "default" : "outline"}>
                          {s.signature_valid ? "موقّعة" : "غير موقّعة"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
