import { createFileRoute } from "@tanstack/react-router";
import { dispatchToProvider, resolveGroupToken, resolveProvider } from "@/lib/exchange.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

/** موقع من المجموعة يطلب خدمة → تُسجَّل في مركز المهام وتُوجَّه عبر HN SRV. */
export const Route = createFileRoute("/api/public/services/request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const header = request.headers.get("authorization") ?? "";
        const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
        const ownerId = await resolveGroupToken(token);
        if (!ownerId) return Response.json({ error: "invalid_token" }, { status: 401, headers: CORS });

        let body: {
          service_key?: string;
          service_type?: string;
          requester_domain?: string;
          payload?: unknown;
          callback_url?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: CORS });
        }
        if (!body.service_key) {
          return Response.json({ error: "service_key_required" }, { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const requesterDomain = (body.requester_domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
        const { data: requester } = requesterDomain
          ? await supabaseAdmin
              .from("websites")
              .select("id")
              .eq("owner_id", ownerId)
              .eq("domain", requesterDomain)
              .maybeSingle()
          : { data: null };

        const { data: reqRow, error } = await supabaseAdmin
          .from("service_requests")
          .insert({
            owner_id: ownerId,
            requester_website_id: requester?.id ?? null,
            requester_domain: requesterDomain || null,
            service_key: body.service_key,
            service_type: body.service_type ?? null,
            payload: (body.payload ?? {}) as never,
            callback_url: body.callback_url ?? null,
            status: "routing",
          })
          .select("id")
          .single();
        if (error || !reqRow) {
          return Response.json({ error: error?.message ?? "insert_failed" }, { status: 500, headers: CORS });
        }

        const provider = await resolveProvider({
          ownerId,
          serviceKey: body.service_key,
          serviceType: body.service_type ?? null,
          requesterDomain: requesterDomain || null,
        });

        if (!provider.domain) {
          await supabaseAdmin
            .from("service_requests")
            .update({ status: "failed", routed_by: provider.routed_by, error_message: "لم يُعثر على موقع مسؤول عن الخدمة" })
            .eq("id", reqRow.id);
          return Response.json(
            { ok: false, request_id: reqRow.id, status: "failed", reason: "provider_not_found" },
            { status: 200, headers: CORS },
          );
        }

        const dispatch = await dispatchToProvider(provider.domain, {
          id: reqRow.id,
          service_key: body.service_key,
          service_type: body.service_type ?? null,
          payload: body.payload ?? {},
          requester_domain: requesterDomain || null,
        });

        await supabaseAdmin
          .from("service_requests")
          .update({
            provider_domain: provider.domain,
            provider_website_id: provider.website_id,
            routed_by: provider.routed_by,
            status: dispatch.ok ? "running" : "assigned",
            error_message: dispatch.ok ? null : `تعذّر تسليم الأمر (HTTP ${dispatch.status})`,
          })
          .eq("id", reqRow.id);

        return Response.json(
          {
            ok: true,
            request_id: reqRow.id,
            provider: provider.domain,
            routed_by: provider.routed_by,
            status: dispatch.ok ? "running" : "assigned",
          },
          { headers: { ...CORS, "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
