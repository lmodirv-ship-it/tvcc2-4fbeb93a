import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const CODE_RE = /^[A-Z][0-9]{6}$/;

export const Route = createFileRoute("/api/public/hn/identity/$code")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const code = String(params.code ?? "").trim().toUpperCase();
        if (!CODE_RE.test(code)) {
          return Response.json({ error: "invalid_code" }, { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("hn_group_identities")
          .select("code, service_name, service_number, site_url, status, last_signal_at")
          .eq("code", code)
          .maybeSingle();

        if (!data) return Response.json({ error: "not_found" }, { status: 404, headers: CORS });

        return Response.json({ ok: true, ...data, hub: "TVCC" }, { headers: CORS });
      },
    },
  },
});
