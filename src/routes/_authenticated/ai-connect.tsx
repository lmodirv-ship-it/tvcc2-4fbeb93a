import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Cloud, Laptop, Server, Plus, Loader2, Trash2, Zap, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  listAiProviders, upsertAiProvider, deleteAiProvider, testAiProvider,
  importProviderModels, importServerModels, enableGeminiProvider,
} from "@/lib/ai-hub.functions";

export const Route = createFileRoute("/_authenticated/ai-connect")({
  component: AiConnectPage,
  head: () => ({
    meta: [
      { title: "ربط نماذج الذكاء الاصطناعي — TVCC" },
      { name: "description", content: "اربط نماذج الذكاء الاصطناعي السحابية والمحلية ونماذج السيرفرات في مكان واحد داخل TVCC." },
      { property: "og:title", content: "ربط نماذج الذكاء الاصطناعي — TVCC" },
      { property: "og:description", content: "اربط النماذج السحابية والمحلية ونماذج السيرفرات في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KIND_META: Record<string, { label: string; icon: any; cls: string }> = {
  cloud: { label: "سحابي", icon: Cloud, cls: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  local: { label: "محلي (حاسوبك)", icon: Laptop, cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  server: { label: "على السيرفر", icon: Server, cls: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40" },
};

const VENDORS = [
  { value: "lovable", label: "Lovable AI (بدون مفتاح)", kind: "cloud" },
  { value: "openai", label: "OpenAI", kind: "cloud" },
  { value: "anthropic", label: "Anthropic", kind: "cloud" },
  { value: "google", label: "Google AI", kind: "cloud" },
  { value: "openrouter", label: "OpenRouter", kind: "cloud" },
  { value: "ollama", label: "Ollama", kind: "local" },
  { value: "lmstudio", label: "LM Studio", kind: "local" },
  { value: "vllm", label: "vLLM", kind: "server" },
];

function AiConnectPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAiProviders);
  const upsert = useServerFn(upsertAiProvider);
  const remove = useServerFn(deleteAiProvider);
  const test = useServerFn(testAiProvider);
  const importModels = useServerFn(importProviderModels);
  const importFromServer = useServerFn(importServerModels);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", kind: "cloud" as "cloud" | "local" | "server",
    vendor: "lovable", base_url: "", api_key: "", server_id: "",
  });

  const { data, isLoading } = useQuery({ queryKey: ["ai-hub"], queryFn: () => fetchAll() });
  const providers = ((data as any)?.providers ?? []) as any[];
  const models = ((data as any)?.models ?? []) as any[];
  const servers = ((data as any)?.servers ?? []) as any[];

  const save = async () => {
    try {
      await upsert({
        data: {
          name: form.name,
          kind: form.kind,
          vendor: form.vendor,
          base_url: form.base_url || null,
          api_key: form.api_key || null,
          server_id: form.server_id || null,
        },
      });
      toast.success("تم حفظ المزوّد");
      setOpen(false);
      setForm({ name: "", kind: "cloud", vendor: "lovable", base_url: "", api_key: "", server_id: "" });
      qc.invalidateQueries({ queryKey: ["ai-hub"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /** Local models run on the user's own machine — the browser talks to them directly. */
  const detectLocal = async () => {
    setBusy("local");
    const bases = ["http://127.0.0.1:11434", "http://localhost:1234"];
    for (const base of bases) {
      try {
        const isOllama = base.endsWith("11434");
        const res = await fetch(isOllama ? `${base}/api/tags` : `${base}/v1/models`, { signal: AbortSignal.timeout(2500) });
        if (!res.ok) continue;
        const json: any = await res.json();
        const found = isOllama
          ? (json.models ?? []).map((m: any) => ({ model_id: m.name, name: m.name, size_mb: m.size ? Math.round(m.size / 1048576) : null }))
          : (json.data ?? []).map((m: any) => ({ model_id: m.id, name: m.id }));
        if (!found.length) continue;

        const created: any = await upsert({
          data: {
            name: isOllama ? "Ollama (حاسوبي)" : "LM Studio (حاسوبي)",
            kind: "local",
            vendor: isOllama ? "ollama" : "lmstudio",
            base_url: base,
          },
        });
        const r: any = await importModels({ data: { providerId: created.id, models: found } });
        toast.success(`تم اكتشاف ${found.length} نموذج محلي، أضيف منها ${r.added}`);
        qc.invalidateQueries({ queryKey: ["ai-hub"] });
        setBusy(null);
        return;
      } catch { /* try next */ }
    }
    setBusy(null);
    toast.error("لم يُعثر على نماذج محلية. شغّل Ollama بـ OLLAMA_ORIGINS=* أو LM Studio ثم أعد المحاولة.");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Link2 className="w-6 h-6 text-primary" /> ربط نماذج الذكاء الاصطناعي</h1>
          <p className="text-sm text-muted-foreground mt-1">
            اربط المزوّدين السحابيين، والنماذج المحلية على حاسوبك، والنماذج المثبّتة على سيرفراتك.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={detectLocal} disabled={busy === "local"}>
            {busy === "local" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Laptop className="w-4 h-4 ml-1" /> اكتشاف نماذج حاسوبي</>}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> مزوّد جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة مزوّد</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>النوع</Label>
                  <Select value={form.kind} onValueChange={(v: any) => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloud">سحابي</SelectItem>
                      <SelectItem value="local">محلي (حاسوبك)</SelectItem>
                      <SelectItem value="server">على السيرفر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المورّد</Label>
                  <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VENDORS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.vendor !== "lovable" && (
                  <>
                    <div><Label>العنوان (Base URL)</Label><Input dir="ltr" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.openai.com" /></div>
                    <div><Label>مفتاح API</Label><Input dir="ltr" type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} /></div>
                  </>
                )}
                {form.kind === "server" && (
                  <div>
                    <Label>السيرفر</Label>
                    <Select value={form.server_id} onValueChange={(v) => setForm({ ...form, server_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر سيرفراً" /></SelectTrigger>
                      <SelectContent>
                        {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button className="w-full" disabled={!form.name} onClick={save}>حفظ</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {servers.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="font-semibold flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> نماذج مكتشفة على السيرفرات</div>
            <div className="flex flex-wrap gap-2">
              {servers.map((s) => {
                const found = (s.metadata?.ai_models ?? []).length;
                return (
                  <Button
                    key={s.id}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const r: any = await importFromServer({ data: { serverId: s.id } });
                        toast.success(r.message ?? `أضيف ${r.added} نموذج`);
                        qc.invalidateQueries({ queryKey: ["ai-hub"] });
                      } catch (e) { toast.error((e as Error).message); }
                    }}
                  >
                    <Download className="w-3 h-3 ml-1" /> {s.name} ({found})
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : providers.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">لا يوجد مزوّدون بعد — ابدأ بـ Lovable AI أو اكتشف نماذج حاسوبك.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => {
            const meta = KIND_META[p.kind] ?? KIND_META.cloud;
            const Icon = meta.icon;
            const count = models.filter((m) => m.provider_id === p.id).length;
            return (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {p.name}</div>
                      <div className="text-xs text-muted-foreground ltr text-left">{p.vendor}{p.base_url ? ` · ${p.base_url}` : ""}</div>
                    </div>
                    <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{count} نموذج</span>
                    <span>{p.status ?? "—"}{p.last_latency_ms ? ` · ${p.last_latency_ms}ms` : ""}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === p.id}
                      onClick={async () => {
                        setBusy(p.id);
                        try {
                          const r: any = await test({ data: { id: p.id } });
                          if (!r.ok) toast.error(r.error);
                          else {
                            const imp: any = await importModels({ data: { providerId: p.id, models: r.models } });
                            toast.success(`متصل (${r.latency}ms) · أضيف ${imp.added} نموذج`);
                          }
                          qc.invalidateQueries({ queryKey: ["ai-hub"] });
                        } catch (e) { toast.error((e as Error).message); }
                        setBusy(null);
                      }}
                    >
                      {busy === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 ml-1" /> اختبار واستيراد</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        await remove({ data: { id: p.id } });
                        qc.invalidateQueries({ queryKey: ["ai-hub"] });
                        toast.success("تم الحذف");
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
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
