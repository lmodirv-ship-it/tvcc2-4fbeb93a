import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STUDIO_URL = "https://site-to-vid-magic.lovable.app";

export const pingVideoStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const started = Date.now();
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(STUDIO_URL, { method: "HEAD", signal: ac.signal, redirect: "follow" });
      clearTimeout(t);
      const ms = Date.now() - started;
      const status = res.status < 400 ? "online" : res.status < 500 ? "warning" : "offline";
      return { status, ms, http: res.status, url: STUDIO_URL };
    } catch (e: any) {
      return { status: "offline" as const, ms: Date.now() - started, http: 0, url: STUDIO_URL, error: e?.message };
    }
  });

export const requestVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { target_site?: string; prompt: string; channel?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any).from("video_requests").insert({
      owner_id: userId,
      requester_channel: data.channel ?? "hn-nawat",
      target_site: data.target_site ?? null,
      prompt: data.prompt,
      status: "pending",
      provider: "site-to-vid-magic",
      payload: { source: "tvcc", requested_at: new Date().toISOString() },
    }).select().single();
    if (error) throw new Error(error.message);

    const callbackUrl = `${process.env.PUBLIC_APP_URL ?? "https://hn-tvcc.lovable.app"}/api/public/video/ingest`;
    const started = Date.now();
    let deliver: { ok: boolean; status: number; error?: string } = { ok: false, status: 0 };
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 12000);
      const res = await fetch(`${STUDIO_URL}/api/public/tvcc/request`, {
        method: "POST",
        signal: ac.signal,
        headers: { "content-type": "application/json", "x-tvcc-source": "hn-nawat" },
        body: JSON.stringify({
          request_id: row.id,
          target_site: data.target_site,
          prompt: data.prompt,
          callback_url: callbackUrl,
          channel: data.channel ?? "hn-nawat",
        }),
      });
      clearTimeout(t);
      deliver = { ok: res.ok, status: res.status };
    } catch (e: any) {
      deliver = { ok: false, status: 0, error: e?.message ?? "network error" };
    }

    await (supabase as any).from("video_requests").update({
      status: deliver.ok ? "processing" : "failed",
      error_message: deliver.ok ? null : (deliver.error ?? `HTTP ${deliver.status}`),
    }).eq("id", row.id);

    await (supabase as any).from("activity_log").insert({
      owner_id: userId,
      action: "video.request.sent",
      entity_type: "video_request",
      entity_id: row.id,
      details: { target_site: data.target_site, deliver, ms: Date.now() - started },
    });

    return { id: row.id, delivered: deliver.ok, http: deliver.status };
  });