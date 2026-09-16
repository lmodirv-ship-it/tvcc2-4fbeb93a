import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createSharedKey,
  listMonitoringKeys,
  rotateSiteKey,
  setKeyEnforcement,
  syncMonitoringKeys,
} from "@/lib/monitoring-keys.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KeyRound, RefreshCw, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";

function fmt(ts?: string | null) {
  return ts ? new Date(ts).toLocaleString("ar", { hour12: false }) : "—";
}

export function KeysPanel() {
  const list = useServerFn(listMonitoringKeys);
  const create = useServerFn(createSharedKey);
  const sync = useServerFn(syncMonitoringKeys);
  const enforce = useServerFn(setKeyEnforcement);
  const rotate = useServerFn(rotateSiteKey);

  const [shared, setShared] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["monitoring-keys"],
    queryFn: () => list({ data: {} } as any),
    refetchInterval: 30000,
  });

  const rows = ((data?.rows ?? []) as any[]).filter((r) =>
    q.trim() ? String(r.target).toLowerCase().includes(q.trim().toLowerCase()) : true,
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت العملية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4" /> المفتاح المشترك للمجموعة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res: any = await create({ data: {} } as any);
                  setShared(res.key);
                  toast.success("تم إنشاء المفتاح المشترك — انسخه الآن، لن يُعرض مرة أخرى");
                })
              }
            >
              <KeyRound className="size-3.5" /> إنشاء / تدوير المفتاح المشترك
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={busy || !shared}
              onClick={() =>
                run(async () => {
                  const res: any = await sync({ data: { sharedKey: shared } });
                  toast.success(`مزامنة المفاتيح: ${res.created} جديد · ${res.rotated} مُدوّر`);
                })
              }
            >
              <RefreshCw className="size-3.5" /> مزامنة المفاتيح لكل المواقع والسيرفرات
            </Button>
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="size-3.5" />
              أمان مزامنة المفاتيح
              <Switch
                checked={!!data?.totals?.enforced}
                onCheckedChange={(v) =>
                  run(async () => {
                    await enforce({ data: { enforced: v } });
                    toast.success(v ? "تم تفعيل الأمان" : "تم تعطيل الأمان");
                  })
                }
              />
            </div>
          </div>

          {shared && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-2">
              <code dir="ltr" className="flex-1 break-all text-[11px]">
                {shared}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => {
                  navigator.clipboard.writeText(shared);
                  toast.success("نُسخ المفتاح");
                }}
              >
                <Copy className="size-3.5" /> نسخ
              </Button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            المفتاح الكامل لا يُخزَّن في المنصة — تُحفظ بصمته فقط. المفتاح السابق يبقى صالحاً لساعة واحدة كفترة سماح حتى
            تُحدَّث البرامج على السيرفرات والمواقع.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm">
            مفاتيح الكيانات ({data?.totals?.keys ?? 0}) — مواقع {data?.totals?.sites ?? 0} · سيرفرات{" "}
            {data?.totals?.servers ?? 0}
          </CardTitle>
          <Input className="h-8 w-56 text-xs" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-xs">الكيان</TableHead>
                <TableHead className="text-xs">النوع</TableHead>
                <TableHead className="text-xs">البصمة</TableHead>
                <TableHead className="text-xs">الإصدار</TableHead>
                <TableHead className="text-xs">آخر تدوير</TableHead>
                <TableHead className="text-xs">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 200).map((r) => (
                <TableRow key={r.id} className="text-xs">
                  <TableCell>{r.target}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.key_type === "site" ? "موقع" : r.key_type === "server" ? "سيرفر" : "مشترك"}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr" className="text-[10px]">
                    {String(r.fingerprint).slice(0, 8)}…{String(r.fingerprint).slice(-6)}
                  </TableCell>
                  <TableCell>{r.version}</TableCell>
                  <TableCell>{fmt(r.rotated_at)}</TableCell>
                  <TableCell>
                    {r.website_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const res: any = await rotate({ data: { websiteId: r.website_id, sharedKey: shared } });
                            setShared("");
                            toast.success(`مفتاح جديد: ${res.key}`, { duration: 20000 });
                          })
                        }
                      >
                        تدوير
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground">
                    لا مفاتيح بعد — أنشئ المفتاح المشترك ثم اضغط «مزامنة المفاتيح».
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
