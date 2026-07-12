import { createFileRoute } from "@tanstack/react-router";

async function pingDomain(domain: string) {
  const started = Date.now();
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url, { method: "HEAD", signal: ac.signal, redirect: "follow" });
    clearTimeout(timer);
    const latency = Date.now() - started;
    let status: "online" | "offline" | "warning" = "online";
    if (res.status >= 500) status = "offline";
    else if (res.status >= 400) status = "warning";
    return { status, latency_ms: latency, http_status: res.status };
  } catch {
    return { status: "offline" as const, latency_ms: Date.now() - started, http_status: null };
  }
}

export const Route = createFileRoute("/api/public/hooks/health-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sites, error } = await supabaseAdmin
          .from("websites")
          .select("id, domain, owner_id")
          .eq("is_active", true)
          .limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results = await Promise.all(
          (sites ?? []).map(async (s) => {
            const r = await pingDomain(s.domain);
            await supabaseAdmin.from("websites").update({ status: r.status }).eq("id", s.id);
            if (s.owner_id) {
              await supabaseAdmin.from("site_health_checks").insert({
                owner_id: s.owner_id,
                website_id: s.id,
                status: r.status,
                response_time_ms: r.latency_ms,
                http_status: r.http_status,
              });
            }
            return r.status;
          }),
        );

        return Response.json({
          checked: results.length,
          online: results.filter((s) => s === "online").length,
          offline: results.filter((s) => s === "offline").length,
          warning: results.filter((s) => s === "warning").length,
          at: new Date().toISOString(),
        });
      },
    },
  },
});