import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Brain, Loader2, Trash2, Star, Search, Cloud, Laptop, Server, MessageSquare, Zap, History, Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAiProviders, setModelActive, setDefaultModel, deleteAiModel,
  listRouting, setRouting, testAiModel, recordModelTest, saveModelTestSettings,
} from "@/lib/ai-hub.functions";

export const Route = createFileRoute("/_authenticated/ai-models")({
  component: AiModelsPage,
  head: () => ({
    meta: [
      { title: "تفعيل نماذج الذكاء الاصطناعي — TVCC" },
      { name: "description", content: "فعّل النماذج السحابية والمحلية ونماذج السيرفرات، اختبرها بمدخل مخصص، وحدّد النموذج الافتراضي لكل مهمة." },
      { property: "og:title", content: "تفعيل نماذج الذكاء الاصطناعي — TVCC" },
      { property: "og:description", content: "اختبر النماذج بمدخل وإعدادات مخصصة وحدّد الافتراضي لكل مهمة." },
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

const DEFAULT_PROMPT = "قل: مرحباً من TVCC. بجملة واحدة فقط.";
const kindIcon = (k: string) => (k === "local" ? Laptop : k === "server" ? Server : Cloud);

type TestResult = {
  ok: boolean;
  latency: number;
  text: string;
  tokens?: number | null;
};

function AiModelsPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAiProviders);
  const fetchRouting = useServerFn(listRouting);
  const toggle = useServerFn(setModelActive);
  const makeDefault = useServerFn(setDefaultModel);
  const removeModel = useServerFn(deleteAiModel);
  const saveRouting = useServerFn(setRouting);
  const runTest = useServerFn(testAiModel);
  const saveTest = useServerFn(recordModelTest);
  const saveSettings = useServerFn(saveModelTestSettings);

  const [q, setQ] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const [testModelRow, setTestModelRow] = useState<any | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [topP, setTopP] = useState(1);

  const { data, isLoading } = useQuery({ queryKey: ["ai-hub"], queryFn: () => fetchAll() });
  const { data: routing } = useQuery({ queryKey: ["ai-routing"], queryFn: () => fetchRouting() });

  const providers = ((data as any)?.providers ?? []) as any[];
  const models = ((data as any)?.models ?? []) as any[];
  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? "—";

  const openTest = (m: any) => {
    const saved = m.metadata?.test ?? {};
    setPrompt(saved.prompt ?? DEFAULT_PROMPT);
    setTemperature(saved.temperature ?? 0.7);
    setMaxTokens(saved.max_tokens ?? 256);
    setTopP(saved.top_p ?? 1);
    setTestModelRow(m);
  };

  const isLocal = (m: any, p: any) => {
    const url = String(m.endpoint_url ?? p?.base_url ?? "");
    return m.kind === "local" || /localhost|127\.0\.0\.1/.test(url);
  };

  const runModelTest = async (m: any) => {
    const provider = providers.find((p) => p.id === m.provider_id);
    const params = { temperature, max_tokens: maxTokens, top_p: topP };
    setTesting(m.id);
    try {
      if (isLocal(m, provider)) {
        // Local models live on the user's machine — the browser talks to them directly.
        const base = String(m.endpoint_url ?? provider?.base_url ?? "").replace(/\/+$/, "");
        if (!base) throw new Error("لا يوجد عنوان للنموذج المحلي");
        const started = Date.now();
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: m.model_id,
            messages: [{ role: "user", content: prompt }],
            ...params,
          }),
        });
        if (!res.ok) throw new Error(`(${res.status}) ${(await res.text()).slice(0, 200)}`);
        const json: any = await res.json();
        const latency = Date.now() - started;
        const text = String(json?.choices?.[0]?.message?.content ?? "");
        const usage = json?.usage ?? null;
        setResults((r) => ({ ...r, [m.id]: { ok: true, latency, text: text.slice(0, 2000), tokens: usage?.total_tokens ?? null } }));
        await saveTest({ data: { id: m.id, ok: true, latency, prompt, answer: text, params, usage } });
        toast.success(`نجح الاختبار في ${latency}ms`);
      } else {
        const r: any = await runTest({ data: { id: m.id, prompt, params } });
        setResults((rs) => ({
          ...rs,
          [m.id]: { ok: r.ok, latency: r.latency, text: r.ok ? r.answer : r.error, tokens: r.usage?.total_tokens ?? null },
        }));
        if (r.ok) toast.success(`نجح الاختبار في ${r.latency}ms`);
        else toast.error(r.error);
      }
      qc.invalidateQueries({ queryKey: ["ai-hub"] });
      qc.invalidateQueries({ queryKey: ["ai-tests"] });
    } catch (e) {
      const msg = (e as Error).message;
      setResults((r) => ({ ...r, [m.id]: { ok: false, latency: 0, text: msg } }));
      await saveTest({ data: { id: m.id, ok: false, latency: 0, prompt, error: msg, params } }).catch(() => {});
      toast.error(msg);
    } finally {
      setTesting(null);
    }
  };

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
          <p className="text-sm text-muted-foreground mt-1">فعّل النماذج، اختبرها بمدخل وإعدادات مخصصة، ووزّع المهام عليها.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to="/ai-tests"><History className="w-4 h-4 ml-1" /> سجل الاختبارات</Link></Button>
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
            const res = results[m.id];
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
                      <Button size="sm" variant="secondary" disabled={testing === m.id} onClick={() => openTest(m)}>
                        {testing === m.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><Zap className="w-3 h-3 ml-1" /> اختبار</>}
                      </Button>
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

                  {res && (
                    <div className={`rounded-md border p-2 text-xs space-y-1 ${res.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
                      <div className="flex items-center justify-between font-medium">
                        <span>{res.ok ? "نجح الاختبار" : "فشل الاختبار"}</span>
                        <span>{res.latency > 0 ? `${res.latency}ms` : ""}{res.tokens ? ` · ${res.tokens} توكن` : ""}</span>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap break-words line-clamp-4">{res.text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!testModelRow} onOpenChange={(v) => !v && setTestModelRow(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> اختبار: {testModelRow?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>المدخل (Prompt)</Label>
              <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Temperature</span><span>{temperature.toFixed(2)}</span></div>
                <Slider value={[temperature]} min={0} max={2} step={0.05} onValueChange={(v) => setTemperature(v[0] ?? 0)} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Top P</span><span>{topP.toFixed(2)}</span></div>
                <Slider value={[topP]} min={0} max={1} step={0.05} onValueChange={(v) => setTopP(v[0] ?? 1)} />
              </div>
              <div>
                <Label className="text-xs">Max tokens</Label>
                <Input
                  type="number"
                  min={1}
                  max={8192}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>

            {testModelRow && results[testModelRow.id] && (
              <div className={`rounded-md border p-3 text-xs space-y-1 ${results[testModelRow.id]!.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
                <div className="flex justify-between font-medium">
                  <span>{results[testModelRow.id]!.ok ? "نجح الاختبار" : "فشل الاختبار"}</span>
                  <span>
                    {results[testModelRow.id]!.latency}ms
                    {results[testModelRow.id]!.tokens ? ` · ${results[testModelRow.id]!.tokens} توكن` : ""}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words">{results[testModelRow.id]!.text}</p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                className="flex-1"
                disabled={testing === testModelRow?.id}
                onClick={() => testModelRow && runModelTest(testModelRow)}
              >
                {testing === testModelRow?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 ml-1" /> تشغيل الاختبار</>}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!testModelRow) return;
                  await saveSettings({
                    data: { id: testModelRow.id, prompt, params: { temperature, max_tokens: maxTokens, top_p: topP } },
                  });
                  qc.invalidateQueries({ queryKey: ["ai-hub"] });
                  toast.success("تم حفظ إعدادات هذا النموذج");
                }}
              >
                <Save className="w-4 h-4 ml-1" /> حفظ الإعدادات
              </Button>
              <Button variant="ghost" asChild><Link to="/ai-tests">السجل</Link></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
