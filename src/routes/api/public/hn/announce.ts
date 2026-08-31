import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";

// TVCC is the HN group hub: HN Service Hub forwards identity "connect" signals here.
// Auth: header `x-hn-signature: sha256=<hex>` = HMAC-SHA256(HN_HUB_VERIFICATION_SALT, raw body).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-hn-signature",
};

const CODE_RE = /^[A-Z][0-9]{6}$/;

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const Route = createFileRoute("/api/public/hn/announce")({
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

        const code = String(body["code"] ?? "").trim().toUpperCase();
        if (!CODE_RE.test(code)) {
          return Response.json({ error: "invalid_code" }, { status: 400, headers: CORS });
        }

        const secret = process.env["HN_HUB_VERIFICATION_SALT"];
        let signatureValid = false;
        if (secret) {
          const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
          signatureValid = safeEqual(request.headers.get("x-hn-signature") ?? "", expected);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const origin = typeof body["origin"] === "string" ? (body["origin"] as string).slice(0, 300) : null;
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "";
        const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
        const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300) || null;

        const { data: existing } = await supabaseAdmin
          .from("hn_group_identities")
          .select("id, status, signal_count, last_signal_at")
          .eq("code", code)
          .maybeSingle();

        if (existing?.status === "revoked") {
          return Response.json({ error: "revoked", code }, { status: 403, headers: CORS });
        }

        // simple rate limit: one accepted signal per code / 10s
        if (existing?.last_signal_at && Date.now() - new Date(existing.last_signal_at).getTime() < 10_000) {
          return Response.json({ error: "rate_limited", code }, { status: 429, headers: CORS });
        }

        if (secret && !signatureValid) {
          await supabaseAdmin.from("hn_group_identity_signals").insert({
            identity_id: existing?.id ?? null,
            code,
            origin,
            ip_hash: ipHash,
            user_agent: userAgent,
            signature_valid: false,
            payload: body as never,
          });
          return Response.json({ error: "invalid_signature" }, { status: 401, headers: CORS });
        }

        const patch = {
          code,
          service_name:
            typeof body["service_name"] === "string" ? (body["service_name"] as string).slice(0, 200) : null,
          service_number:
            typeof body["service_number"] === "number" ? Math.trunc(body["service_number"] as number) : null,
          site_url: typeof body["site_url"] === "string" ? (body["site_url"] as string).slice(0, 400) : null,
          origin,
          hub_source: typeof body["hub"] === "string" ? (body["hub"] as string).slice(0, 120) : null,
          status: "connected",
          last_signal_at: new Date().toISOString(),
          signal_count: (existing?.signal_count ?? 0) + 1,
          metadata: (body["metadata"] ?? {}) as never,
        };

        const { data: identity, error } = await supabaseAdmin
          .from("hn_group_identities")
          .upsert(patch, { onConflict: "code" })
          .select("id, code, status")
          .single();

        if (error) {
          return Response.json({ error: "store_failed" }, { status: 500, headers: CORS });
        }

        await supabaseAdmin.from("hn_group_identity_signals").insert({
          identity_id: identity.id,
          code,
          origin,
          ip_hash: ipHash,
          user_agent: userAgent,
          signature_valid: secret ? signatureValid : false,
          payload: body as never,
        });

        return Response.json(
          { ok: true, code: identity.code, status: identity.status, tvcc: "acknowledged" },
          { headers: CORS },
        );
      },
    },
  },
});
