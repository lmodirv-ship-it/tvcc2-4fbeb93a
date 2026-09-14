import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getDockerServers, getDockerCommands, queueDockerAction, bindContainerDomain,
  type DockerAction,
} from "@/lib/docker.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Container, RefreshCw, Play, Square, RotateCw, FileText, Trash2, Download,
  Layers, HardDrive, Network, Globe, Sparkles, Terminal,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/federated/docker")({
  component: DockerPage,
  head: () => ({
    meta: [
      { title: "إدارة الحاويات Docker — TVCC" },
      { name: "description", content: "تحكم كامل في حاويات Docker وصورها وشبكاتها وملفات Compose على كل سيرفرات TVCC عبر الوكيل الموقّع." },
      { property: "og:title", content: "إدارة الحاويات Docker — TVCC" },
      { property: "og:description", content: "تشغيل وإيقاف وسجلات وإنشاء الحاويات وربطها بالنطاقات من مكان واحد." },
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
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{") && l.endsWith("}"))
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function latest(commands: Cmd[], action: string): Cmd | undefined {
  return commands.find((c) => c.action === action && !c.dry_run);
}

function StatusBadge({ cmd }: { cmd?: Cmd }) {
  if (!cmd) return <Badge variant="outline">لم يُطلب بعد</Badge>;
  if (cmd.status === "done" || cmd.status === "completed") {
    return <Badge variant={cmd.exit_code ? "destructive" : "secondary"}>
      {cmd.exit_code ? `انتهى بخطأ (${cmd.exit_code})` : "محدّث من الوكيل"}
    </Badge>;
  }
  if (cmd.status === "failed") return <Badge variant="destructive">فشل</Badge>;
  return <Badge>بانتظار الوكيل…</Badge>;
}

function DockerPage() {
  const qc = useQueryClient();
  const fetchServers = useServerFn(getDockerServers);
  const fetchCommands = useServerFn(getDockerCommands);
  const queueAction = useServerFn(queueDockerAction);
  const bindDomain = useServerFn(bindContainerDomain);

  const [serverId, setServerId] = useState<string>("");
  const [logTarget, setLogTarget] = useState<string>("");
  const [composePath, setComposePath] = useState("/opt/tvcc/docker-compose.yml");
  const [composeBody, setComposeBody] = useState("");
  const [newC, setNewC] = useState({ name: "", image: "", ports: "", volumes: "", env: "", restart: "unless-stopped" });
  const [bind, setBind] = useState({ domain: "", port: "", ssl: true });
  const [execCmd, setExecCmd] = useState("");

  const servers = useQuery({ queryKey: ["docker-servers"], queryFn: () => fetchServers() });
  const activeServer = serverId || servers.data?.servers?.[0]?.id || "";

  const commands = useQuery({
    queryKey: ["docker-commands", activeServer],
    queryFn: () => fetchCommands({ data: { serverId: activeServer } }) as Promise<Cmd[]>,
    enabled: Boolean(activeServer),
    refetchInterval: 5000,
  });

  const cmds = commands.data ?? [];
  const psCmd = latest(cmds, "docker_ps");
  const statsCmd = latest(cmds, "docker_stats");
  const imagesCmd = latest(cmds, "docker_images");
  const netCmd = latest(cmds, "docker_networks");
  const volCmd = latest(cmds, "docker_volumes");
  const logsCmd = latest(cmds, "docker_logs");
  const composeCmd = latest(cmds, "docker_compose_read");

  const containers = useMemo(() => parseJsonLines(psCmd?.output ?? null), [psCmd?.output]);
  const stats = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of parseJsonLines(statsCmd?.output ?? null)) map.set(String(s.name), s);
    return map;
  }, [statsCmd?.output]);
  const images = useMemo(() => parseJsonLines(imagesCmd?.output ?? null), [imagesCmd?.output]);
  const networks = useMemo(() => parseJsonLines(netCmd?.output ?? null), [netCmd?.output]);
  const volumes = useMemo(() => parseJsonLines(volCmd?.output ?? null), [volCmd?.output]);

  const agentsByServer = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of servers.data?.agents ?? []) map.set(a.server_id, (map.get(a.server_id) ?? 0) + 1);
    return map;
  }, [servers.data]);

  async function run(action: DockerAction, args: Record<string, unknown> = {}, opts: { dryRun?: boolean; confirm?: string } = {}) {
    if (!activeServer) { toast.error("اختر سيرفراً أولاً"); return; }
    if (opts.confirm && !window.confirm(opts.confirm)) return;
    try {
      await queueAction({ data: { serverId: activeServer, action, args, dryRun: opts.dryRun } });
      toast.success(opts.dryRun ? "تمت جدولة معاينة آمنة" : "أُرسل الأمر إلى الوكيل");
      qc.invalidateQueries({ queryKey: ["docker-commands", activeServer] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر إرسال الأمر");
    }
  }

  async function refreshAll() {
    for (const a of ["docker_ps", "docker_stats", "docker_images", "docker_networks", "docker_volumes"] as DockerAction[]) {
      await run(a);
    }
  }

  function parseEnv(text: string) {
    const out: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return out;
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Container className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">إدارة الحاويات (Docker)</h1>
            <p className="text-sm text-muted-foreground">كل عملية تُنفَّذ عبر وكيل TVCC الموقّع وتُسجَّل في السجل الأمني</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeServer} onValueChange={setServerId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
            <SelectContent>
              {(servers.data?.servers ?? []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {agentsByServer.get(s.id) ? `· ${agentsByServer.get(s.id)} وكيل` : "· بلا وكيل"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={refreshAll} disabled={!activeServer}>
            <RefreshCw className="w-4 h-4 ml-2" /> تحديث من السيرفر
          </Button>
        </div>
      </div>

      {!activeServer ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          أضف سيرفراً وثبّت عليه وكيل TVCC من «مركز التحميل» لتظهر حاوياته هنا.
        </CardContent></Card>
      ) : (
        <Tabs defaultValue="containers">
          <TabsList>
            <TabsTrigger value="containers">الحاويات</TabsTrigger>
            <TabsTrigger value="images">الصور</TabsTrigger>
            <TabsTrigger value="infra">الشبكات والمجلدات</TabsTrigger>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="create">إنشاء حاوية</TabsTrigger>
            <TabsTrigger value="domain">ربط نطاق</TabsTrigger>
            <TabsTrigger value="history">السجل</TabsTrigger>
          </TabsList>

          <TabsContent value="containers" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><Container className="w-4 h-4" /> الحاويات ({containers.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <StatusBadge cmd={psCmd} />
                  <Button size="sm" variant="outline" onClick={() => run("docker_ps")}><RefreshCw className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => run("docker_prune", {}, { confirm: "سيحذف Docker كل الموارد غير المستعملة. متابعة؟" })}>
                    <Trash2 className="w-4 h-4 ml-1" /> تنظيف
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {containers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    اضغط «تحديث من السيرفر» ليجلب الوكيل قائمة الحاويات الحقيقية.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المعرّف</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الصورة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>المنافذ</TableHead>
                        <TableHead>المعالج</TableHead>
                        <TableHead>الذاكرة</TableHead>
                        <TableHead>الشبكة</TableHead>
                        <TableHead className="text-left">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {containers.map((c: any) => {
                        const st = stats.get(String(c.name));
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{String(c.id).slice(0, 12)}</TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-xs">{c.image}</TableCell>
                            <TableCell>
                              <Badge variant={c.state === "running" ? "secondary" : "outline"}>{c.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{c.ports || "—"}</TableCell>
                            <TableCell className="text-xs">{st?.cpu ?? "—"}</TableCell>
                            <TableCell className="text-xs">{st?.mem ?? "—"}</TableCell>
                            <TableCell className="text-xs">{st?.net ?? "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" title="تشغيل" onClick={() => run("docker_action", { container: c.name, op: "start" })}><Play className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" title="إيقاف" onClick={() => run("docker_action", { container: c.name, op: "stop" }, { confirm: `إيقاف ${c.name}؟` })}><Square className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" title="إعادة تشغيل" onClick={() => run("docker_action", { container: c.name, op: "restart" }, { confirm: `إعادة تشغيل ${c.name}؟` })}><RotateCw className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" title="السجلات" onClick={() => { setLogTarget(c.name); run("docker_logs", { container: c.name, lines: 300 }); }}><FileText className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" title="حذف" onClick={() => run("docker_rm", { container: c.name, force: true }, { confirm: `حذف الحاوية ${c.name} نهائياً؟` })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="w-4 h-4" /> تنفيذ أمر داخل حاوية</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>الحاوية</Label><Input value={logTarget} onChange={(e) => setLogTarget(e.target.value)} placeholder="my-app" /></div>
                  <div className="md:col-span-2"><Label>الأمر</Label><Input value={execCmd} onChange={(e) => setExecCmd(e.target.value)} placeholder="ls -la /app" /></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => run("docker_exec", { container: logTarget, cmd: execCmd }, { dryRun: true })}>معاينة آمنة</Button>
                  <Button onClick={() => run("docker_exec", { container: logTarget, cmd: execCmd }, { confirm: "تنفيذ الأمر داخل الحاوية؟" })} disabled={!logTarget || !execCmd}>تنفيذ</Button>
                </div>
                {logsCmd?.output && (
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-80 whitespace-pre-wrap">{logsCmd.output}</pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2"><Layers className="w-4 h-4" /> الصور ({images.length})</CardTitle>
                <div className="flex gap-2 items-center">
                  <StatusBadge cmd={imagesCmd} />
                  <Button size="sm" variant="outline" onClick={() => run("docker_images")}><RefreshCw className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="nginx:alpine" value={newC.image} onChange={(e) => setNewC({ ...newC, image: e.target.value })} className="max-w-xs" />
                  <Button variant="outline" onClick={() => run("docker_pull", { image: newC.image })} disabled={!newC.image}>
                    <Download className="w-4 h-4 ml-1" /> سحب الصورة
                  </Button>
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>المعرّف</TableHead><TableHead>المستودع</TableHead><TableHead>الوسم</TableHead><TableHead>الحجم</TableHead><TableHead>أُنشئت</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {images.map((im: any, i: number) => (
                      <TableRow key={`${im.id}-${i}`}>
                        <TableCell className="font-mono text-xs">{String(im.id).slice(0, 12)}</TableCell>
                        <TableCell>{im.repo}</TableCell>
                        <TableCell>{im.tag}</TableCell>
                        <TableCell>{im.size}</TableCell>
                        <TableCell className="text-xs">{im.created}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="infra" className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Network className="w-4 h-4" /> الشبكات</CardTitle>
                <Button size="sm" variant="outline" onClick={() => run("docker_networks")}><RefreshCw className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>المشغّل</TableHead><TableHead>النطاق</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {networks.map((n: any) => (
                      <TableRow key={n.id}><TableCell>{n.name}</TableCell><TableCell>{n.driver}</TableCell><TableCell>{n.scope}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><HardDrive className="w-4 h-4" /> المجلدات</CardTitle>
                <Button size="sm" variant="outline" onClick={() => run("docker_volumes")}><RefreshCw className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>المسار</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {volumes.map((v: any) => (
                      <TableRow key={v.name}><TableCell className="text-xs">{v.name}</TableCell><TableCell className="text-xs">{v.mount}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compose">
            <Card>
              <CardHeader><CardTitle>ملف Compose</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={composePath} onChange={(e) => setComposePath(e.target.value)} />
                  <Button variant="outline" onClick={() => run("docker_compose_read", { path: composePath })}>قراءة</Button>
                  {composeCmd?.output && (
                    <Button variant="ghost" onClick={() => setComposeBody(composeCmd.output ?? "")}>تحميل المحتوى للمحرّر</Button>
                  )}
                </div>
                <Textarea rows={16} className="font-mono text-xs" value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="services: ..." />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => run("docker_compose_write", { path: composePath, content: composeBody }, { dryRun: true })}>معاينة آمنة</Button>
                  <Button onClick={() => run("docker_compose_write", { path: composePath, content: composeBody }, { confirm: "حفظ الملف؟ سيُتحقق منه ويُرجع تلقائياً عند الخطأ." })}>حفظ مع تحقق</Button>
                  <Button variant="secondary" onClick={() => run("docker_compose_up", { path: composePath })}>تشغيل (up -d)</Button>
                  <Button variant="destructive" onClick={() => run("docker_compose_down", { path: composePath }, { confirm: "إيقاف كل خدمات هذا الملف؟" })}>إيقاف (down)</Button>
                </div>
                {composeCmd?.output && (
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-72 whitespace-pre-wrap">{composeCmd.output}</pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> إنشاء حاوية جديدة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label>الاسم</Label><Input value={newC.name} onChange={(e) => setNewC({ ...newC, name: e.target.value })} placeholder="my-app" /></div>
                  <div><Label>الصورة</Label><Input value={newC.image} onChange={(e) => setNewC({ ...newC, image: e.target.value })} placeholder="nginx:alpine" /></div>
                  <div><Label>المنافذ (سطر لكل منفذ)</Label><Textarea rows={3} value={newC.ports} onChange={(e) => setNewC({ ...newC, ports: e.target.value })} placeholder="8080:80" /></div>
                  <div><Label>المجلدات</Label><Textarea rows={3} value={newC.volumes} onChange={(e) => setNewC({ ...newC, volumes: e.target.value })} placeholder="/srv/data:/data" /></div>
                  <div className="md:col-span-2"><Label>متغيرات البيئة (KEY=VALUE)</Label><Textarea rows={3} value={newC.env} onChange={(e) => setNewC({ ...newC, env: e.target.value })} /></div>
                  <div><Label>سياسة إعادة التشغيل</Label>
                    <Select value={newC.restart} onValueChange={(v) => setNewC({ ...newC, restart: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unless-stopped">unless-stopped</SelectItem>
                        <SelectItem value="always">always</SelectItem>
                        <SelectItem value="on-failure">on-failure</SelectItem>
                        <SelectItem value="no">no</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => run("docker_create", {
                    name: newC.name, image: newC.image, restart: newC.restart,
                    ports: newC.ports.split("\n").filter(Boolean),
                    volumes: newC.volumes.split("\n").filter(Boolean),
                    env: parseEnv(newC.env),
                  }, { dryRun: true })}>معاينة آمنة</Button>
                  <Button disabled={!newC.image} onClick={() => run("docker_create", {
                    name: newC.name, image: newC.image, restart: newC.restart,
                    ports: newC.ports.split("\n").filter(Boolean),
                    volumes: newC.volumes.split("\n").filter(Boolean),
                    env: parseEnv(newC.env),
                  }, { confirm: "إنشاء الحاوية وتشغيلها؟" })}>إنشاء وتشغيل</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domain">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-4 h-4" /> ربط منفذ حاوية بنطاق</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>النطاق</Label><Input value={bind.domain} onChange={(e) => setBind({ ...bind, domain: e.target.value })} placeholder="app.example.com" /></div>
                  <div><Label>المنفذ الداخلي</Label><Input value={bind.port} onChange={(e) => setBind({ ...bind, port: e.target.value })} placeholder="8080" /></div>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      disabled={!bind.domain || !bind.port}
                      onClick={async () => {
                        try {
                          await bindDomain({ data: { serverId: activeServer, domain: bind.domain, port: Number(bind.port), ssl: bind.ssl } });
                          toast.success("أُرسل إعداد التوجيه وإصدار الشهادة إلى الوكيل");
                          qc.invalidateQueries({ queryKey: ["docker-commands", activeServer] });
                        } catch (e: any) { toast.error(e?.message ?? "تعذّر الربط"); }
                      }}
                    >اربط النطاق وأصدر شهادة</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  يُنشئ إعداد توجيه في Nginx يوجّه النطاق إلى المنفذ، ثم يطلب شهادة SSL تلقائياً — بعملية واحدة.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle>آخر الأوامر</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>الأمر</TableHead><TableHead>الحالة</TableHead><TableHead>الخروج</TableHead><TableHead>الوقت</TableHead><TableHead>النتيجة</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {cmds.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.action}{c.dry_run ? " (معاينة)" : ""}</TableCell>
                        <TableCell><Badge variant={c.status === "failed" ? "destructive" : "outline"}>{c.status}</Badge></TableCell>
                        <TableCell>{c.exit_code ?? "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleString("ar")}</TableCell>
                        <TableCell className="text-xs max-w-md truncate">{c.output ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
