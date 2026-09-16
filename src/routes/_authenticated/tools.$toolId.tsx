import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Copy, ExternalLink, Play, RefreshCw, Square, Trash2, Wrench } from "lucide-react";
import { getTool, runToolAction, refreshToolInstalls } from "@/lib/tools.functions";

export const Route = createFileRoute("/_authenticated/tools/$toolId")({
  head: ({ params }) => ({
    meta: [
      { title: `أداة ${params.toolId} — TVCC` },
      { name: "description", content: "صفحة الأداة: التعريف، الصفحات المرتبطة، حالة التثبيت على السيرفرات، والتشغيل المباشر." },
      { property: "og:title", content: `أداة ${params.toolId} — TVCC` },
      { property: "og:description", content: "تشغيل وإيقاف وتثبيت الأداة على سيرفرات المنصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolDetail,
});

const OPS = [
  { op: "status", label: "فحص", icon: RefreshCw },
  { op: "start", label: "تشغيل", icon: Play },
  { op: "stop", label: "إيقاف", icon: Square },
  { op: "install", label: "تثبيت", icon: Wrench },
  { op: "uninstall", label: "إزالة", icon: Trash2 },
] as const;

function ToolDetail() {
  const { toolId } = Route.useParams();
  const qc = useQueryClient();
  const fetchTool = useServerFn(getTool);
  const run = useServerFn(runToolAction);
  const refresh = useServerFn(refreshToolInstalls);
  const [serverId, setServerId] = useState("");

  const query = useQuery({
    queryKey: ["tool", toolId],
    queryFn: () => fetchTool({ data: { slug: toolId } }),
    refetchInterval: 10_000,
  });

  const action = useMutation({
    mutationFn: (op: (typeof OPS)[number]["op"]) => {
      if (!serverId) throw new Error("اختر سيرفراً أولاً");
      return run({ data: { toolId: query.data!.tool.id, serverId, op } });
    },
    onSuccess: (res: any) => {
      toast.success("أُرسل الأمر إلى الوكيل — سينفَّذ مباشرة، ويُثبِّت الأداة تلقائياً إن لزم");
      if (res?.terminalCommand) navigator.clipboard?.writeText(res.terminalCommand).catch(() => {});
      qc.invalidateQueries({ queryKey: ["tool", toolId] });
    },
    onError: (e: any) => toast.error(e?.message || "فشل التنفيذ"),
  });

  if (query.isLoading || !query.data) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const { tool, pages, installs, links, servers, commands } = query.data as any;
  const terminal = tool.install_cmd ? `sudo ${tool.install_cmd}` : "—";
  const mainPage = pages[0];
  const uiUrl = (i: any) => {
    if (i.access_url) return i.access_url;
    const s = servers.find((x: any) => x.id === i.server_id);
    const port = i.port ?? tool.default_port;
    return s?.ip_address && port ? `http://${s.ip_address}:${port}` : null;
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/tools" className="text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" /></Link>
        <h1 className="text-lg font-semibold">{tool.name}</h1>
        <Badge variant="outline" className="font-mono">{tool.code}</Badge>
        <Badge variant="secondary">{tool.category}</Badge>
        {tool.license && <Badge variant="outline">{tool.license}</Badge>}
        {tool.website && (
          <a href={tool.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">الموقع الرسمي</a>
        )}
        <div className="ms-auto flex items-center gap-2">
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger className="h-8 w-56"><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
            <SelectContent>
              {servers.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name || s.hostname || s.ip_address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {OPS.map(({ op, label, icon: Icon }) => (
            <Button key={op} size="sm" variant={op === "uninstall" ? "destructive" : op === "start" ? "default" : "outline"}
              disabled={!serverId || action.isPending} onClick={() => action.mutate(op)}>
              <Icon className="me-1 h-4 w-4" /> {label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={async () => {
            await refresh({ data: { toolId: tool.id } });
            qc.invalidateQueries({ queryKey: ["tool", toolId] });
          }}>تحديث الحالة</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="py-3"><CardTitle className="text-sm">التعريف التقني</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            <p className="text-sm text-muted-foreground">{tool.role_desc}</p>
            <Row k="التقنيات" v={tool.tech} />
            <Row k="المنفذ/الواجهة" v={[tool.default_port, tool.interface].filter(Boolean).join(" · ")} />
            <Row k="الحزم" v={tool.packages} />
            <Row k="الخدمات" v={tool.services} />
            <Row k="المسارات" v={tool.paths} />
            <Row k="أقسام الواجهة" v={tool.ui_sections} />
            <Row k="صورة Docker" v={tool.docker_image} />
            <Row k="ملاحظات" v={tool.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">الطرفية</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px]">{terminal}</pre>
            <Button size="sm" variant="outline" className="w-full" disabled={terminal === "—"}
              onClick={() => { navigator.clipboard?.writeText(terminal); toast.success("نُسخ الأمر"); }}>
              <Copy className="me-1 h-4 w-4" /> نسخ أمر التثبيت
            </Button>
            <div className="text-[11px] text-muted-foreground">
              إن كانت الأداة مثبتة يُنفَّذ الأمر مباشرة؛ وإن لم تكن، يثبّتها الوكيل تلقائياً أو تُثبَّت من الطرفية بهذا الأمر.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">الصفحات المرتبطة</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {pages.length ? pages.map((p: any) => (
              <a key={p.id} href={p.page_path}><Badge variant="outline">{p.page_label ?? p.page_path}</Badge></a>
            )) : <span className="text-xs text-muted-foreground">لا صفحات</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">أدوات مرتبطة</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {links.length ? links.map((l: any) => (
              <Link key={l.id} to="/tools/$toolId" params={{ toolId: l.related?.slug ?? "" }}>
                <Badge variant="secondary">{l.related?.name}{l.relation ? ` · ${l.relation}` : ""}</Badge>
              </Link>
            )) : <span className="text-xs text-muted-foreground">لا علاقات</span>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">حالة التثبيت على السيرفرات</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">السيرفر</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="text-start">آخر إجراء</TableHead>
                <TableHead className="text-start">آخر فحص</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installs.map((i: any) => {
                const s = servers.find((x: any) => x.id === i.server_id);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">{s?.name || s?.hostname || i.server_id}</TableCell>
                    <TableCell>
                      <Badge variant={i.installed ? "default" : i.status === "error" ? "destructive" : "secondary"}>
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{i.last_action ?? "—"}</TableCell>
                    <TableCell className="text-xs">{i.last_checked_at ? new Date(i.last_checked_at).toLocaleString("ar") : "—"}</TableCell>
                  </TableRow>
                );
              })}
              {!installs.length && (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">لم تُشغَّل الأداة على أي سيرفر بعد</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">سجل الأوامر</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {commands.length ? commands.slice(0, 10).map((c: any) => (
            <div key={c.id} className="rounded border p-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant={c.status === "done" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>{c.status}</Badge>
                <span>{c.args?.op}</span>
                <span className="ms-auto text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</span>
              </div>
              {c.output && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px]">{c.output.slice(0, 2000)}</pre>}
            </div>
          )) : <span className="text-xs text-muted-foreground">لا أوامر</span>}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | number | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-2 border-b py-1 last:border-0">
      <span className="w-28 shrink-0 text-muted-foreground">{k}</span>
      <span className="font-mono text-[11px]">{v}</span>
    </div>
  );
}
