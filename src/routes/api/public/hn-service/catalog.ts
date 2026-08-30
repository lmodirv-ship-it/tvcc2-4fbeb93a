import { createFileRoute } from "@tanstack/react-router";
import { buildHnServiceCatalog } from "@/lib/hn-service.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hn-service/catalog")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const header = request.headers.get("authorization") ?? "";
        const token =
          (header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "") ||
          (url.searchParams.get("token") ?? "").trim();

        if (!token) {
          return Response.json(
            { error: "missing_token" },
            { status: 401, headers: CORS },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await supabaseAdmin
          .from("external_integrations")
          .select("owner_id, token")
          .eq("service_key", "hn-service")
          .not("token", "is", null);

        if (error) {
          return Response.json({ error: "lookup_failed" }, { status: 500, headers: CORS });
        }

        const match = (rows ?? []).find((r) => r.token && timingSafeEqual(r.token, token));
        if (!match) {
          return Response.json({ error: "invalid_token" }, { status: 401, headers: CORS });
        }

        try {
          const catalog = await buildHnServiceCatalog(match.owner_id);
          await supabaseAdmin
            .from("external_integrations")
            .update({
              status: "connected",
              last_checked_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("service_key", "hn-service")
            .eq("owner_id", match.owner_id);

          return Response.json(
            {
              site: "TVCC",
              base_url: "https://tvcc.hnpay.live",
              ...catalog,
            },
            { headers: { ...CORS, "Cache-Control": "no-store" } },
          );
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "catalog_failed" },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
