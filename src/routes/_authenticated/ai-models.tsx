import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Brain, Loader2, Trash2, Star, Search, Cloud, Laptop, Server, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  listAiProviders, setModelActive, setDefaultModel, deleteAiModel,
  listRouting, setRouting,
} from "@/lib/ai-hub.functions";

export const Route = createFileRoute("/_authenticated/ai-models")({
  component: AiModelsPage,
  head: () => ({
    meta: [
      { title: "تفعيل نماذج الذكاء الاصطناعي — TVCC" },
      { name: "description", content: "فعّل النماذج السحابية والمحلية ونماذج السيرفرات وحدّد النموذج الافتراضي لكل مهمة في TVCC." },
      { property: "og:title", content: "تفعيل نماذج الذكاء الاصطناعي — TVCC" },
      { property: "og:description", content: "فعّل النماذج وحدّد الافتراضي لكل مهمة إدارة وتطوير المواقع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TASKS = [
  { key: "chat", label: "المحادثة العامة" },
  { key: "site_management", label: "إدارة المواقع" },
  { key: "content", label: "المحتوى و SEO" },
  { key: "code", label: "الكود والتطوير" },
];

const kindIcon = (k: string) => (k === "local" ? Laptop : k === "server" ? Server : Cloud);

function AiModelsPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAiProviders);
  const fetchRouting = useServerFn(listRouting);
  const toggle = useServerFn(setModelActive);
  const makeDefault = useServerFn(setDefaultModel);
  const removeModel = useServerFn(deleteAiModel);
  const saveRouting = useServerFn(setRouting);

  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["ai-hub"], queryFn: () => fetchAll() });
  const { data: routing } = useQuery({ queryKey: ["ai-routing"], queryFn: () => fetchRouting() });

  const providers = ((data as any)?.providers ?? []) as any[];
  const models = ((data as any)?.models ?? []) as any[];
  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? "—";

  const filtered = useMemo(
    () => models.filter((m) => !q || `${m.name} ${m.model_id}`.toLowerCase().includes(q.toLowerCase())),
    [models, q],
  );

  const routeFor = (task: string) =>
    ((routing as any[]) ?? []).find((r) => r.task === task)?.primary_model_id ?? "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> نماذج الذكاء الاصطناعي</h1>
          <p className="text-sm text-muted-foreground mt-1">فعّل النماذج، اختر الافتراضي، ووزّع المهام على النماذج المناسبة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/ai-connect">ربط مزوّد جديد</Link></Button>
          <Button asChild><Link to="/ai-chat"><MessageSquare className="w-4 h-4 ml-1" /> التواصل مع النماذج</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold">توزيع المهام</div>
          <div className="grid gap-3 md:grid-cols-2">
            {TASKS.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <span className="text-sm w-36 shrink-0">{t.label}</span>
                <Select
                  value={routeFor(t.key)}
                  onValueChange={async (v) => {
                    await saveRouting({ data: { task: t.key, primary_model_id: v } });
                    qc.invalidateQueries({ queryKey: ["ai-routing"] });
                    toast.success("تم الحفظ");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="اختر نموذجاً" /></SelectTrigger>
                  <SelectContent>
                    {models.filter((m) => m.is_active !== false).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في النماذج..." className="pr-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          لا توجد نماذج بعد — اذهب إلى <Link to="/ai-connect" className="text-primary underline">صفحة الربط</Link> لاستيرادها.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const Icon = kindIcon(m.kind);
            return (
              <Card key={m.id} className={m.is_default ? "border-primary/60" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2 truncate"><Icon className="w-4 h-4 text-primary shrink-0" /> {m.name}</div>
                      <div className="text-[11px] text-muted-foreground ltr text-left truncate">{m.model_id}</div>
                      <div className="text-[11px] text-muted-foreground">{providerName(m.provider_id)}</div>
                    </div>
                    {m.is_default && <Badge className="bg-primary/20 text-primary border-primary/40" variant="outline">افتراضي</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{m.size_mb ? `${Math.round(m.size_mb / 1024)}GB` : m.context_window ? `${m.context_window} توكن` : "—"}</span>
                    <span>{m.last_latency_ms ? `${m.last_latency_ms}ms` : ""}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={m.is_active !== false}
                        onCheckedChange={async (v) => {
                          await toggle({ data: { id: m.id, is_active: v } });
                          qc.invalidateQueries({ queryKey: ["ai-hub"] });
                        }}
                      />
                      <span className="text-xs">مفعّل</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await makeDefault({ data: { id: m.id } });
                          qc.invalidateQueries({ queryKey: ["ai-hub"] });
                          toast.success("أصبح النموذج الافتراضي");
                        }}
                      >
                        <Star className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          await removeModel({ data: { id: m.id } });
                          qc.invalidateQueries({ queryKey: ["ai-hub"] });
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
