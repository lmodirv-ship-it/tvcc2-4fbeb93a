import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlLike = z
  .string()
  .min(4)
  .max(500)
  .transform((v) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : `http://${v.trim()}`))
  .refine((v) => {
    try { new URL(v); return true; } catch { return false; }
  }, "رابط غير صالح");

const saveSchema = z.object({
  serviceKey: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  method: z.enum(["url", "api", "token", "webhook"]),
  url: urlLike,
  token: z.string().max(500).optional(),
  webhookUrl: z.string().max(500).optional(),
});

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("external_integrations")
      .select("id, service_key, name, method, url, webhook_url, status, last_checked_at, last_error, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      owner_id: userId,
      service_key: data.serviceKey,
      name: data.name,
      method: data.method,
      url: data.url,
      token: data.token || null,
      webhook_url: data.webhookUrl || null,
      status: "pending" as const,
      last_error: null,
    };
    const { data: saved, error } = await supabase
      .from("external_integrations")
      .upsert(row, { onConflict: "owner_id,service_key" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // عناوين الشبكة المحلية لا يمكن فحصها من السحابة — تبقى «بانتظار الفحص»
    if (isPrivateUrl(data.url)) {
      await supabase
        .from("external_integrations")
        .update({ status: "pending", last_error: "عنوان محلي — سيُفحص عبر وكيل السيرفر" })
        .eq("id", saved.id);
      return { id: saved.id, connected: false, local: true, error: null };
    }

    // فحص الاتصال فوراً بعد الحفظ
    const check = await pingUrl(data.url);
    await supabase
      .from("external_integrations")
      .update({
        status: check.ok ? "connected" : "failed",
        last_checked_at: new Date().toISOString(),
        last_error: check.ok ? null : check.error,
      })
      .eq("id", saved.id);
    return { id: saved.id, connected: check.ok, local: false, error: check.error ?? null };
  });

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("external_integrations")
      .select("id, url")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("التكامل غير موجود");
    if (isPrivateUrl(row.url)) {
      await supabase
        .from("external_integrations")
        .update({ status: "pending", last_error: "عنوان محلي — سيُفحص عبر وكيل السيرفر" })
        .eq("id", row.id);
      return { connected: false, local: true, error: null };
    }
    const check = await pingUrl(row.url);
    await supabase
      .from("external_integrations")
      .update({
        status: check.ok ? "connected" : "failed",
        last_checked_at: new Date().toISOString(),
        last_error: check.ok ? null : check.error,
      })
      .eq("id", row.id);
    return { connected: check.ok, error: check.error ?? null };
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("external_integrations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** بطاقة ربط HN Service Hub: الاسم + Base URL + رابط الكتالوج + المفتاح */
export const getHnServiceLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("external_integrations")
      .select("id, token, status, last_checked_at")
      .eq("service_key", "hn-service")
      .maybeSingle();
    return {
      siteName: "TVCC",
      baseUrl: "https://tvcc.hnpay.live",
      catalogUrl: "https://tvcc.hnpay.live/api/public/hn-service/catalog",
      token: data?.token ?? null,
      status: data?.status ?? "pending",
      lastCheckedAt: data?.last_checked_at ?? null,
    };
  });

/** توليد مفتاح جديد لـ HN Service Hub (الرابط ثابت ولا يتغير) */
export const generateHnServiceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = `hn_${crypto.randomUUID().replace(/-/g, "")}${crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)}`;
    const { error } = await supabase.from("external_integrations").upsert(
      {
        owner_id: userId,
        service_key: "hn-service",
        name: "HN Service Hub",
        method: "token" as const,
        url: "https://tvcc.hnpay.live/api/public/hn-service/catalog",
        token,
        status: "pending" as const,
        last_error: null,
      },
      { onConflict: "owner_id,service_key" },
    );
    if (error) throw new Error(error.message);
    return { token };
  });


function isPrivateUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return (
      h === "localhost" ||
      h.startsWith("127.") ||
      h.startsWith("10.") ||
      h.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      h.endsWith(".local") ||
      h.endsWith(".hn")
    );
  } catch {
    return false;
  }
}

async function pingUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (res.status < 500) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الوصول" };
  }
}
