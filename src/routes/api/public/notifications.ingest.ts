import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// External webhook: HN-DB and HN-Cloud push notifications into TVCC.
// Auth: header `x-tvcc-signature: sha256=<hex>` = HMAC-SHA256(NOTIFICATIONS_INGEST_SECRET, raw body)
// Body: {
//   owner_id: uuid,                    // target user (TVCC account owner)
//   type: string,                      // e.g. "database_error" | "storage_full" | "website_offline"
//   severity?: "info"|"success"|"warning"|"critical",
//   title: string,
//   message?: string,
//   website_id?: uuid,
//   metadata?: object
// }
//
// Accepts a single object or an array of events.

type Event = {
  owner_id: string;
  type: string;
  severity?: string;
  title: string;
  message?: string;
  website_id?: string;
  metadata?: Record<string, unknown>;
};

function isValidEvent(e: any): e is Event {
  return (
    e &&
    typeof e.owner_id === "string" &&
    typeof e.type === "string" &&
    typeof e.title === "string" &&
    e.owner_id.length > 0 &&
    e.type.length <= 64 &&
    e.title.length <= 200
  );
}

export const Route = createFileRoute("/api/public/notifications/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOTIFICATIONS_INGEST_SECRET;
        if (!secret) return new Response("Server not configured", { status: 500 });

        const sigHeader = request.headers.get("x-tvcc-signature") ?? "";
        const expected =
          "sha256=" + createHmac("sha256", secret).update(await request.clone().text()).digest("hex");
        const a = Buffer.from(sigHeader);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const events = Array.isArray(body) ? body : [body];
        if (events.length === 0 || events.length > 100) {
          return new Response("Batch size must be 1-100", { status: 400 });
        }
        const clean = events.filter(isValidEvent);
        if (clean.length === 0) return new Response("No valid events", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rows = clean.map((e) => ({
          owner_id: e.owner_id,
          type: e.type,
          severity: e.severity ?? "info",
          title: e.title,
          message: e.message ?? null,
          website_id: e.website_id ?? null,
          metadata: e.metadata ?? {},
          is_read: false,
        }));

        const { error, data } = await supabaseAdmin.from("notifications").insert(rows).select("id");
        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({ ok: true, inserted: data?.length ?? 0 });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-tvcc-signature",
          },
        }),
    },
  },
});
