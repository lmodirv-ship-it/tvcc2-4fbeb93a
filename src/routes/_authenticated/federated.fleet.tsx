import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getFleetData, startSiteClone, saveBlueprint, deployBlueprint } from "@/lib/federated.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Copy, Loader2, Plus, Rocket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/fleet")({
  component: FleetPage,
  head: () => ({ meta: [{ title: "المواقع والأسطول — TVCC" }] }),
});

function FleetPage() {
  const qc = useQueryClient();
  const fetchFleet = useServerFn(getFleetData);
  const cloneFn = useServerFn(startSiteClone);
  const saveBpFn = useServerFn(saveBlueprint);
  const deployBpFn = useServerFn(deployBlueprint);
  const [search, setSearch] = useState("");
  const [cloneSite, setCloneSite] = useState<any>(null);
  const [targetServer, setTargetServer] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [bpOpen, setBpOpen] = useState(false);
  const [bpName, setBpName] = useState("");
  const [bpSql, setBpSql] = useState("");
  const [deployBp, setDeployBp] = useState<any>(null);
  const [deployTargets, setDeployTargets] = useState<string[]>([]);

  const { data, isLoading } = useQuery({ queryKey: ["federated-fleet"], queryFn: () => fetchFleet(), refetchInterval: 15000 });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل الأسطول…</div>;

  const websites = (data.websites as any[]).filter((w) => !search || w.name?.includes(search) || w.domain?.includes(search));
  const serverName = (id: string) => (data.servers as any[]).find((s) => s.id === id)?.name ?? "—";

  const doClone = async () => {
    if (!targetServer) return toast.error("اختر سيرفر الوجهة");
    setBusy(true);
    try {
      await cloneFn({ data: { websiteId: cloneSite.id, targetServerId: targetServer, newDomain: newDomain || undefined } });
      toast.success("أُرسل أمر الاستنساخ إلى الوكيل");
      setCloneSite(null);
      qc.invalidateQueries({ queryKey: ["federated-fleet"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const doSaveBp = async () => {
    if (!bpName.trim()) return toast.error("أدخل اسم القالب");
    setBusy(true);
    try {
      await saveBpFn({ data: { name: bpName, schemaSql: bpSql } });
      toast.success("حُفظ القالب الأم");
      setBpOpen(false); setBpName(""); setBpSql("");
      qc.invalidateQueries({ queryKey: ["federated-fleet"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const doDeploy = async () => {
    if (deployTargets.length === 0) return toast.error("اختر المواقع المستهدفة");
    setBusy(true);
    try {
      const r = await deployBpFn({ data: { blueprintId: deployBp.id, websiteIds: deployTargets } });
      toast.success(`نُشر القالب كمهمة على ${r.created} موقعاً`);
      setDeployBp(null); setDeployTargets([]);
      qc.invalidateQueries({ queryKey: ["federated-fleet"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Globe className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">المواقع والأسطول</h1>
          <p className="text-sm text-muted-foreground">{data.websites.length} موقعاً · استنساخ ونشر جماعي عبر الوكيل</p>
        </div>
      </div>

      <Tabs defaultValue="sites">
        <TabsList>
          <TabsTrigger value="sites">المواقع</TabsTrigger>
          <TabsTrigger value="blueprints">القوالب الأم</TabsTrigger>
          <TabsTrigger value="clones">عمليات الاستنساخ</TabsTrigger>
          <TabsTrigger value="deployments">سجل النشر</TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="space-y-3">
          <Input placeholder="بحث بالاسم أو النطاق…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>الموقع</TableHead><TableHead>النطاق</TableHead><TableHead>السيرفر</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {websites.slice(0, 200).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell dir="ltr">{w.domain}</TableCell>
                    <TableCell>{serverName(w.server_id)}</TableCell>
                    <TableCell><Badge className={w.status === "online" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>{w.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => { setCloneSite(w); setTargetServer(""); setNewDomain(""); }}>
                        <Copy className="w-3 h-3 ml-1" /> استنساخ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="blueprints" className="space-y-3">
          <Button onClick={() => setBpOpen(true)}><Plus className="w-4 h-4 ml-1" /> قالب أم جديد</Button>
          <div className="grid gap-3 md:grid-cols-2">
            {(data.blueprints as any[]).map((b) => (
              <Card key={b.id}>
                <CardHeader><CardTitle className="text-base flex items-center justify-between">{b.name} <Badge variant="outline">v{b.version}</Badge></CardTitle></CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{b.is_active ? "نشط" : "موقوف"}</span>
                  <Button size="sm" onClick={() => { setDeployBp(b); setDeployTargets([]); }}><Rocket className="w-3 h-3 ml-1" /> نشر جماعي</Button>
                </CardContent>
              </Card>
            ))}
            {data.blueprints.length === 0 && <p className="text-sm text-muted-foreground">لا قوالب بعد — أنشئ قالباً يعرّف هيكل الجداول مرة واحدة ويُنشر على كل المواقع.</p>}
          </div>
        </TabsContent>

        <TabsContent value="clones">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>الموقع المصدر</TableHead><TableHead>الوجهة</TableHead><TableHead>نطاق جديد</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data.clones as any[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{(data.websites as any[]).find((w) => w.id === c.source_website_id)?.domain ?? "—"}</TableCell>
                    <TableCell>{serverName(c.target_server_id)}</TableCell>
                    <TableCell dir="ltr">{c.new_domain ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
                {data.clones.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا عمليات استنساخ بعد</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="deployments">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>القالب</TableHead><TableHead>الموقع</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data.deployments as any[]).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{(data.blueprints as any[]).find((b) => b.id === d.blueprint_id)?.name ?? "—"}</TableCell>
                    <TableCell dir="ltr">{(data.websites as any[]).find((w) => w.id === d.website_id)?.domain ?? "—"}</TableCell>
                    <TableCell><Badge className={d.status === "success" ? "bg-success/15 text-success" : d.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}>{d.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
                {data.deployments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا عمليات نشر بعد</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!cloneSite} onOpenChange={() => setCloneSite(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>استنساخ «{cloneSite?.domain}» إلى سيرفر آخر</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={targetServer} onValueChange={setTargetServer}>
              <SelectTrigger><SelectValue placeholder="سيرفر الوجهة" /></SelectTrigger>
              <SelectContent>{(data.servers as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.hostname})</SelectItem>)}</SelectContent>
            </Select>
            <Input dir="ltr" placeholder="نطاق جديد (اختياري)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={doClone} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} بدء الاستنساخ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bpOpen} onOpenChange={setBpOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>قالب أم جديد (Master Blueprint)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="اسم القالب" value={bpName} onChange={(e) => setBpName(e.target.value)} />
            <Textarea dir="ltr" rows={10} placeholder="CREATE TABLE ... -- هيكل الجداول والعلاقات" value={bpSql} onChange={(e) => setBpSql(e.target.value)} className="font-mono text-xs" />
          </div>
          <DialogFooter><Button onClick={doSaveBp} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deployBp} onOpenChange={() => setDeployBp(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>نشر «{deployBp?.name}» على المواقع المستهدفة</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-auto space-y-2">
            {(data.websites as any[]).map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={deployTargets.includes(w.id)} onCheckedChange={(v) => setDeployTargets((p) => v ? [...p, w.id] : p.filter((x) => x !== w.id))} />
                <span dir="ltr">{w.domain}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployTargets((data.websites as any[]).map((w) => w.id))}>اختيار الكل</Button>
            <Button onClick={doDeploy} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} نشر على {deployTargets.length} موقعاً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
