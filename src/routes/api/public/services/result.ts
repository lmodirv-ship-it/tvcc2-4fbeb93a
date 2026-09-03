import { createFileRoute } from "@tanstack/react-router";
import { deliverResultToRequester, resolveGroupToken } from "@/lib/exchange.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

/** الموقع المنفّذ يعيد النتيجة إلى TVCC، وTVCC يسلّمها للموقع الطالب. */
export const Route = createFileRoute("/api/public/services/result")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const header = request.headers.get("authorization") ?? "";
        const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
        const ownerId = await resolveGroupToken(token);
        if (!ownerId) return Response.json({ error: "invalid_token" }, { status: 401, headers: CORS });

        let body: { request_id?: string; ok?: boolean; result?: unknown; error?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: CORS });
        }
        if (!body.request_id) {
          return Response.json({ error: "request_id_required" }, { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("service_requests")
          .select("id, owner_id, callback_url, requester_domain, service_key")
          .eq("id", body.request_id)
          .eq("owner_id", ownerId)
          .maybeSingle();
        if (!row) return Response.json({ error: "not_found" }, { status: 404, headers: CORS });

        const success = body.ok !== false && !body.error;
        await supabaseAdmin
          .from("service_requests")
          .update({
            status: success ? "completed" : "failed",
            result: (body.result ?? null) as never,
            error_message: body.error ?? null,
          })
          .eq("id", row.id);

        let delivered = false;
        const callback =
          row.callback_url ||
          (row.requester_domain ? `https://${row.requester_domain}/api/public/services/result` : null);
        if (callback) {
          const r = await deliverResultToRequester(callback, {
            kind: "service.result",
            request_id: row.id,
            service_key: row.service_key,
            ok: success,
            result: body.result ?? null,
            error: body.error ?? null,
          });
          delivered = r.ok;
        }

        return Response.json(
          { ok: true, status: success ? "completed" : "failed", delivered },
          { headers: { ...CORS, "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
