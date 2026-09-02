import { createFileRoute } from "@tanstack/react-router";
import { AGENT_VERSION } from "@/lib/agent-version";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Unified read point: every domain and the local node report the same state. */
export const Route = createFileRoute("/api/public/publish/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const host = new URL(request.url).host;

        const { data } = await supabaseAdmin
          .from("publish_targets")
          .select("label, kind, url, is_canonical, is_active, last_publish_at, last_status, last_version, port")
          .eq("is_active", true);

        const targets = data ?? [];
        const canonical = targets.find((t: any) => t.is_canonical)?.url ?? "https://tvcc.hnpay.live";

        return Response.json(
          {
            ok: true,
            host,
            canonical,
            version: AGENT_VERSION,
            generated_at: new Date().toISOString(),
            targets: targets.map((t: any) => ({
              label: t.label,
              kind: t.kind,
              url: t.url,
              port: t.port,
              is_canonical: t.is_canonical,
              last_publish_at: t.last_publish_at,
              last_status: t.last_status,
              last_version: t.last_version,
            })),
          },
          { headers: { ...corsHeaders, "Cache-Control": "public, max-age=15" } },
        );
      },
    },
  },
});
