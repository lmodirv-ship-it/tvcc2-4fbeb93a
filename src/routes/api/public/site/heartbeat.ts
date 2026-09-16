import { createFileRoute } from "@tanstack/react-router";
import { deriveSiteKey, freshTimestamp, hashSiteKey, verifySiteSignature } from "@/lib/site-agent.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-tvcc-site-sign",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}

export const Route = createFileRoute("/api/public/site/heartbeat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const secret = process.env["SITE_AGENT_SECRET"];
        if (!secret) return json({ ok: false, error: "not_configured" }, 500);

        const raw = await request.text();
        let body: any = null;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ ok: false, error: "bad_json" }, 400);
        }

        const site = String(body?.site || "").trim().toLowerCase();
        if (!site) return json({ ok: false, error: "site_required" }, 400);
        if (!freshTimestamp(body?.ts)) return json({ ok: false, error: "stale" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;

        const { data: website } = await sb
          .from("websites")
          .select("id,name,domain,site_code,owner_id,server_id,is_active")
          .or(`site_code.eq.${site},domain.eq.${site},frontend_domain.eq.${site}`)
          .maybeSingle();

        if (!website) return json({ ok: false, error: "unknown_site" }, 404);

        const key = deriveSiteKey(secret, website.id);
        if (!verifySiteSignature(key, raw, request.headers.get("x-tvcc-site-sign"))) {
          return json({ ok: false, error: "invalid_signature" }, 401);
        }

        const now = new Date().toISOString();
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          null;

        const { data: existing } = await sb
          .from("site_agents")
          .select("id,beacons")
          .eq("website_id", website.id)
          .maybeSingle();

        const payload = {
          owner_id: website.owner_id,
          website_id: website.id,
          server_id: website.server_id ?? null,
          key_hash: hashSiteKey(key),
          version: String(body?.version || "1.0.0").slice(0, 20),
          status: "online",
          last_beacon_at: now,
          last_ip: ip,
          beacons: Number(existing?.beacons ?? 0) + 1,
          meta: typeof body?.meta === "object" && body.meta ? body.meta : {},
        };

        if (existing) {
          await sb.from("site_agents").update(payload).eq("id", existing.id);
        } else {
          await sb.from("site_agents").insert(payload);
        }

        return json({
          ok: true,
          site: { code: website.site_code, name: website.name, domain: website.domain },
          badge: { label: "TVCC", connected: true, group: "HN", color: "green" },
          interval_seconds: 60,
          commands: [],
        });
      },
    },
  },
});
