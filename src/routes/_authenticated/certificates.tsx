import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldCheck, ShieldAlert, ShieldX, Loader2, RefreshCw, Download, Search, BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  verifyIssueRegister, revokeCertificate, reissueCertificate, getCertificateDocument,
} from "@/lib/hn-rls.functions";

export const Route = createFileRoute("/_authenticated/certificates")({
  component: CertificatesPage,
  head: () => ({
    meta: [
      { title: "شهادات HN.RLS — TVCC" },
      { name: "description", content: "إصدار وإدارة شهادات HN.RLS وتسجيل المشاريع بعد التحقق من ملكية النطاق." },
      { property: "og:title", content: "شهادات HN.RLS — TVCC" },
      { property: "og:description", content: "إصدار وإدارة شهادات HN.RLS وتسجيل المشاريع بعد التحقق من ملكية النطاق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  name: string;
  domain: string;
  verified: boolean;
  hn_project_id: string | null;
  registration_status: string;
  registered_at: string | null;
  cert: {
    id: string;
    serial: string;
    status: string;
    issued_at: string;
    expires_at: string;
    fingerprint: string;
    verification_method: string;
  } | null;
};

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

function certBadge(row: Row) {
  const c = row.cert;
  if (!c || c.status === "revoked") {
    return <Badge variant="outline" className="border-destructive/40 text-destructive">بدون شهادة</Badge>;
  }
  const expired = new Date(c.expires_at).getTime() <= Date.now();
  if (c.status !== "active" || expired) {
    return <Badge variant="outline" className="border-warning/40 text-warning">منتهية</Badge>;
  }
  return <Badge variant="outline" className="border-success/40 text-success">سارية</Badge>;
}

function regBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    registered: { label: "مُسجَّل", cls: "border-success/40 text-success" },
    pending_sync: { label: "بانتظار المزامنة", cls: "border-warning/40 text-warning" },
    unregistered: { label: "غير مُسجَّل", cls: "border-muted-foreground/40 text-muted-foreground" },
  };
  const m = map[status] ?? map["unregistered"]!;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function CertificatesPage() {
  const qc = useQueryClient();
  const runFlow = useServerFn(verifyIssueRegister);
  const revoke = useServerFn(revokeCertificate);
  const reissue = useServerFn(reissueCertificate);
  const getDoc = useServerFn(getCertificateDocument);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["hn-certificates"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: sites, error: e1 }, { data: certs, error: e2 }] = await Promise.all([
        supabase
          .from("websites")
          .select("id, name, domain, verified, hn_project_id, registration_status, registered_at")
          .order("name"),
        supabase
          .from("hn_certificates")
          .select("id, website_id, serial, status, issued_at, expires_at, fingerprint, verification_method")
          .order("issued_at", { ascending: false }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const byWebsite = new Map<string, Row["cert"]>();
      for (const c of certs ?? []) {
        if (!byWebsite.has(c.website_id)) {
          byWebsite.set(c.website_id, {
            id: c.id, serial: c.serial, status: c.status, issued_at: c.issued_at,
            expires_at: c.expires_at, fingerprint: c.fingerprint,
            verification_method: c.verification_method,
          });
        }
      }
      return (sites ?? []).map((s) => ({
        ...s,
        registration_status: s.registration_status ?? "unregistered",
        cert: byWebsite.get(s.id) ?? null,
      })) as Row[];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data ?? [];
    return q
      ? all.filter((r) =>
          [r.name, r.domain, r.cert?.serial ?? "", r.hn_project_id ?? ""]
            .join(" ").toLowerCase().includes(q))
      : all;
  }, [data, search]);

  const stats = useMemo(() => {
    const all = data ?? [];
    const active = all.filter(
      (r) => r.cert?.status === "active" && new Date(r.cert.expires_at).getTime() > Date.now(),
    ).length;
    const registered = all.filter((r) => r.registration_status === "registered").length;
    const verified = all.filter((r) => r.verified).length;
    return { total: all.length, active, registered, verified };
  }, [data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hn-certificates"] });
    qc.invalidateQueries({ queryKey: ["websites"] });
  };

  const runIssue = async (row: Row, force = false) => {
    setBusy(row.id);
    const id = `cert-${row.id}`;
    toast.loading("جاري التحقق من ملكية النطاق...", { id });
    try {
      if (force && row.cert?.status === "active") await reissue({ data: { websiteId: row.id } });
      const res = await runFlow({ data: { websiteId: row.id } });
      if (!res.verified) {
        toast.error(`لم يتم التحقق من ${row.domain} — أضف سجل _tvcc ثم أعد المحاولة`, { id });
      } else {
        toast.success(
          `${res.issuedNow ? "أُصدرت" : "سارية"} شهادة ${res.certificate?.serial} • ` +
            (res.registration?.status === "registered" ? "تم تسجيل المشروع" : "التسجيل بانتظار المزامنة"),
          { id, duration: 6000 },
        );
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإجراء", { id });
    } finally {
      setBusy(null);
    }
  };

  const doRevoke = async (row: Row) => {
    if (!row.cert) return;
    setBusy(row.id);
    try {
      await revoke({ data: { certificateId: row.cert.id } });
      toast.success("تم سحب الشهادة وإلغاء تسجيل المشروع");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل السحب");
    } finally {
      setBusy(null);
    }
  };

  const download = async (row: Row) => {
    if (!row.cert) return;
    try {
      const doc = await getDoc({ data: { certificateId: row.cert.id } });
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.cert.serial}.hnrls.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التنزيل");
    }
  };

  const cards = [
    { label: "إجمالي المشاريع", value: stats.total, icon: BadgeCheck, cls: "text-primary bg-primary/15" },
    { label: "نطاقات مُتحقَّق منها", value: stats.verified, icon: ShieldCheck, cls: "text-success bg-success/15" },
    { label: "شهادات سارية", value: stats.active, icon: ShieldCheck, cls: "text-success bg-success/15" },
    { label: "مشاريع مُسجَّلة", value: stats.registered, icon: ShieldAlert, cls: "text-warning bg-warning/15" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">شهادات HN.RLS</h1>
          <p className="text-sm text-muted-foreground">
            بعد التحقق من ملكية النطاق تُصدر شهادة HN.RLS ويُسجَّل المشروع في سجل الشبكة تلقائياً.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="w-4 h-4 ml-1" /> تحديث
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-10 h-10 rounded-xl grid place-items-center ${c.cls}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="ابحث بالنطاق أو الرقم التسلسلي..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">الشهادة</TableHead>
                  <TableHead className="text-right">الرقم التسلسلي</TableHead>
                  <TableHead className="text-right">الصلاحية</TableHead>
                  <TableHead className="text-right">التسجيل</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد نتائج</TableCell></TableRow>
                ) : (
                  rows.slice(0, 100).map((row) => (
                    <TableRow key={row.id} className="border-border/40">
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {row.verified
                            ? <ShieldCheck className="w-3.5 h-3.5 text-success" />
                            : <ShieldX className="w-3.5 h-3.5 text-muted-foreground" />}
                          {row.domain}
                        </div>
                      </TableCell>
                      <TableCell>{certBadge(row)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.cert?.serial ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.cert ? `${fmt(row.cert.issued_at)} ← ${fmt(row.cert.expires_at)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {regBadge(row.registration_status)}
                          {row.hn_project_id && (
                            <span className="font-mono text-[10px] text-muted-foreground">{row.hn_project_id}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs border-primary/40 text-primary hover:bg-primary/10"
                            disabled={busy === row.id}
                            onClick={() => runIssue(row, false)}
                          >
                            {busy === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : row.cert?.status === "active" ? "تحديث" : "تحقق وإصدار"}
                          </Button>
                          {row.cert?.status === "active" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy === row.id} onClick={() => runIssue(row, true)}>
                                إعادة إصدار
                              </Button>
                              <Button size="icon" variant="ghost" className="w-7 h-7" title="تنزيل الشهادة" onClick={() => download(row)}>
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" disabled={busy === row.id} onClick={() => doRevoke(row)}>
                                سحب
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            التحقق العام من أي شهادة:{" "}
            <code className="font-mono">/api/public/hn-rls/verify?serial=HN-RLS-...</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
