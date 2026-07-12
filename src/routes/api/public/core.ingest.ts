import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/core/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).from("activity_log").insert({
            action: "core.hub.ingest",
            entity_type: "core_hub",
            metadata: { received_at: new Date().toISOString(), payload: body },
          });
          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "err" }, { status: 500 });
        }
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-core-key" } }),
    },
  },
});