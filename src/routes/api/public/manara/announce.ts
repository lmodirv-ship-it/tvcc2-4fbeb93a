import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-manara-signature",
};

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const Route = createFileRoute("/api/public/manara/announce")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: CORS });
        }

        const key = String(body["key"] ?? "").trim().toUpperCase();
        if (!/^ID\d{5,}$/.test(key)) {
          return Response.json({ error: "invalid_key" }, { status: 400, headers: CORS });
        }

        const secret = process.env["HN_HUB_VERIFICATION_SALT"];
        // Fail closed: without the shared secret no announcement can be trusted.
        if (!secret) {
          return Response.json({ error: "not_configured" }, { status: 500, headers: CORS });
        }
        const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
        if (!safeEqual(request.headers.get("x-manara-signature") ?? "", expected)) {
          return Response.json({ error: "invalid_signature" }, { status: 401, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: project } = await supabaseAdmin
          .from("manara_projects")
          .select("id, current_address_id")
          .eq("project_key", key)
          .maybeSingle();

        if (!project) {
          return Response.json({ error: "not_found" }, { status: 404, headers: CORS });
        }

        const url = typeof body["url"] === "string" ? body["url"] : null;
        const host = typeof body["host"] === "string" ? body["host"] : null;
        const port = typeof body["port"] === "number" ? Math.trunc(body["port"]) : null;
        const kind = typeof body["kind"] === "string" ? body["kind"] : "web";

        if (url && host) {
          const { data: existing } = await supabaseAdmin
            .from("manara_addresses")
            .select("id")
            .eq("project_id", project.id)
            .eq("url", url)
            .maybeSingle();
          if (!existing) {
            await supabaseAdmin.from("manara_addresses").insert({
              project_id: project.id,
              url,
              host,
              port,
              kind,
              is_current: false,
              is_verified: false,
            });
          }
        }

        await supabaseAdmin.from("manara_events").insert({
          project_id: project.id,
          kind: "announce",
          message: `إعلان وارد من ${host || url || key}`,
          metadata: body as never,
        });

        return Response.json({ ok: true, key, acknowledged: true }, { headers: CORS });
      },
    },
  },
});
