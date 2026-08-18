import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_TOOLS, runTool } from "./ai-tools.server";
import { GATEWAY, DEFAULT_PROMPT, callModel, providerModels, type ChatMsg, type TestParams } from "./ai-hub.server";




/* ---------------- providers ---------------- */

export const listAiProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: providers }, { data: models }, { data: servers }] = await Promise.all([
      sb.from("ai_providers").select("*").order("created_at", { ascending: true }),
      sb.from("ai_models").select("*").order("priority", { ascending: false }),
      sb.from("servers").select("id, name, hostname, status, metadata"),
    ]);
    return {
      providers: (providers ?? []).map((p: any) => ({ ...p, api_key_encrypted: p.api_key_encrypted ? "***" : null })),
      models: models ?? [],
      servers: servers ?? [],
    };
  });

export const upsertAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string; name: string; kind: "cloud" | "local" | "server"; vendor: string;
    base_url?: string | null; api_key?: string | null; server_id?: string | null; is_active?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row: Record<string, unknown> = {
      owner_id: context.userId,
      name: data.name,
      kind: data.kind,
      vendor: data.vendor,
      base_url: data.base_url ?? null,
      server_id: data.server_id ?? null,
      is_active: data.is_active ?? true,
    };
    if (data.api_key) row.api_key_encrypted = data.api_key;

    if (data.id) {
      const { error } = await sb.from("ai_providers").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await sb.from("ai_providers").insert(row).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: created?.id };
  });

export const deleteAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("ai_providers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- discovery / testing ---------------- */


export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: p } = await sb.from("ai_providers").select("*").eq("id", data.id).maybeSingle();
    if (!p) throw new Error("المزوّد غير موجود");

    const started = Date.now();
    try {
      const key = p.vendor === "lovable" ? process.env["LOVABLE_API_KEY"] ?? null : p.api_key_encrypted;
      const models = await providerModels(p.kind, p.vendor, p.base_url, key);
      const latency = Date.now() - started;
      await sb
        .from("ai_providers")
        .update({ status: "online", last_checked_at: new Date().toISOString(), last_latency_ms: latency })
        .eq("id", p.id);
      return { ok: true, latency, models };
    } catch (e) {
      await sb
        .from("ai_providers")
        .update({ status: "error", last_checked_at: new Date().toISOString() })
        .eq("id", p.id);
      return { ok: false, error: e instanceof Error ? e.message : "فشل الاتصال", models: [] };
    }
  });

export const importProviderModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { providerId: string; models: Array<{ model_id: string; name?: string; size_mb?: number | null }> }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: p } = await sb.from("ai_providers").select("*").eq("id", data.providerId).maybeSingle();
    if (!p) throw new Error("المزوّد غير موجود");

    let added = 0;
    for (const m of data.models.slice(0, 200)) {
      const { data: existing } = await sb
        .from("ai_models")
        .select("id")
        .eq("provider_id", p.id)
        .eq("model_id", m.model_id)
        .maybeSingle();
      if (existing) continue;
      await sb.from("ai_models").insert({
        owner_id: context.userId,
        provider_id: p.id,
        server_id: p.server_id,
        name: m.name ?? m.model_id,
        model_id: m.model_id,
        kind: p.kind,
        endpoint_url: p.base_url,
        size_mb: m.size_mb ?? null,
        capabilities: ["chat"],
        status: "ready",
      });
      added++;
    }
    return { added };
  });

/** Pulls models the agent reported from a VPS into ai_models under a server provider. */
export const importServerModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: server } = await sb.from("servers").select("*").eq("id", data.serverId).maybeSingle();
    if (!server) throw new Error("السيرفر غير موجود");
    const meta = (server.metadata ?? {}) as any;
    const models: any[] = Array.isArray(meta.ai_models) ? meta.ai_models : [];
    if (!models.length) return { added: 0, message: "لم يُبلّغ الوكيل عن أي نماذج على هذا السيرفر" };

    let { data: provider } = await sb
      .from("ai_providers")
      .select("*")
      .eq("server_id", server.id)
      .maybeSingle();
    if (!provider) {
      const { data: created } = await sb
        .from("ai_providers")
        .insert({
          owner_id: context.userId,
          name: `نماذج ${server.name}`,
          kind: "server",
          vendor: "ollama",
          base_url: meta.ai_endpoint ?? null,
          server_id: server.id,
          status: "online",
        })
        .select("*")
        .maybeSingle();
      provider = created;
    }

    let added = 0;
    for (const m of models) {
      const { data: existing } = await sb
        .from("ai_models")
        .select("id")
        .eq("provider_id", provider.id)
        .eq("model_id", m.model_id)
        .maybeSingle();
      if (existing) continue;
      await sb.from("ai_models").insert({
        owner_id: context.userId,
        provider_id: provider.id,
        server_id: server.id,
        name: m.name ?? m.model_id,
        model_id: m.model_id,
        kind: "server",
        endpoint_url: meta.ai_endpoint ?? null,
        size_mb: m.size_mb ?? null,
        capabilities: ["chat"],
        status: "ready",
      });
      added++;
    }
    return { added };
  });

/* ---------------- models ---------------- */

export const upsertAiModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string; provider_id: string; name: string; model_id: string;
    context_window?: number | null; priority?: number; capabilities?: string[];
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: p } = await sb.from("ai_providers").select("*").eq("id", data.provider_id).maybeSingle();
    if (!p) throw new Error("المزوّد غير موجود");
    const row = {
      owner_id: context.userId,
      provider_id: data.provider_id,
      server_id: p.server_id,
      kind: p.kind,
      endpoint_url: p.base_url,
      name: data.name,
      model_id: data.model_id,
      context_window: data.context_window ?? null,
      priority: data.priority ?? 0,
      capabilities: data.capabilities ?? ["chat"],
      status: "ready",
    };
    if (data.id) {
      const { error } = await sb.from("ai_models").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await sb.from("ai_models").insert(row).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: created?.id };
  });

export const setModelActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("ai_models")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.from("ai_models").update({ is_default: false }).eq("owner_id", context.userId);
    const { error } = await sb.from("ai_models").update({ is_default: true, is_active: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAiModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("ai_models").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- routing ---------------- */

export const listRouting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("ai_routing").select("*").order("task");
    return data ?? [];
  });

export const setRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { task: string; primary_model_id: string | null; fallback_model_ids?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: existing } = await sb
      .from("ai_routing")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("task", data.task)
      .maybeSingle();
    const row = {
      owner_id: context.userId,
      task: data.task,
      primary_model_id: data.primary_model_id,
      fallback_model_ids: data.fallback_model_ids ?? [],
    };
    const { error } = existing
      ? await sb.from("ai_routing").update(row).eq("id", existing.id)
      : await sb.from("ai_routing").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- chat ---------------- */


export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    modelId: string;
    conversationId?: string | null;
    message: string;
    allowWrites?: boolean;
    websiteIds?: string[];
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: model } = await sb.from("ai_models").select("*").eq("id", data.modelId).maybeSingle();
    if (!model) throw new Error("النموذج غير موجود");
    const { data: provider } = await sb
      .from("ai_providers")
      .select("*")
      .eq("id", model.provider_id)
      .maybeSingle();
    if (!provider) throw new Error("المزوّد غير موجود");

    // conversation
    let conversationId = data.conversationId ?? null;
    if (!conversationId) {
      const { data: conv } = await sb
        .from("ai_conversations")
        .insert({
          owner_id: context.userId,
          title: data.message.slice(0, 60),
          model_id: model.id,
          website_ids: data.websiteIds ?? [],
        })
        .select("id")
        .maybeSingle();
      conversationId = conv?.id ?? null;
    }

    const { data: history } = await sb
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(30);

    let contextNote = "";
    if (data.websiteIds?.length) {
      const { data: sites } = await sb
        .from("websites")
        .select("id, name, domain, status")
        .in("id", data.websiteIds);
      contextNote = `\nالمواقع قيد النقاش: ${JSON.stringify(sites ?? [])}`;
    }

    const messages: ChatMsg[] = [
      {
        role: "system",
        content:
          "أنت مساعد TVCC لإدارة وتطوير المواقع والسيرفرات. أجب بالعربية بإيجاز ودقة. " +
          "استخدم الأدوات المتاحة لقراءة البيانات الحقيقية قبل الإجابة. " +
          "لا تنفّذ أي تعديل أو حذف دون طلب صريح من المستخدم." +
          contextNote,
      },
      ...((history ?? []) as ChatMsg[]).map((m) => ({ role: m.role as ChatMsg["role"], content: m.content })),
      { role: "user", content: data.message },
    ];

    await sb.from("ai_messages").insert({
      owner_id: context.userId,
      conversation_id: conversationId,
      role: "user",
      content: data.message,
    });

    const toolLog: Array<{ name: string; args: string }> = [];
    let answer = "";
    const started = Date.now();

    for (let step = 0; step < 6; step++) {
      const json = await callModel(model, provider, messages, true);
      const choice = json?.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new Error("رد غير متوقع من النموذج");

      const calls = msg.tool_calls ?? [];
      if (calls.length) {
        messages.push(msg as ChatMsg);
        for (const c of calls) {
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(c.function?.arguments || "{}");
          } catch { /* ignore */ }
          const result = await runTool(sb, context.userId, c.function?.name, args, !!data.allowWrites);
          toolLog.push({ name: String(c.function?.name ?? ""), args: JSON.stringify(args) });
          messages.push({
            role: "tool",
            tool_call_id: c.id,
            content: JSON.stringify(result).slice(0, 8000),
          } as ChatMsg);
        }
        continue;
      }
      answer = msg.content ?? "";
      break;
    }

    if (!answer) answer = "لم أتمكن من إنتاج إجابة نهائية.";

    await sb.from("ai_messages").insert({
      owner_id: context.userId,
      conversation_id: conversationId,
      role: "assistant",
      content: answer,
      model_label: `${provider.name} · ${model.name}`,
      tool_calls: toolLog,
    });
    await sb
      .from("ai_models")
      .update({ last_latency_ms: Date.now() - started, status: "ready" })
      .eq("id", model.id);
    await sb.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    return { conversationId, answer, tools: toolLog };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("ai_conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: messages } = await (context.supabase as any)
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    return messages ?? [];
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("ai_conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- inference test + history ---------------- */

export type { TestParams } from "./ai-hub.server";



/** Runs a prompt against a model. Local (127.0.0.1) models are tested from the browser instead. */
export const testAiModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; prompt?: string; params?: TestParams }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: model } = await sb.from("ai_models").select("*").eq("id", data.id).maybeSingle();
    if (!model) throw new Error("النموذج غير موجود");
    const { data: provider } = await sb.from("ai_providers").select("*").eq("id", model.provider_id).maybeSingle();
    if (!provider) throw new Error("المزوّد غير موجود");

    const prompt = data.prompt?.trim() || DEFAULT_PROMPT;
    const params = data.params ?? {};
    const started = Date.now();
    try {
      const json = await callModel(model, provider, [{ role: "user", content: prompt }], false, params);
      const latency = Date.now() - started;
      const answer = String(json?.choices?.[0]?.message?.content ?? "");
      const usage = json?.usage ?? {};
      await sb.from("ai_models").update({ last_latency_ms: latency, status: "ready" }).eq("id", model.id);
      await sb.from("ai_model_tests").insert({
        owner_id: context.userId,
        model_id: model.id,
        model_label: model.name ?? model.model_id,
        provider_label: provider.name ?? provider.vendor,
        prompt,
        answer: answer.slice(0, 4000),
        latency_ms: latency,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        settings: params,
        status: "success",
      });
      return {
        ok: true,
        latency,
        answer: answer.slice(0, 4000),
        usage: {
          prompt_tokens: usage.prompt_tokens ?? null,
          completion_tokens: usage.completion_tokens ?? null,
          total_tokens: usage.total_tokens ?? null,
        },
      };
    } catch (e) {
      const latency = Date.now() - started;
      const message = e instanceof Error ? e.message : "فشل الاختبار";
      await sb.from("ai_models").update({ status: "error" }).eq("id", model.id);
      await sb.from("ai_model_tests").insert({
        owner_id: context.userId,
        model_id: model.id,
        model_label: model.name ?? model.model_id,
        provider_label: provider.name ?? provider.vendor,
        prompt,
        latency_ms: latency,
        settings: params,
        status: "error",
        error_message: message.slice(0, 1000),
      });
      return { ok: false, latency, error: message, answer: "", usage: null };
    }
  });

/** Saves the outcome of a browser-side local-model test. */
export const recordModelTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      ok: boolean;
      latency: number;
      prompt?: string;
      answer?: string;
      error?: string;
      params?: TestParams;
      usage?: { prompt_tokens?: number | null; completion_tokens?: number | null; total_tokens?: number | null } | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: model } = await sb.from("ai_models").select("*").eq("id", data.id).maybeSingle();
    await sb
      .from("ai_models")
      .update({ last_latency_ms: data.latency, status: data.ok ? "ready" : "error" })
      .eq("id", data.id);
    await sb.from("ai_model_tests").insert({
      owner_id: context.userId,
      model_id: data.id,
      model_label: model?.name ?? model?.model_id ?? "local",
      provider_label: "local",
      prompt: data.prompt ?? DEFAULT_PROMPT,
      answer: (data.answer ?? "").slice(0, 4000),
      latency_ms: data.latency,
      prompt_tokens: data.usage?.prompt_tokens ?? null,
      completion_tokens: data.usage?.completion_tokens ?? null,
      total_tokens: data.usage?.total_tokens ?? null,
      settings: data.params ?? {},
      status: data.ok ? "success" : "error",
      error_message: data.error?.slice(0, 1000) ?? null,
    });
    return { ok: true };
  });

/** Persists per-model test settings (prompt + sampling params) inside the model metadata. */
export const saveModelTestSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; prompt: string; params: TestParams }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: model } = await sb.from("ai_models").select("metadata").eq("id", data.id).maybeSingle();
    const metadata = { ...(model?.metadata ?? {}), test: { prompt: data.prompt, ...data.params } };
    const { error } = await sb.from("ai_models").update({ metadata }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listModelTests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { modelId?: string | null; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("ai_model_tests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data?.limit ?? 200, 500));
    if (data?.modelId) q = q.eq("model_id", data.modelId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteModelTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("ai_model_tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- browser-side (local / LAN) model support ---------------- */

/** Tool schemas the browser needs so it can pass them to a local model. */
export const listAiToolSchemas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () =>
    AI_TOOLS.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
  );

/** Executes one AI tool with the caller's RLS-scoped client (used by browser-run models). */
export const runAiTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; args?: Record<string, unknown>; allowWrites?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const result = await runTool(
      context.supabase as any,
      context.userId,
      data.name,
      (data.args ?? {}) as Record<string, any>,
      !!data.allowWrites,
    );
    return { result };
  });

/** Persists a full chat turn produced in the browser (local/LAN models). */
export const saveChatTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    conversationId?: string | null;
    modelId: string;
    modelLabel?: string | null;
    question: string;
    answer: string;
    tools?: Array<{ name: string; args: string }>;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let conversationId = data.conversationId ?? null;
    if (!conversationId) {
      const { data: conv, error } = await sb
        .from("ai_conversations")
        .insert({
          owner_id: context.userId,
          title: data.question.slice(0, 60),
          model_id: data.modelId,
          website_ids: [],
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      conversationId = conv?.id ?? null;
    }
    await sb.from("ai_messages").insert([
      { owner_id: context.userId, conversation_id: conversationId, role: "user", content: data.question },
      {
        owner_id: context.userId,
        conversation_id: conversationId,
        role: "assistant",
        content: data.answer,
        model_label: data.modelLabel ?? null,
        tool_calls: data.tools ?? [],
      },
    ]);
    await sb.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    return { conversationId };
  });

/** One-click: register the built-in Lovable AI cloud provider with its models. */
export const enableLovableProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: existing } = await sb
      .from("ai_providers")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("vendor", "lovable")
      .maybeSingle();

    let providerId = existing?.id as string | undefined;
    if (!providerId) {
      const { data: created, error } = await sb
        .from("ai_providers")
        .insert({
          owner_id: context.userId,
          name: "Lovable AI (سحابي)",
          kind: "cloud",
          vendor: "lovable",
          base_url: GATEWAY,
          is_active: true,
          status: "online",
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      providerId = created?.id;
    }
    if (!providerId) throw new Error("تعذّر إنشاء المزوّد");

    const models = await providerModels("cloud", "lovable", null, null);
    const { data: present } = await sb
      .from("ai_models")
      .select("model_id")
      .eq("provider_id", providerId);
    const have = new Set((present ?? []).map((m: any) => m.model_id));
    const rows = models
      .filter((m: any) => !have.has(m.model_id))
      .map((m: any, i: number) => ({
        owner_id: context.userId,
        provider_id: providerId,
        name: m.name,
        model_id: m.model_id,
        kind: "cloud",
        capabilities: ["chat", "tools"],
        is_active: true,
        is_default: i === 0 && have.size === 0,
        status: "ready",
      }));
    if (rows.length) {
      const { error } = await sb.from("ai_models").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { providerId, added: rows.length, total: models.length };
  });
