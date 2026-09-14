import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Boxes, Bot, Database, Globe, HardDrive, Link2, Loader2, Network, ShieldCheck, Server,
} from "lucide-react";
import { getEntityRelations } from "@/lib/federated.functions";

type Props = {
  serverId?: string | null;
  websiteId?: string | null;
  databaseId?: string | null;
  className?: string;
};

const REPAIR: Record<string, { label: string; to: string }> = {
  agent: { label: "تثبيت وكيل", to: "/downloads" },
  db: { label: "مركز قواعد البيانات", to: "/federated/db" },
  site_db: { label: "ربط قاعدة بيانات", to: "/federated/db" },
  site_nginx: { label: "إعداد التوجيه", to: "/federated/nginx" },
  backup: { label: "النسخ الاحتياطي", to: "/backups" },
  alerts: { label: "قواعد التنبيه", to: "/monitoring" },
};

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-secondary/30 px-3 py-2">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ms-auto text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function EntityRelations({ serverId, websiteId, databaseId, className }: Props) {
  const fn = useServerFn(getEntityRelations);
  const enabled = Boolean(serverId || websiteId || databaseId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["entity-relations", serverId ?? null, websiteId ?? null, databaseId ?? null],
    enabled,
    refetchInterval: 60_000,
    queryFn: () => fn({ data: { serverId: serverId ?? null, websiteId: websiteId ?? null, databaseId: databaseId ?? null } }),
  });

  if (!enabled) return null;

  const r = data as any;

  return (
    <Card className={className} dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> خريطة العلاقات
          {r?.server?.name && <Badge variant="outline" className="text-[10px]">{r.server.name}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-primary" /></div>
        ) : error ? (
          <p className="text-xs text-destructive">{(error as Error).message}</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              الموقع (S######) ← قاعدة البيانات ← السيرفر ← الوكلاء ← النطاقات/الشهادات ← الحاويات ← التوجيه ← النسخ ← التنبيهات
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Stat icon={Globe} label="المواقع" value={r?.sites?.length ?? 0} />
              <Stat icon={Database} label="قواعد البيانات" value={r?.databases?.length ?? 0} />
              <Stat icon={Bot} label="الوكلاء" value={r?.agents?.length ?? 0} />
              <Stat icon={Boxes} label="الحاويات" value={r?.containers?.length ?? 0} />
              <Stat icon={Network} label="إعدادات التوجيه" value={r?.nginx?.length ?? 0} />
              <Stat icon={ShieldCheck} label="النطاقات/الشهادات" value={(r?.domains?.length ?? 0) + (r?.certificates?.length ?? 0)} />
              <Stat icon={HardDrive} label="نسخ احتياطية حديثة" value={r?.backups?.length ?? 0} />
              <Stat icon={AlertTriangle} label="قواعد التنبيه" value={r?.alerts?.length ?? 0} />
              <Stat icon={Server} label="حالة السيرفر" value={r?.server?.status ?? "—"} />
            </div>

            {!!r?.agents?.length && (
              <div className="flex flex-wrap gap-1">
                {r.agents.map((a: any) => (
                  <Badge key={a.id} variant="outline" className="text-[10px]">
                    {a.agent_key ?? "main"} · {a.role ?? "main"}
                  </Badge>
                ))}
              </div>
            )}

            {!!r?.sites?.length && (
              <div className="flex flex-wrap gap-1">
                {r.sites.slice(0, 12).map((s: any) => (
                  <Badge key={s.id} className="text-[10px] bg-primary/10 text-primary">
                    {s.site_code ?? "—"} · {s.name}
                  </Badge>
                ))}
              </div>
            )}

            {!!r?.gaps?.length && (
              <div className="space-y-1">
                {r.gaps.map((g: any) => (
                  <div key={g.key} className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                    <span className="text-xs">{g.label}</span>
                    {REPAIR[g.key] && (
                      <Button asChild size="sm" variant="outline" className="ms-auto h-7 text-[11px]">
                        <Link to={REPAIR[g.key]!.to as any}>{REPAIR[g.key]!.label}</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
