import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Search, Play, Square, Download, Trash2, Activity, Globe, Loader2, Plug } from "lucide-react";
import {
  getPortsHub, discoverAiPorts, controlLocalModel, bindModelToPort, publishModelOnDomain,
} from "@/lib/ports.functions";

export function ServerModelsPanel({ servers }: { servers: any[] }) {
  const qc = useQueryClient();
  const hub = useServerFn(getPortsHub);
  const discover = useServerFn(discoverAiPorts);
  const control = useServerFn(controlLocalModel);
  const bind = useServerFn(bindModelToPort);
  const publish = useServerFn(publishModelOnDomain);

  const [serverId, setServerId] = useState<string>(servers[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [pullName, setPullName] = useState("");
  const [domain, setDomain] = useState("");
  const [pubPort, setPubPort] = useState("11434");

  const { data, refetch } = useQuery({
    queryKey: ["ports-hub", serverId],
    queryFn: () => hub({ data: { serverId } }),
    enabled: !!serverId,
  });

  const ports = ((data as any)?.ports ?? []) as any[];
  const models = ((data as any)?.models ?? []) as any[];
  const aiPorts = ports.filter((p) => [11434, 1234, 8000, 8080].includes(p.port) || p.service_kind === "ai");

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      refetch();
      qc.invalidateQueries({ queryKey: ["ai-hub"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!servers.length) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> تشغيل النماذج المحلية على السيرفر</div>
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
            <SelectContent>
              {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!serverId || busy === "scan"}
            onClick={() => run("scan", () => discover({ data: { serverId } }), "تم فحص منافذ النماذج — النتائج تصل مع نبضة الوكيل")}>
            {busy === "scan" ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Search className="w-3 h-3 ml-1" /> فحص نماذج السيرفر</>}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!serverId || busy === "start"}
            onClick={() => run("start", () => control({ data: { serverId, op: "start", port: 11434 } }), "تم جدولة تشغيل Ollama")}>
            <Play className="w-3 h-3 ml-1" /> تشغيل
          </Button>
          <Button size="sm" variant="outline" disabled={!serverId || busy === "stop"}
            onClick={() => run("stop", () => control({ data: { serverId, op: "stop" } }), "تم جدولة إيقاف Ollama")}>
            <Square className="w-3 h-3 ml-1" /> إيقاف
          </Button>
          <Button size="sm" variant="outline" disabled={!serverId || busy === "ps"}
            onClick={() => run("ps", () => control({ data: { serverId, op: "ps" } }), "تم طلب حالة النماذج")}>
            <Activity className="w-3 h-3 ml-1" /> الحالة
          </Button>
          <Input dir="ltr" placeholder="llama3.1:8b" value={pullName} onChange={(e) => setPullName(e.target.value)} className="h-8 w-44 text-xs" />
          <Button size="sm" variant="outline" disabled={!serverId || !pullName || busy === "pull"}
            onClick={() => run("pull", () => control({ data: { serverId, op: "pull", model: pullName } }), "تم جدولة تنزيل النموذج")}>
            <Download className="w-3 h-3 ml-1" /> تنزيل
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={!serverId || !pullName || busy === "rm"}
            onClick={() => run("rm", () => control({ data: { serverId, op: "remove", model: pullName } }), "تم جدولة حذف النموذج")}>
            <Trash2 className="w-3 h-3 ml-1" /> حذف
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">منافذ النماذج المرصودة: {aiPorts.length ? aiPorts.map((p) => p.port).join("، ") : "لا شيء بعد"}</p>
          {models.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد نماذج مسجّلة على هذا السيرفر بعد.</p>
          ) : models.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span className="font-medium">{m.name}</span>
              <span dir="ltr" className="text-muted-foreground">{m.model_id}</span>
              {m.port ? <Badge variant="outline" dir="ltr">:{m.port}</Badge> : null}
              <div className="ms-auto flex items-center gap-1">
                <Select
                  value={m.port ? String(m.port) : ""}
                  onValueChange={(v) => {
                    const p = aiPorts.find((x) => String(x.port) === v);
                    run(`bind-${m.id}`, () => bind({ data: { modelId: m.id, portRowId: p?.id ?? null, port: Number(v) } }), "تم ربط النموذج بالمنفذ");
                  }}
                >
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="ربط بمنفذ" /></SelectTrigger>
                  <SelectContent>
                    {aiPorts.map((p) => <SelectItem key={p.id} value={String(p.port)}>{p.port}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Plug className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded border p-3 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1"><Globe className="w-3 h-3" /> نشر النموذج على نطاق (ai.النطاق)</p>
          <div className="flex flex-wrap gap-2">
            <Input dir="ltr" placeholder="11434" value={pubPort} onChange={(e) => setPubPort(e.target.value)} className="h-8 w-24 text-xs" />
            <Input dir="ltr" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="h-8 w-56 text-xs" />
            <Button size="sm" disabled={!serverId || !domain || busy === "pub"}
              onClick={() => run("pub", () => publish({ data: { serverId, port: Number(pubPort), domain } }), "تم جدولة النشر وطلب الشهادة")}>
              نشر
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
