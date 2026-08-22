import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Layers, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { bulkApplyConnection } from "@/lib/connect.functions";

type Row = { id: string; domain: string; name?: string | null };

export function BulkLinkPanel({
  websites, services, servers, databases,
}: {
  websites: Row[];
  services: any[];
  servers: any[];
  databases: any[];
}) {
  const qc = useQueryClient();
  const applyFn = useServerFn(bulkApplyConnection);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [useDb, setUseDb] = useState(false);
  const [db, setDb] = useState({
    databaseId: "", serverId: "", connectionKind: "cloud", dbEngine: "postgres",
    dbName: "", dbUser: "", host: "", port: "5432", envKey: "DATABASE_URL",
  });
  const [envText, setEnvText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const filtered = useMemo(
    () => websites.filter((w) => (w.domain ?? "").toLowerCase().includes(search.toLowerCase())),
    [websites, search],
  );

  const envVars = envText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return { key: l.slice(0, i).trim(), value: l.slice(i + 1).trim(), isSecret: true };
    })
    .filter((v) => v.key);

  const apply = useMutation({
    mutationFn: () =>
      applyFn({
        data: {
          websiteIds: selected,
          serviceId: serviceId || undefined,
          database: useDb
            ? {
                databaseId: db.databaseId || undefined,
                serverId: db.serverId || undefined,
                connectionKind: db.connectionKind,
                dbEngine: db.dbEngine,
                dbName: db.dbName || undefined,
                dbUser: db.dbUser || undefined,
                host: db.host || undefined,
                port: db.port ? Number(db.port) : undefined,
                envKey: db.envKey || undefined,
              }
            : undefined,
          envVars,
        },
      }),
    onSuccess: (res: any) => {
      setResults(res.results);
      const failed = res.results.filter((r: any) => !r.ok).length;
      failed ? toast.error(`فشل ${failed} من ${res.results.length}`) : toast.success("تم تطبيق الربط على كل المواقع");
      qc.invalidateQueries({ queryKey: ["connect-hub"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التطبيق"),
  });

  const nothingToDo = !serviceId && !useDb && envVars.length === 0;
  const domainOf = (id: string) => websites.find((w) => w.id === id)?.domain ?? id;

  return (
    <div className="space-y-4">
      <Card className="ring-1 ring-border bg-card/60">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" /> اختيار المواقع ({selected.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(filtered.map((w) => w.id))}>تحديد الظاهر</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>مسح</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="ابحث عن نطاق…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ScrollArea className="h-56 rounded-md border border-border/50 p-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
              {filtered.map((w) => (
                <label key={w.id} className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={selected.includes(w.id)}
                    onCheckedChange={(c) =>
                      setSelected((prev) => (c ? [...prev, w.id] : prev.filter((x) => x !== w.id)))
                    }
                  />
                  <span className="truncate">{w.domain}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="ring-1 ring-border bg-card/60">
        <CardHeader><CardTitle className="text-base">إعدادات الربط المُطبَّقة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">الخدمة (اختياري)</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="بدون خدمة" /></SelectTrigger>
                <SelectContent>
                  {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.service_type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox checked={useDb} onCheckedChange={(c) => setUseDb(Boolean(c))} id="usedb" />
              <Label htmlFor="usedb" className="text-sm">ربط قاعدة بيانات لكل موقع</Label>
            </div>
          </div>

          {useDb && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">نوع الاتصال</Label>
                <Select value={db.connectionKind} onValueChange={(v) => setDb({ ...db, connectionKind: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">محلي</SelectItem>
                    <SelectItem value="network">شبكة داخلية</SelectItem>
                    <SelectItem value="cloud">سحابي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">المحرّك</Label>
                <Select value={db.dbEngine} onValueChange={(v) => setDb({ ...db, dbEngine: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">السيرفر (اختياري)</Label>
                <Select value={db.serverId} onValueChange={(v) => setDb({ ...db, serverId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {servers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">قاعدة مُسجّلة (اختياري)</Label>
                <Select value={db.databaseId} onValueChange={(v) => setDb({ ...db, databaseId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {databases.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">المضيف</Label><Input className="mt-1" value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} /></div>
              <div><Label className="text-xs">المنفذ</Label><Input className="mt-1" value={db.port} onChange={(e) => setDb({ ...db, port: e.target.value })} /></div>
              <div><Label className="text-xs">اسم القاعدة</Label><Input className="mt-1" value={db.dbName} onChange={(e) => setDb({ ...db, dbName: e.target.value })} /></div>
              <div><Label className="text-xs">المستخدم</Label><Input className="mt-1" value={db.dbUser} onChange={(e) => setDb({ ...db, dbUser: e.target.value })} /></div>
              <div><Label className="text-xs">مفتاح البيئة</Label><Input className="mt-1" value={db.envKey} onChange={(e) => setDb({ ...db, envKey: e.target.value })} /></div>
            </div>
          )}

          <div>
            <Label className="text-xs">متغيرات بيئة إضافية (سطر لكل متغير: KEY=VALUE)</Label>
            <Textarea className="mt-1 font-mono text-xs" rows={4} value={envText} onChange={(e) => setEnvText(e.target.value)} placeholder={"API_BASE=https://api.hn.live\nREDIS_URL=redis://10.0.0.5:6379"} />
          </div>

          <Button disabled={selected.length === 0 || nothingToDo} onClick={() => setConfirmOpen(true)}>
            مراجعة وتطبيق على {selected.length} موقع
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card className="ring-1 ring-border bg-card/60">
          <CardHeader><CardTitle className="text-base">نتيجة التطبيق</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {results.map((r) => (
              <div key={r.websiteId} className="flex items-center gap-2 border-b border-border/30 py-1">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                <span className="font-medium">{domainOf(r.websiteId)}</span>
                <span className="text-xs text-muted-foreground">{r.ok ? r.steps.join(" · ") : r.error}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الربط الجماعي</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>سيتم التطبيق على <strong>{selected.length}</strong> موقع:</div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
                  {selected.slice(0, 30).map((id) => <Badge key={id} variant="outline">{domainOf(id)}</Badge>)}
                  {selected.length > 30 && <Badge variant="outline">+{selected.length - 30}</Badge>}
                </div>
                <ul className="list-disc pr-5 text-muted-foreground">
                  {serviceId && <li>ربط بالخدمة: {services.find((s: any) => s.id === serviceId)?.name}</li>}
                  {useDb && <li>قاعدة بيانات {db.dbEngine} ({db.connectionKind}) ← {db.envKey}</li>}
                  {envVars.length > 0 && <li>متغيرات: {envVars.map((v) => v.key).join(", ")}</li>}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => apply.mutate()} disabled={apply.isPending}>تنفيذ الآن</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
