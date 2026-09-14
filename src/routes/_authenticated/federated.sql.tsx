import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getFederatedQueries, runFederatedQuery } from "@/lib/federated.functions";
import { getFleetData } from "@/lib/federated.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Database, Loader2, Play, FlaskConical, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/sql")({
  component: FederatedSqlPage,
  head: () => ({ meta: [{ title: "استوديو قواعد البيانات — TVCC" }] }),
});

const DESTRUCTIVE = /\b(drop|truncate|alter\s+table|grant|revoke)\b/i;

function FederatedSqlPage() {
  const qc = useQueryClient();
  const fetchQueries = useServerFn(getFederatedQueries);
  const fetchFleet = useServerFn(getFleetData);
  const runFn = useServerFn(runFederatedQuery);
  const [sql, setSql] = useState("");
  const [targetKind, setTargetKind] = useState<"site" | "group" | "all">("all");
  const [targetId, setTargetId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: queries } = useQuery({ queryKey: ["federated-queries"], queryFn: () => fetchQueries(), refetchInterval: 15000 });
  const { data: fleet } = useQuery({ queryKey: ["federated-fleet"], queryFn: () => fetchFleet() });

  const destructive = DESTRUCTIVE.test(sql);
  const confirmed = !destructive || confirmText.trim().toLowerCase() === "تأكيد";

  const run = async (dryRun: boolean) => {
    if (!sql.trim()) return toast.error("أدخل الاستعلام");
    if (!confirmed) return toast.error("اكتب «تأكيد» للسماح بالأمر المدمّر");
    setBusy(true);
    try {
      await runFn({ data: { sql, targetKind, targetIds: targetId ? [targetId] : [], confirmed, dryRun } });
      toast.success(dryRun ? "تم التشغيل التجريبي (Dry Run) وسُجّل" : "أُرسل الاستعلام إلى الوكلاء");
      qc.invalidateQueries({ queryKey: ["federated-queries"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Database className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">استوديو قواعد البيانات</h1>
          <p className="text-sm text-muted-foreground">محرر SQL جماعي — موقع، مجموعة، أو كل الأسطول</p>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">المحرر الجماعي</TabsTrigger>
          <TabsTrigger value="history">السجل</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card><CardContent className="p-4 space-y-3">
            <Textarea dir="ltr" rows={8} value={sql} onChange={(e) => setSql(e.target.value)} placeholder="SELECT ..." className="font-mono text-sm" />
            <div className="flex flex-wrap items-center gap-3">
              <Select value={targetKind} onValueChange={(v: any) => setTargetKind(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">موقع واحد</SelectItem>
                  <SelectItem value="group">مجموعة</SelectItem>
                  <SelectItem value="all">كل المواقع</SelectItem>
                </SelectContent>
              </Select>
              {targetKind === "site" && (
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="اختر الموقع" /></SelectTrigger>
                  <SelectContent>{((fleet?.websites ?? []) as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.domain}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={() => run(true)} disabled={busy}><FlaskConical className="w-4 h-4 ml-1" /> تشغيل تجريبي</Button>
              <Button onClick={() => run(false)} disabled={busy || !confirmed}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Play className="w-4 h-4 ml-1" />} تنفيذ
              </Button>
            </div>
            {destructive && (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                <div className="flex-1 text-sm">استعلام مدمّر محتمل — اكتب «تأكيد» للمتابعة:</div>
                <Input className="w-40" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="تأكيد" />
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>الاستعلام</TableHead><TableHead>الهدف</TableHead><TableHead>الحالة</TableHead><TableHead>مدمّر</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>
                {((queries ?? []) as any[]).map((q) => (
                  <TableRow key={q.id}>
                    <TableCell dir="ltr" className="font-mono text-xs max-w-md truncate">{q.sql_text}</TableCell>
                    <TableCell>{q.target_kind}</TableCell>
                    <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                    <TableCell>{q.destructive ? <Badge className="bg-destructive/15 text-destructive">نعم</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
                {(queries ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا استعلامات بعد</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
