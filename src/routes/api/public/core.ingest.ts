import { createFileRoute } from "@tanstack/react-router";
import { verifyIngestSignature } from "@/lib/ingest-auth.server";

export const Route = createFileRoute("/api/public/core/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyIngestSignature(request, "CORE_INGEST_SECRET", [
          "x-tvcc-signature",
          "x-core-signature",
        ]);
        if (!auth.ok) return auth.response;
        try {
          const body = JSON.parse(auth.raw || "{}");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).from("activity_log").insert({
            owner_id: "e3066a24-8c0b-4cee-af2a-b2646ae6cfbc",
            action: "core.hub.ingest",
            entity_type: "core_hub",
            details: { received_at: new Date().toISOString(), payload: body },
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