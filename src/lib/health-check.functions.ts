import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function pingDomain(domain: string): Promise<{ status: "online" | "offline" | "warning"; latency_ms: number; http_status: number | null }> {
  const started = Date.now();
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url, { method: "HEAD", signal: ac.signal, redirect: "follow" });
    clearTimeout(timer);
    const latency = Date.now() - started;
    if (res.status >= 500) return { status: "offline", latency_ms: latency, http_status: res.status };
    if (res.status >= 400) return { status: "warning", latency_ms: latency, http_status: res.status };
    return { status: "online", latency_ms: latency, http_status: res.status };
  } catch {
    return { status: "offline", latency_ms: Date.now() - started, http_status: null };
  }
}

export const runHealthCheckAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sites, error } = await supabase
      .from("websites")
      .select("id, domain")
      .eq("is_active", true)
      .limit(200);
    if (error) throw new Error(error.message);

    const results = await Promise.all(
      (sites ?? []).map(async (s) => {
        const r = await pingDomain(s.domain);
        await supabase.from("websites").update({ status: r.status }).eq("id", s.id);
        await supabase.from("site_health_checks").insert({
          owner_id: userId,
          website_id: s.id,
          status: r.status,
          response_time_ms: r.latency_ms,
          http_status: r.http_status,
        });
        return { id: s.id, domain: s.domain, ...r };
      }),
    );

    const summary = {
      total: results.length,
      online: results.filter((r) => r.status === "online").length,
      offline: results.filter((r) => r.status === "offline").length,
      warning: results.filter((r) => r.status === "warning").length,
    };
    return { summary, checked_at: new Date().toISOString() };
  });