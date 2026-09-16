import { createFileRoute } from "@tanstack/react-router";
import { SITE_ONLINE_WINDOW_MS } from "@/lib/site-agent.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** حالة الشارة العامة لموقع — بدون أسرار وبدون بيانات حساسة. */
export const Route = createFileRoute("/api/public/site/badge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const site = (url.searchParams.get("site") || "").trim().toLowerCase();
        if (!site) return Response.json({ error: "site_required" }, { status: 400, headers: cors });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;

        const { data: website } = await sb
          .from("websites")
          .select("id,name,site_code,domain,is_active")
          .or(`site_code.eq.${site},domain.eq.${site},frontend_domain.eq.${site}`)
          .maybeSingle();

        if (!website) return Response.json({ connected: false, member: false }, { headers: cors });

        const { data: agent } = await sb
          .from("site_agents")
          .select("last_beacon_at,status,version")
          .eq("website_id", website.id)
          .maybeSingle();

        const last = agent?.last_beacon_at ? Date.parse(agent.last_beacon_at) : 0;
        const connected = !!last && Date.now() - last < SITE_ONLINE_WINDOW_MS;

        return Response.json(
          {
            member: true,
            connected,
            label: "TVCC",
            group: "HN",
            name: website.name,
            code: website.site_code,
            version: agent?.version ?? null,
            last_beacon_at: agent?.last_beacon_at ?? null,
          },
          { headers: { ...cors, "Cache-Control": "public, max-age=30" } },
        );
      },
    },
  },
});
