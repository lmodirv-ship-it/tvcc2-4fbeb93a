import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Share2, Server, Globe, Plug, Database, HardDrive, RefreshCw, Loader2,
  ArrowLeftRight, AlertTriangle, CheckCircle2, Activity,
} from "lucide-react";
import { getTopology } from "@/lib/topology.functions";

export const Route = createFileRoute("/_authenticated/topology")({
  component: TopologyPage,
  head: () => ({
    meta: [
      { title: "خريطة العلاقات — TVCC" },
      { name: "description", content: "خريطة موحّدة تربط السيرفرات بالمواقع والمنافذ وقواعد البيانات والتخزين وعمليات إعادة التوجيه، مع صحة الوكيل لكل سيرفر." },
      { property: "og:title", content: "خريطة العلاقات — TVCC" },
      { property: "og:description", content: "سيرفر ↔ موقع ↔ منفذ ↔ قاعدة ↔ تخزين في لوحة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ago(ms: number | null) {
  if (ms == null) return "لم يتصل بعد";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `قبل ${s} ثانية`;
  const m = Math.floor(s / 60);
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 48) return `قبل ${h} ساعة`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopologyPage() {
  const fetchTopology = useServerFn(getTopology);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["topology"],
    queryFn: () => fetchTopology(),
    refetchInterval: 20000,
  });

  const t = data?.totals;

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Share2 className="h-6 w-6 text-primary" />
            خريطة العلاقات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            سيرفر ↔ موقع ↔ منفذ ↔ قاعدة ↔ تخزين ↔ إعادة توجيه — عرض حيّ يتحدّث كل 20 ثانية.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="mr-2">تحديث</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل الخريطة…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Stat icon={Server} label="سيرفرات" value={t?.servers ?? 0} />
            <Stat icon={Globe} label="مواقع" value={t?.websites ?? 0} />
            <Stat icon={Plug} label="منافذ" value={t?.ports ?? 0} />
            <Stat icon={Database} label="قواعد مرتبطة" value={t?.databases ?? 0} />
            <Stat icon={HardDrive} label="تخزين" value={t?.storages ?? 0} />
            <Stat icon={Activity} label="وكلاء نشطون" value={`${t?.healthyAgents ?? 0}/${t?.servers ?? 0}`} />
          </div>

          <Tabs defaultValue="map" dir="rtl">
            <TabsList>
              <TabsTrigger value="map">الخريطة</TabsTrigger>
              <TabsTrigger value="agents">صحة الوكلاء</TabsTrigger>
              <TabsTrigger value="links">الروابط</TabsTrigger>
              <TabsTrigger value="orphans">مواقع بلا سيرفر ({t?.orphanSites ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4 pt-4">
              {(data?.nodes ?? []).length === 0 && (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">لا توجد سيرفرات مسجّلة بعد. أضف سيرفراً من صفحة السيرفرات.</CardContent></Card>
              )}
              {(data?.nodes ?? []).map((n: any) => (
                <Card key={n.id} className="overflow-hidden border-border/60">
                  <CardContent className="p-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 p-4">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-semibold">{n.name}</div>
                          <div className="text-xs text-muted-foreground">{n.ip ?? n.hostname ?? "—"} · {n.provider ?? "غير محدد"}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {n.metrics && (
                          <span className="text-xs text-muted-foreground">
                            CPU {Math.round(n.metrics.cpu_usage ?? 0)}% · RAM {Math.round(n.metrics.memory_usage ?? 0)}%
                          </span>
                        )}
                        <Badge variant={n.status === "online" ? "default" : "secondary"}>{n.status}</Badge>
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Globe className="h-4 w-4" /> المواقع ({n.sites.length})</div>
                        <div className="space-y-1.5">
                          {n.sites.length === 0 && <div className="text-xs text-muted-foreground">لا توجد مواقع مرتبطة.</div>}
                          {n.sites.map((s: any) => (
                            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm">
                              <span className="font-medium">{s.domain ?? s.name}</span>
                              <Badge variant="outline" className="text-[10px]">{s.status ?? "—"}</Badge>
                              {s.runtime && <Badge variant="secondary" className="text-[10px]">runtime</Badge>}
                              {s.databases > 0 && <Badge variant="secondary" className="text-[10px]"><Database className="ml-1 h-3 w-3" />{s.databases}</Badge>}
                              {s.storages > 0 && <Badge variant="secondary" className="text-[10px]"><HardDrive className="ml-1 h-3 w-3" />{s.storages}</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Plug className="h-4 w-4" /> المنافذ ({n.ports.length})</div>
                        <div className="flex flex-wrap gap-1.5">
                          {n.ports.length === 0 && <div className="text-xs text-muted-foreground">لا توجد منافذ مسجّلة.</div>}
                          {n.ports.map((p: any) => (
                            <Badge key={p.id} variant="outline" className="font-mono text-[11px]">
                              {p.port}{p.service_name ? ` · ${p.service_name}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="agents" className="pt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60">
                    {(data?.nodes ?? []).map((n: any) => (
                      <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                          {n.agent_healthy
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                          <div>
                            <div className="font-medium">{n.name}</div>
                            <div className="text-xs text-muted-foreground">
                              آخر نبضة: {ago(n.heartbeat_age_ms)} · نسخة الوكيل: {n.agent_version ?? "غير معروفة"}
                            </div>
                          </div>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/servers">فتح السيرفر</Link>
                        </Button>
                      </div>
                    ))}
                    {(data?.nodes ?? []).length === 0 && (
                      <div className="p-6 text-sm text-muted-foreground">لا توجد سيرفرات.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="links" className="space-y-4 pt-4">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><ArrowLeftRight className="h-4 w-4" /> جسور المنافذ ({data?.links.portLinks.length ?? 0})</div>
                  {(data?.links.portLinks ?? []).map((l: any) => (
                    <div key={l.id} className="rounded-md border border-border/50 px-3 py-2 font-mono text-xs">
                      {l.source_port ?? l.from_port} → {l.target_host ?? ""}:{l.target_port ?? l.to_port} <span className="text-muted-foreground">({l.status ?? "—"})</span>
                    </div>
                  ))}
                  {(data?.links.portLinks ?? []).length === 0 && <div className="text-xs text-muted-foreground">لا توجد جسور.</div>}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium"><ArrowLeftRight className="h-4 w-4" /> إعادة التوجيه ({data?.links.redirects.length ?? 0})</div>
                  {(data?.links.redirects ?? []).map((r: any) => (
                    <div key={r.id} className="rounded-md border border-border/50 px-3 py-2 font-mono text-xs">
                      {r.source ?? r.from_value} → {r.target ?? r.to_value} <span className="text-muted-foreground">({r.mode ?? r.kind ?? "—"})</span>
                    </div>
                  ))}
                  {(data?.links.redirects ?? []).length === 0 && <div className="text-xs text-muted-foreground">لا توجد عمليات توجيه.</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orphans" className="pt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 text-sm text-muted-foreground">
                    مواقع غير مرتبطة بأي سيرفر — اربطها من صفحة السيرفرات للاستفادة من التشغيل والمزامنة.
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(data?.orphanSites ?? []).map((s: any) => (
                      <Badge key={s.id} variant="outline" className="text-[11px]">{s.domain ?? s.name}</Badge>
                    ))}
                    {(data?.orphanSites ?? []).length === 0 && <div className="text-xs text-muted-foreground">كل المواقع مرتبطة ✓</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
