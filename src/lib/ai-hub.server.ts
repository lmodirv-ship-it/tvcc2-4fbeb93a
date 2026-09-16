/** Server-only helpers for the AI hub. Kept out of *.functions.ts so the
 * server-function splitter cannot strip them. */
import { AI_TOOLS } from "./ai-tools.server";
import { createDecipheriv, scryptSync } from "crypto";

function vaultDecrypt(ciphertext: string, iv: string): string {
  const master = process.env["VAULT_MASTER_KEY"];
  if (!master) throw new Error("VAULT_MASTER_KEY غير مضبوط — الخزنة معطّلة حتى ضبط المفتاح");
  const candidates = [master];
  const legacy = process.env["VAULT_LEGACY_KEY"];
  if (legacy) candidates.push(legacy);
  const buf = Buffer.from(ciphertext, "base64");
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const key = scryptSync(candidate, "tvcc-vault-salt", 32);
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
      decipher.setAuthTag(buf.subarray(0, 16));
      return Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]).toString("utf8");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("تعذّر فك تشفير السر");
}

/** Vendor -> accepted secret names inside the vault (case-insensitive). */
const VENDOR_SECRET_NAMES: Record<string, string[]> = {
  gemini: ["GEMINI_API_KEY", "apikeygemini", "GOOGLE_API_KEY"],
  ollama_cloud: ["OLLAMA_API_KEY", "ollamatvv", "ollamatvcc"],
  openai: ["OPENAI_API_KEY"],
};

/**
 * If a provider has no stored key, try to pull one from the encrypted vault
 * so that adding e.g. GEMINI_API_KEY in /vault instantly enables chat.
 */
export async function withVaultKey(sb: any, provider: any): Promise<any> {
  if (!provider || provider.api_key_encrypted) return provider;
  const names = VENDOR_SECRET_NAMES[provider.vendor];
  if (!names) return provider;
  try {
    const { data: rows } = await sb.from("vault_secrets").select("name, encrypted_value, iv");
    const wanted = names.map((n) => n.toLowerCase());
    const hit = (rows ?? []).find((r: any) => wanted.includes(String(r.name).toLowerCase()));
    if (!hit) return provider;
    return { ...provider, api_key_encrypted: vaultDecrypt(hit.encrypted_value, hit.iv) };
  } catch {
    return provider;
  }
}



export const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const DEFAULT_PROMPT = "قل: مرحباً من TVCC. بجملة واحدة فقط.";

export type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; [k: string]: unknown };
export type TestParams = { temperature?: number; max_tokens?: number; top_p?: number };

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/** Google AI Studio key stored in project secrets (apikeygemini). */
export function geminiKey(): string {
  const key = process.env["apikeygemini"] ?? process.env["APIKEYGEMINI"] ?? "";
  if (!key) throw new Error("مفتاح Gemini غير مُهيّأ في الأسرار (apikeygemini)");
  return key;
}

export const OLLAMA_CLOUD_BASE = "https://ollama.com";

/** Ollama Cloud key stored in project secrets (ollamatvv). */
export function ollamaCloudKey(): string {
  const key = process.env["ollamatvv"] ?? process.env["OLLAMATVV"] ?? process.env["ollamatvcc"] ?? "";
  if (!key) throw new Error("مفتاح Ollama Cloud غير مُهيّأ في الأسرار (ollamatvv)");
  return key;
}

export async function providerModels(kind: string, vendor: string, baseUrl: string | null, apiKey: string | null) {
  if (vendor === "ollama_cloud") {
    const res = await fetch(`${OLLAMA_CLOUD_BASE}/v1/models`, {
      headers: { authorization: `Bearer ${apiKey || ollamaCloudKey()}` },
    });
    if (!res.ok) throw new Error(`Ollama Cloud ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as any;
    return (json.data ?? []).map((m: any) => ({ model_id: m.id, name: m.id }));
  }
  if (vendor === "gemini") {
    const res = await fetch(`${GEMINI_BASE}/models`, {
      headers: { authorization: `Bearer ${apiKey || geminiKey()}` },
    });
    if (!res.ok) throw new Error(`Gemini ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as any;
    return (json.data ?? [])
      .map((m: any) => String(m.id).replace(/^models\//, ""))
      .filter((id: string) => id.startsWith("gemini"))
      .map((id: string) => ({ model_id: id, name: id }));
  }
  if (kind === "cloud" && vendor === "lovable") {
    return [
      { model_id: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash (افتراضي)" },
      { model_id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
      { model_id: "google/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
      { model_id: "openai/gpt-5.6-terra", name: "GPT-5.6 Terra" },
      { model_id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna" },
      { model_id: "openai/gpt-5.5", name: "GPT-5.5" },
    ];
  }
  if (!baseUrl) throw new Error("العنوان (base URL) مطلوب لهذا المزوّد");
  const base = baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

  // Ollama native
  if (vendor === "ollama") {
    const res = await fetch(`${base}/api/tags`, { headers });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const json = (await res.json()) as any;
    return (json.models ?? []).map((m: any) => ({
      model_id: m.name,
      name: m.name,
      size_mb: m.size ? Math.round(m.size / 1048576) : null,
    }));
  }
  const res = await fetch(`${base}/v1/models`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = (await res.json()) as any;
  return (json.data ?? []).map((m: any) => ({ model_id: m.id, name: m.id }));
}

export async function callModel(
  model: any,
  provider: any,
  messages: ChatMsg[],
  withTools: boolean,
  params?: { temperature?: number; max_tokens?: number; top_p?: number },
): Promise<any> {
  const isLovable = provider.vendor === "lovable" && provider.kind === "cloud";
  const isGemini = provider.vendor === "gemini";
  const isOllamaCloud = provider.vendor === "ollama_cloud";
  const base = isLovable
    ? GATEWAY
    : isGemini
      ? GEMINI_BASE
      : isOllamaCloud
        ? OLLAMA_CLOUD_BASE
        : (model.endpoint_url ?? provider.base_url ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("لا يوجد عنوان للمزوّد");

  const url = isLovable || isGemini ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (isLovable) {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("مفتاح Lovable AI غير مُهيّأ");
    headers["Lovable-API-Key"] = key;
  } else if (isGemini) {
    headers["authorization"] = `Bearer ${provider.api_key_encrypted || geminiKey()}`;
  } else if (isOllamaCloud) {
    headers["authorization"] = `Bearer ${provider.api_key_encrypted || ollamaCloudKey()}`;
  } else if (provider.api_key_encrypted) {
    headers["authorization"] = `Bearer ${provider.api_key_encrypted}`;
  }

  const body: Record<string, unknown> = { model: model.model_id, messages };
  if (params?.temperature != null) body.temperature = params.temperature;
  if (params?.max_tokens != null) body.max_tokens = params.max_tokens;
  if (params?.top_p != null) body.top_p = params.top_p;
  if (withTools) {
    body.tools = AI_TOOLS.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول بعد قليل.");
    if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ. أضف رصيداً من إعدادات Lovable.");
    throw new Error(`(${res.status}) ${text.slice(0, 400)}`);
  }
  return res.json();
}
