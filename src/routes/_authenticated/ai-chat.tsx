import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, Loader2, Plus, Trash2, Wrench, Laptop } from "lucide-react";
import { toast } from "sonner";
import { EDIT_COMMAND_HINT, hasEditCommand } from "@/lib/ai-write-command";
import {
  listAiProviders, aiChat, listConversations, getConversation, deleteConversation,
  listAiToolSchemas, runAiTool,
} from "@/lib/ai-hub.functions";
import { WorkspacePanel } from "@/components/ai/WorkspacePanel";


export const Route = createFileRoute("/_authenticated/ai-chat")({
  component: AiChatPage,
  head: () => ({
    meta: [
      { title: "التواصل مع النماذج — TVCC" },
      { name: "description", content: "حاور نماذج الذكاء الاصطناعي مع أدوات إدارة المواقع والسيرفرات مباشرة من لوحة TVCC." },
      { property: "og:title", content: "التواصل مع النماذج — TVCC" },
      { property: "og:description", content: "حاور النماذج مع أدوات إدارة المواقع والسيرفرات مباشرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Msg = { role: string; content: string; model_label?: string | null; tool_calls?: any };

function AiChatPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAiProviders);
  const chat = useServerFn(aiChat);
  const convs = useServerFn(listConversations);
  const convMessages = useServerFn(getConversation);
  const removeConv = useServerFn(deleteConversation);
  const toolSchemas = useServerFn(listAiToolSchemas);
  const execTool = useServerFn(runAiTool);

  const [modelId, setModelId] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [localMsgs, setLocalMsgs] = useState<Msg[]>([]);
  const [serverId, setServerId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [activeTasks, setActiveTasks] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);


  const { data } = useQuery({ queryKey: ["ai-hub"], queryFn: () => fetchAll() });
  const models = (((data as any)?.models ?? []) as any[]).filter((m) => m.is_active !== false);
  const providers = ((data as any)?.providers ?? []) as any[];
  const current = models.find((m) => m.id === modelId);
  const currentProvider = providers.find((p) => p.id === current?.provider_id);
  const isLocal = current?.kind === "local";

  const { data: conversations } = useQuery({ queryKey: ["ai-convs"], queryFn: () => convs() });
  const { data: history } = useQuery({
    queryKey: ["ai-conv", conversationId],
    queryFn: () => convMessages({ data: { id: conversationId! } }),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!modelId && models.length) setModelId((models.find((m) => m.is_default) ?? models[0]).id);
  }, [models, modelId]);

  useEffect(() => {
    if (history) setLocalMsgs(history as Msg[]);
  }, [history]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMsgs, pending]);

  /** Local models live on the user's machine, so the browser calls them directly — with tools proxied through the server. */
  const sendLocal = async (text: string) => {
    const base = (current?.endpoint_url ?? currentProvider?.base_url ?? "").replace(/\/+$/, "");
    const { tools } = (await toolSchemas()) as any;
    const parsedTools = JSON.parse(tools);
    const convo: any[] = [
      { role: "system", content: systemPrompt() },
      ...localMsgs.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    const used: { name: string }[] = [];

    for (let step = 0; step < 8; step++) {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: current.model_id, messages: convo, tools: parsedTools, tool_choice: "auto" }),
      });
      if (!res.ok) throw new Error(`النموذج المحلي رفض الطلب (${res.status})`);
      const json: any = await res.json();
      const msg = json?.choices?.[0]?.message ?? {};
      const calls = msg.tool_calls ?? [];
      if (!calls.length) return { answer: msg.content ?? "", tools: used };
      convo.push(msg);
      for (const c of calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* ignore */ }
        used.push({ name: String(c.function?.name ?? "") });
        const r: any = await execTool({
          data: {
            name: String(c.function?.name ?? ""),
            args,
            allowWrites: hasEditCommand(text),
            serverId: serverId || null,
          },
        });
        convo.push({ role: "tool", tool_call_id: c.id, content: r.result });
      }
    }
    return { answer: "توقّفت بعد عدة خطوات دون إجابة نهائية.", tools: used };
  };

  const systemPrompt = () => {
    let p = "أنت مساعد TVCC لإدارة وتطوير المواقع والسيرفرات. أجب بالعربية بإيجاز. استخدم الأدوات لقراءة البيانات والملفات الحقيقية.";
    if (serverId) p += ` سيرفر ورشة العمل الحالي: ${serverId} (أدوات fs_* تعمل عليه).`;
    if (selectedFiles.length) p += ` الملفات المستهدفة: ${selectedFiles.join("، ")}.`;
    return p;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !modelId) return;
    const prefix = selectedFiles.length
      ? `الملفات المستهدفة على السيرفر:\n${selectedFiles.map((f) => `- ${f}`).join("\n")}\n\n`
      : "";
    setInput("");
    setLocalMsgs((m) => [...m, { role: "user", content: text }]);
    setPending(true);
    try {
      if (isLocal) {
        const r = await sendLocal(prefix + text);
        setLocalMsgs((m) => [...m, { role: "assistant", content: r.answer, model_label: current.name, tool_calls: r.tools }]);
      } else {
        const r: any = await chat({
          data: {
            modelId, conversationId, message: prefix + text,
            serverId: serverId || null,
            filePaths: selectedFiles,
            taskIds: activeTasks,
          },
        });
        setConversationId(r.conversationId);
        setLocalMsgs((m) => [...m, { role: "assistant", content: r.answer, tool_calls: r.tools }]);
        qc.invalidateQueries({ queryKey: ["ai-convs"] });
        qc.invalidateQueries({ queryKey: ["ai-tasks"] });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
    setPending(false);
  };


  return (
    <div className="p-6 grid gap-4 lg:grid-cols-[240px_1fr_320px] h-[calc(100vh-6rem)]">
      <Card className="hidden lg:block overflow-y-auto">
        <CardContent className="p-3 space-y-2">
          <Button
            size="sm"
            className="w-full"
            onClick={() => { setConversationId(null); setLocalMsgs([]); }}
          >
            <Plus className="w-3 h-3 ml-1" /> محادثة جديدة
          </Button>
          {((conversations as any[]) ?? []).map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-md p-2 text-xs cursor-pointer hover:bg-muted ${conversationId === c.id ? "bg-muted" : ""}`}
              onClick={() => setConversationId(c.id)}
            >
              <span className="flex-1 truncate">{c.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-destructive"
                onClick={async (e) => {
                  e.stopPropagation();
                  await removeConv({ data: { id: c.id } });
                  if (conversationId === c.id) { setConversationId(null); setLocalMsgs([]); }
                  qc.invalidateQueries({ queryKey: ["ai-convs"] });
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h1 className="text-xl font-bold flex items-center gap-2 ml-auto"><MessageSquare className="w-5 h-5 text-primary" /> التواصل مع النماذج</h1>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="اختر نموذجاً" /></SelectTrigger>
            <SelectContent>
              {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground max-w-xs leading-snug">{EDIT_COMMAND_HINT}</span>
        </div>

        {models.length === 0 && (
          <Card className="mb-3"><CardContent className="p-4 text-sm text-muted-foreground">
            لا توجد نماذج مفعّلة — <Link to="/ai-connect" className="text-primary underline">اربط مزوّداً</Link> أولاً.
          </CardContent></Card>
        )}
        {isLocal && (
          <div className="mb-3 text-xs text-muted-foreground flex items-center gap-1">
            <Laptop className="w-3 h-3" /> نموذج محلي: يعمل من متصفحك مع نفس أدوات إدارة المواقع والملفات.
          </div>
        )}


        <Card className="flex-1 min-h-0 overflow-y-auto">
          <CardContent className="p-4 space-y-3">
            {localMsgs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                اسأل عن حالة مواقعك أو سيرفراتك، مثال: «كم موقعاً غير متصل الآن؟»
              </p>
            )}
            {localMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`rounded-xl px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary/15" : "bg-muted"}`}>
                  {m.content}
                  {Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.tool_calls.map((t: any, j: number) => (
                        <Badge key={j} variant="outline" className="text-[10px]">
                          <Wrench className="w-2.5 h-2.5 ml-1" /> {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pending && <div className="flex justify-end"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}
            <div ref={bottom} />
          </CardContent>
        </Card>

        <div className="flex gap-2 mt-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اكتب رسالتك..."
            className="min-h-[52px] max-h-40"
          />
          <Button onClick={send} disabled={pending || !modelId}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="hidden lg:block min-h-0">
        <WorkspacePanel
          serverId={serverId}
          setServerId={setServerId}
          selected={selectedFiles}
          setSelected={setSelectedFiles}
          activeTasks={activeTasks}
          setActiveTasks={setActiveTasks}
        />
      </div>
    </div>
  );
}
