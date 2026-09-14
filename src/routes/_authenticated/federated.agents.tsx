import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAgentsData, saveAgentConfig, getNginxConfig, saveNginxConfig, createSiteSnapshot, rollbackSiteSnapshot } from "@/lib/federated.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Loader2, Save, FileCode2, Camera, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/federated/agents")({
  component: AgentsPage,
  head: () => ({ meta: [{ title: "الوكيل — TVCC" }] }),
});

function AgentsPage() {
  const qc = useQueryClient();
  const fetchAgents = useServerFn(getAgentsData);
  const saveCfgFn = useServerFn(saveAgentConfig);
  const fetchNginx = useServerFn(getNginxConfig);
  const saveNginxFn = useServerFn(saveNginxConfig);
  const snapshotFn = useServerFn(createSiteSnapshot);
  const rollbackFn = useServerFn(rollbackSiteSnapshot);

  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hb, setHb] = useState(60);
  const [cmds, setCmds] = useState("");
  const [autostart, setAutostart] = useState(true);
  const [nginxOpen, setNginxOpen] = useState<any>(null);
  const [nginxContent, setNginxContent] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["federated-agents"], queryFn: () => fetchAgents(), refetchInterval: 10000 });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">جارٍ تحميل الوكلاء…</div>;

  const cfgFor = (sid: string) => (data.configs as any[]).find((c) => c.server_id === sid);
  const server = (data.servers as any[]).find((s) => s.id === selected);
  const serverSites = selected ? (data.websites as any[]).filter((w) => w.server_id === selected) : [];
  const serverNginx = selected ? (data.nginx as any[]).filter((n) => n.server_id === selected) : [];
  const serverCmds = selected ? (data.commands as any[]).filter((c) => c.server_id === selected) : [];

  const openServer = (sid: string) => {
    setSelected(sid);
    const c = cfgFor(sid);
    setHb(c?.heartbeat_interval_sec ?? 60);
    setCmds((c?.allowed_commands ?? []).join("\n"));
    setAutostart(c?.autostart ?? true);
  };

  const saveConfig = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await saveCfgFn({ data: { serverId: selected, heartbeatIntervalSec: hb, allowedCommands: cmds.split("\n").map((s) => s.trim()).filter(Boolean), autostart } });
      toast.success("حُفظت الإعدادات وأُرسلت للوكيل فوراً");
      qc.invalidateQueries({ queryKey: ["federated-agents"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const openNginx = async (row: any) => {
    const full = await fetchNginx({ data: { id: row.id } });
    setNginxOpen(full);
    setNginxContent(full.content);
  };

  const saveNginx = async () => {
    setBusy(true);
    try {
      await saveNginxFn({ data: { id: nginxOpen.id, serverId: nginxOpen.server_id, websiteId: nginxOpen.website_id ?? undefined, filePath: nginxOpen.file_path, content: nginxContent } });
      toast.success("أُرسل الملف — سيفحص الوكيل nginx -t قبل التطبيق ويتراجع عند الفشل");
      setNginxOpen(null);
      qc.invalidateQueries({ queryKey: ["federated-agents"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const snapshot = async (websiteId: string) => {
    setBusy(true);
    try { await snapshotFn({ data: { websiteId } }); toast.success("طُلبت لقطة جديدة (تحتفظ بنسختين: جديدة وقديمة)"); qc.invalidateQueries({ queryKey: ["federated-agents"] }); }
    catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const rollback = async (websiteId: string) => {
    setBusy(true);
    try { await rollbackFn({ data: { websiteId } }); toast.success("أُرسل أمر الاستعادة إلى النسخة القديمة"); }
    catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Bot className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">الوكيل (Agent Control)</h1>
          <p className="text-sm text-muted-foreground">كل وكيل على كل سيرفر — اتصال حي، إعدادات، Nginx، ونسخ المواقع</p>
        </div>
      </div>

      {!selected && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data.servers as any[]).map((s) => (
            <Card key={s.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openServer(s.id)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <Badge className={s.status === "online" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}>{s.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground" dir="ltr">{s.hostname}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>وكيل v{s.agent_version ?? "—"}</span>
                  <span>آخر نبضة: {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString("ar") : "—"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && server && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>رجوع</Button>
              <h2 className="text-lg font-bold">{server.name} <span className="text-xs text-muted-foreground" dir="ltr">{server.hostname}</span></h2>
            </div>
            <Badge className={server.status === "online" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}>{server.status}</Badge>
          </div>

          <Tabs defaultValue="ops">
            <TabsList>
              <TabsTrigger value="ops">العمليات الحية</TabsTrigger>
              <TabsTrigger value="sites">المواقع والنسخ</TabsTrigger>
              <TabsTrigger value="nginx">إعدادات Nginx</TabsTrigger>
              <TabsTrigger value="config"><Settings2 className="w-3 h-3 ml-1" /> إعدادات الوكيل</TabsTrigger>
            </TabsList>

            <TabsContent value="ops">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>الأمر</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {serverCmds.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell dir="ltr" className="font-mono text-xs">{c.command}</TableCell>
                        <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</TableCell>
                      </TableRow>
                    ))}
                    {serverCmds.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">لا أوامر مسجّلة لهذا السيرفر</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="sites">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>الموقع</TableHead><TableHead>الحالة</TableHead><TableHead>النسخة الجديدة</TableHead><TableHead>النسخة القديمة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {serverSites.map((w) => {
                      const cur = (data.snapshots as any[]).find((s) => s.website_id === w.id && s.slot === "current");
                      const prev = (data.snapshots as any[]).find((s) => s.website_id === w.id && s.slot === "previous");
                      return (
                        <TableRow key={w.id}>
                          <TableCell dir="ltr" className="font-medium">{w.domain}</TableCell>
                          <TableCell><Badge variant="outline">{w.status}</Badge></TableCell>
                          <TableCell className="text-xs">{cur ? new Date(cur.created_at).toLocaleString("ar") : "—"}</TableCell>
                          <TableCell className="text-xs">{prev ? new Date(prev.created_at).toLocaleString("ar") : "—"}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => snapshot(w.id)}><Camera className="w-3 h-3 ml-1" /> لقطة</Button>
                            <Button size="sm" variant="outline" disabled={busy || !prev} onClick={() => rollback(w.id)}><RotateCcw className="w-3 h-3 ml-1" /> استعادة القديمة</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {serverSites.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا مواقع على هذا السيرفر</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="nginx" className="space-y-3">
              <p className="text-xs text-muted-foreground">كل تعديل يُفحص بـ <code dir="ltr">nginx -t</code> قبل التطبيق، مع تراجع تلقائي عند الفشل.</p>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>الملف</TableHead><TableHead>الموقع</TableHead><TableHead>الإصدار</TableHead><TableHead>آخر تحديث</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {serverNginx.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell dir="ltr" className="font-mono text-xs">{n.file_path}</TableCell>
                        <TableCell dir="ltr" className="text-xs">{(data.websites as any[]).find((w) => w.id === n.website_id)?.domain ?? "—"}</TableCell>
                        <TableCell>v{n.version}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(n.updated_at).toLocaleString("ar")}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => openNginx(n)}><FileCode2 className="w-3 h-3 ml-1" /> تحرير</Button></TableCell>
                      </TableRow>
                    ))}
                    {serverNginx.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا ملفات Nginx مسجّلة — يجمعها الوكيل مع النبضة القادمة</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="config">
              <Card><CardContent className="p-4 space-y-4 max-w-xl">
                <div className="space-y-1">
                  <label className="text-sm">فاصل النبضة (ثانية)</label>
                  <Input type="number" min={15} value={hb} onChange={(e) => setHb(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm">الأوامر المسموحة (سطر لكل أمر)</label>
                  <Textarea dir="ltr" rows={6} value={cmds} onChange={(e) => setCmds(e.target.value)} className="font-mono text-xs" placeholder={"nginx_read\nnginx_write\nnginx_test\nnginx_reload\nsite_snapshot\nsite_rollback\nagent_config_set\nproc_list"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">التشغيل التلقائي عند الإقلاع</span>
                  <Switch checked={autostart} onCheckedChange={setAutostart} />
                </div>
                <Button onClick={saveConfig} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />} حفظ ودفع للوكيل</Button>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={!!nginxOpen} onOpenChange={() => setNginxOpen(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader><DialogTitle dir="ltr" className="font-mono text-sm">{nginxOpen?.file_path}</DialogTitle></DialogHeader>
          <Textarea dir="ltr" rows={18} value={nginxContent} onChange={(e) => setNginxContent(e.target.value)} className="font-mono text-xs" />
          <DialogFooter><Button onClick={saveNginx} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin ml-1" />} فحص وحفظ وإعادة تحميل</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
