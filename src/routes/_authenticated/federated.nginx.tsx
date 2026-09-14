import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getNginxServers, getNginxCommands, queueNginxAction, buildVhost, type NginxAction,
} from "@/lib/nginx.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Globe, RefreshCw, FileCode, ShieldCheck, ScrollText, BarChart3, Power, Trash2, Wand2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/nginx")({
  component: NginxPage,
  head: () => ({
    meta: [
      { title: "الواجهة والتوجيه (Nginx) — TVCC" },
      { name: "description", content: "إدارة مواقع Nginx وشهادات SSL والسجلات والإحصاءات على كل سيرفرات TVCC مع فحص وتراجع تلقائي." },
      { property: "og:title", content: "الواجهة والتوجيه (Nginx) — TVCC" },
      { property: "og:description", content: "تحرير ملفات التوجيه، إصدار الشهادات، وقراءة السجلات من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Cmd = {
  id: string; action: string; args: any; status: string;
  output: string | null; exit_code: number | null; created_at: string; dry_run?: boolean;
};

function parseJsonLines(output: string | null): any[] {
  if (!output) return [];
  return output.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{") && l.endsWith("}"))
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function latest(cmds: Cmd[], action: string): Cmd | undefined {
  return cmds.find((c) => c.action === action && !c.dry_run);
}

function daysLeft(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

function NginxPage() {
  const qc = useQueryClient();
  const fetchServers = useServerFn(getNginxServers);
  const fetchCommands = useServerFn(getNginxCommands);
  const queueAction = useServerFn(queueNginxAction);

  const [serverId, setServerId] = useState("");
  const [editFile, setEditFile] = useState("");
  const [editBody, setEditBody] = useState("");
  const [gen, setGen] = useState({ domain: "", port: "3000", ssl: true, websocket: true, maxBodyMb: "50", staticRoot: "" });
  const [logQuery, setLogQuery] = useState("");
  const [certDomain, setCertDomain] = useState("");
  const [certEmail, setCertEmail] = useState("");

  const servers = useQuery({ queryKey: ["nginx-servers"], queryFn: () => fetchServers() });
  const activeServer = serverId || servers.data?.servers?.[0]?.id || "";

  const commands = useQuery({
    queryKey: ["nginx-commands", activeServer],
    queryFn: () => fetchCommands({ data: { serverId: activeServer } }) as Promise<Cmd[]>,
    enabled: Boolean(activeServer),
    refetchInterval: 5000,
  });

  const cmds = commands.data ?? [];
  const listCmd = latest(cmds, "nginx_vhost_list");
  const readCmd = latest(cmds, "nginx_vhost_read");
  const certCmd = latest(cmds, "nginx_cert_list");
  const accessCmd = latest(cmds, "nginx_access_log");
  const errorCmd = latest(cmds, "nginx_error_log");
  const statsCmd = latest(cmds, "nginx_stats");
  const testCmd = latest(cmds, "nginx_test");
  const writeCmd = latest(cmds, "nginx_vhost_write");

  const vhosts = useMemo(() => parseJsonLines(listCmd?.output ?? null), [listCmd?.output]);
  const certs = useMemo(() => parseJsonLines(certCmd?.output ?? null), [certCmd?.output]);

  async function run(action: NginxAction, args: Record<string, unknown> = {}, opts: { dryRun?: boolean; confirm?: string } = {}) {
    if (!activeServer) { toast.error("اختر سيرفراً أولاً"); return; }
    if (opts.confirm && !window.confirm(opts.confirm)) return;
    try {
      await queueAction({ data: { serverId: activeServer, action, args, dryRun: opts.dryRun } });
      toast.success(opts.dryRun ? "تمت جدولة معاينة آمنة" : "أُرسل الأمر إلى الوكيل");
      qc.invalidateQueries({ queryKey: ["nginx-commands", activeServer] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إرسال الأمر");
    }
  }

  const generated = gen.domain
    ? buildVhost({
        domain: gen.domain,
        port: Number(gen.port) || 3000,
        ssl: gen.ssl,
        websocket: gen.websocket,
        maxBodyMb: Number(gen.maxBodyMb) || 50,
        staticRoot: gen.staticRoot || null,
      })
    : "";

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">الواجهة والتوجيه (Nginx)</h1>
            <p className="text-sm text-muted-foreground">كل كتابة تمر بفحص الإعداد، ومع أي خطأ يرجع الوكيل للنسخة السابقة تلقائياً</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeServer} onValueChange={setServerId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
            <SelectContent>
              {(servers.data?.servers ?? []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { run("nginx_vhost_list"); run("nginx_cert_list"); run("nginx_stats"); }} disabled={!activeServer}>
            <RefreshCw className="w-4 h-4 ml-2" /> تحديث من السيرفر
          </Button>
        </div>
      </div>

      {!activeServer ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          أضف سيرفراً وثبّت عليه وكيل TVCC ليظهر توجيه المواقع هنا.
        </CardContent></Card>
      ) : (
        <Tabs defaultValue="sites">
          <TabsList>
            <TabsTrigger value="sites">المواقع</TabsTrigger>
            <TabsTrigger value="editor">المحرّر</TabsTrigger>
            <TabsTrigger value="generator">مولّد الإعداد</TabsTrigger>
            <TabsTrigger value="certs">الشهادات</TabsTrigger>
            <TabsTrigger value="logs">السجلات</TabsTrigger>
            <TabsTrigger value="stats">الإحصاءات</TabsTrigger>
          </TabsList>

          <TabsContent value="sites">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><FileCode className="w-4 h-4" /> المواقع ({vhosts.length})</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => run("nginx_test")}>فحص الإعداد</Button>
                  <Button size="sm" variant="outline" onClick={() => run("nginx_reload")}>إعادة التحميل</Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto space-y-3">
                {testCmd?.output && <pre className="bg-muted rounded p-2 text-xs whitespace-pre-wrap">{testCmd.output}</pre>}
                {vhosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">اضغط «تحديث من السيرفر» ليجلب الوكيل قائمة المواقع الحقيقية.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>الملف</TableHead><TableHead>النطاق</TableHead><TableHead>الوجهة</TableHead>
                      <TableHead>مفعّل</TableHead><TableHead>SSL</TableHead><TableHead>آخر تعديل</TableHead><TableHead className="text-left">إجراءات</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {vhosts.map((v: any) => (
                        <TableRow key={v.path}>
                          <TableCell className="font-mono text-xs">{v.file}</TableCell>
                          <TableCell>{v.server_name || "—"}</TableCell>
                          <TableCell className="text-xs">{v.proxy_pass || "ملفات ثابتة"}</TableCell>
                          <TableCell><Badge variant={v.enabled ? "secondary" : "outline"}>{v.enabled ? "مفعّل" : "متوقف"}</Badge></TableCell>
                          <TableCell>{v.ssl ? <ShieldCheck className="w-4 h-4 text-primary" /> : "—"}</TableCell>
                          <TableCell className="text-xs">{v.modified}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => { setEditFile(v.file); run("nginx_vhost_read", { file: v.file }); }}>تحرير</Button>
                              <Button size="icon" variant="ghost" title={v.enabled ? "تعطيل" : "تفعيل"}
                                onClick={() => run(v.enabled ? "nginx_vhost_disable" : "nginx_vhost_enable", { file: v.file }, v.enabled ? { confirm: `تعطيل ${v.file}؟` } : {})}>
                                <Power className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="حذف"
                                onClick={() => run("nginx_vhost_delete", { file: v.file }, { confirm: `حذف إعداد ${v.file}؟ تُحفظ نسخة احتياطية على السيرفر.` })}>
                                <Trash2 className="w-4 h-4 text-destructive" />
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
          </TabsContent>

          <TabsContent value="editor">
            <Card>
              <CardHeader><CardTitle>تحرير ملف التوجيه</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={editFile} onChange={(e) => setEditFile(e.target.value)} placeholder="example.com" className="max-w-sm" />
                  <Button variant="outline" onClick={() => run("nginx_vhost_read", { file: editFile })} disabled={!editFile}>قراءة</Button>
                  {readCmd?.output && <Button variant="ghost" onClick={() => setEditBody(readCmd.output ?? "")}>تحميل للمحرّر</Button>}
                </div>
                <Textarea rows={18} className="font-mono text-xs" value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => run("nginx_vhost_write", { file: editFile, content: editBody }, { dryRun: true })}>معاينة آمنة</Button>
                  <Button disabled={!editFile || !editBody}
                    onClick={() => run("nginx_vhost_write", { file: editFile, content: editBody }, { confirm: "حفظ الإعداد؟ سيُفحص قبل التطبيق ويُرجع تلقائياً عند الفشل." })}>
                    حفظ مع فحص وتراجع
                  </Button>
                </div>
                {writeCmd?.output && <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap max-h-60 overflow-auto">{writeCmd.output}</pre>}
                {readCmd?.output && <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap max-h-72 overflow-auto">{readCmd.output}</pre>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generator">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> مولّد إعداد جاهز</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>النطاق</Label><Input value={gen.domain} onChange={(e) => setGen({ ...gen, domain: e.target.value })} placeholder="app.example.com" /></div>
                  <div><Label>المنفذ الخلفي</Label><Input value={gen.port} onChange={(e) => setGen({ ...gen, port: e.target.value })} /></div>
                  <div><Label>أقصى حجم رفع (م.ب)</Label><Input value={gen.maxBodyMb} onChange={(e) => setGen({ ...gen, maxBodyMb: e.target.value })} /></div>
                  <div><Label>مجلد ملفات ثابتة (اختياري)</Label><Input value={gen.staticRoot} onChange={(e) => setGen({ ...gen, staticRoot: e.target.value })} placeholder="/var/www/example.com" /></div>
                  <div className="flex items-center gap-2 pt-6"><Switch checked={gen.ssl} onCheckedChange={(v) => setGen({ ...gen, ssl: v })} /><Label>تفعيل SSL</Label></div>
                  <div className="flex items-center gap-2 pt-6"><Switch checked={gen.websocket} onCheckedChange={(v) => setGen({ ...gen, websocket: v })} /><Label>دعم WebSocket</Label></div>
                </div>
                {generated && <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap max-h-72 overflow-auto">{generated}</pre>}
                <div className="flex gap-2">
                  <Button variant="outline" disabled={!generated} onClick={() => { setEditFile(gen.domain); setEditBody(generated); toast.success("نُقل الإعداد إلى المحرّر"); }}>نقل إلى المحرّر</Button>
                  <Button disabled={!generated}
                    onClick={() => run("nginx_vhost_write", { file: gen.domain, content: generated }, { confirm: `نشر إعداد ${gen.domain}؟` })}>
                    نشر مباشرة
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certs">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> شهادات SSL</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => run("nginx_cert_list")}><RefreshCw className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => run("nginx_cert_renew", {}, { confirm: "تشغيل جولة تجديد للشهادات؟" })}>تجديد الكل</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>نطاق جديد</Label><Input value={certDomain} onChange={(e) => setCertDomain(e.target.value)} placeholder="app.example.com" /></div>
                  <div><Label>بريد التنبيه (اختياري)</Label><Input value={certEmail} onChange={(e) => setCertEmail(e.target.value)} /></div>
                  <div className="flex items-end">
                    <Button className="w-full" disabled={!certDomain}
                      onClick={() => run("nginx_cert_issue", { domain: certDomain, email: certEmail || null }, { confirm: `إصدار شهادة لـ ${certDomain}؟` })}>
                      إصدار شهادة
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>النطاق</TableHead><TableHead>ينتهي في</TableHead><TableHead>المتبقي</TableHead><TableHead>المُصدِر</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {certs.map((c: any) => {
                      const d = daysLeft(c.expires);
                      return (
                        <TableRow key={c.path}>
                          <TableCell>{c.domain}</TableCell>
                          <TableCell className="text-xs">{c.expires}</TableCell>
                          <TableCell>
                            {d === null ? "—" : <Badge variant={d < 30 ? "destructive" : "secondary"}>{d} يوم</Badge>}
                          </TableCell>
                          <TableCell className="text-xs">{c.issuer}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="w-4 h-4" /> السجلات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={logQuery} onChange={(e) => setLogQuery(e.target.value)} placeholder="بحث داخل سجل الزيارات (اختياري)" className="max-w-sm" />
                  <Button variant="outline" onClick={() => run("nginx_access_log", { lines: 300, grep: logQuery || null })}>سجل الزيارات</Button>
                  <Button variant="outline" onClick={() => run("nginx_error_log", { lines: 300 })}>سجل الأخطاء</Button>
                </div>
                {accessCmd?.output && <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap max-h-80 overflow-auto">{accessCmd.output}</pre>}
                {errorCmd?.output && <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap max-h-80 overflow-auto">{errorCmd.output}</pre>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> إحصاءات مباشرة</CardTitle>
                <Button size="sm" variant="outline" onClick={() => run("nginx_stats")}><RefreshCw className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent>
                {statsCmd?.output
                  ? <pre className="bg-muted rounded p-3 text-xs whitespace-pre-wrap max-h-96 overflow-auto">{statsCmd.output}</pre>
                  : <p className="text-sm text-muted-foreground">اطلب الإحصاءات ليحسبها الوكيل من سجل الزيارات الحقيقي.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
