import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function postToSite(baseUrl: string, path: string, payload: unknown, apiKey?: string | null) {
  const started = Date.now();
  const url = (baseUrl.replace(/\/$/, "")) + path;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-core-key": apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, ms: Date.now() - started, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, status: 0, ms: Date.now() - started, error: e?.message ?? "network error" };
  }
}

export const pingCore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cfg } = await supabase.from("core_hub_config").select("*").eq("owner_id", userId).maybeSingle();
    const url = cfg?.core_url ?? "https://hn-nwt.lovable.app";
    const started = Date.now();
    let status: "online" | "offline" | "warning" = "offline";
    let ms = 0;
    let http: number | null = null;
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(url, { method: "HEAD", signal: ac.signal, redirect: "follow" });
      clearTimeout(t);
      ms = Date.now() - started;
      http = res.status;
      status = res.status < 400 ? "online" : res.status < 500 ? "warning" : "offline";
    } catch {
      ms = Date.now() - started;
    }
    await supabase.from("core_hub_config").upsert({
      owner_id: userId,
      core_url: url,
      connection_status: status,
      last_ping_ms: ms,
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "owner_id" });
    return { status, ms, http, url };
  });

export const broadcastDirective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { directiveId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: directive, error } = await supabase
      .from("core_directives").select("*").eq("id", data.directiveId).maybeSingle();
    if (error || !directive) throw new Error("Directive not found");

    const { data: cfg } = await supabase.from("core_hub_config").select("*").eq("owner_id", userId).maybeSingle();
    const coreUrl = cfg?.core_url ?? "https://hn-nwt.lovable.app";
    const apiKey = cfg?.api_key ?? null;

    // Resolve target websites
    let targets: { id: string; domain: string }[] = [];
    if (directive.scope === "specific_sites" && (directive.target_website_ids ?? []).length) {
      const { data } = await supabase.from("websites").select("id, domain").in("id", directive.target_website_ids);
      targets = data ?? [];
    } else if (directive.scope === "service_type" && directive.target_service_type) {
      const { data: services } = await (supabase as any).from("site_services").select("website_id").eq("service_type", directive.target_service_type);
      const ids = Array.from(new Set((services ?? []).map((s: any) => s.website_id)));
      if (ids.length) {
        const { data } = await supabase.from("websites").select("id, domain").in("id", ids);
        targets = data ?? [];
      }
    } else {
      const { data } = await supabase.from("websites").select("id, domain").eq("is_active", true).limit(500);
      targets = data ?? [];
    }

    await supabase.from("core_directives").update({ status: "broadcasting", broadcast_at: new Date().toISOString() }).eq("id", directive.id);

    // First: notify core
    await postToSite(coreUrl, "/api/public/core/directive", {
      id: directive.id, title: directive.title, body: directive.body,
      type: directive.directive_type, priority: directive.priority,
      scope: directive.scope, targets: targets.map((t) => t.domain),
    }, apiKey);

    // Fan-out to each target site
    const rows = await Promise.all(targets.map(async (t) => {
      const r = await postToSite(`https://${t.domain}`, "/api/public/directives/ingest", {
        directive_id: directive.id,
        title: directive.title,
        body: directive.body,
        type: directive.directive_type,
        priority: directive.priority,
        issued_at: new Date().toISOString(),
        source: "core-hub",
      }, apiKey);
      return {
        directive_id: directive.id,
        website_id: t.id,
        status: r.ok ? "delivered" : "failed",
        http_status: r.status || null,
        response_ms: r.ms,
        error_message: r.error,
        delivered_at: r.ok ? new Date().toISOString() : null,
      };
    }));

    if (rows.length) {
      await (supabase as any).from("core_directive_targets").upsert(rows, { onConflict: "directive_id,website_id" });
    }

    const delivered = rows.filter((r) => r.status === "delivered").length;
    const failed = rows.length - delivered;
    const finalStatus = failed === 0 ? "delivered" : delivered === 0 ? "failed" : "partial";
    await supabase.from("core_directives").update({
      status: finalStatus, delivered_count: delivered, failed_count: failed,
    }).eq("id", directive.id);

    await supabase.from("activity_log").insert({
      owner_id: userId,
      action: "core.directive.broadcast",
      entity_type: "core_directive",
      entity_id: directive.id,
      metadata: { total: rows.length, delivered, failed, core_url: coreUrl },
    });

    return { total: rows.length, delivered, failed, status: finalStatus };
  });