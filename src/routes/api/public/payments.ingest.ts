import { createFileRoute } from "@tanstack/react-router";

// Receives real-time payment/subscription events from https://hnpay-ai.lovable.app
// and fans them out to all sites in the HN group.
// Body: { event_type, external_id?, provider?, site_domain? | website_id?, owner_id?,
//         amount?, currency?, subscription?: { plan_name?, status?, starts_at?, ends_at? },
//         customer?: {...}, metadata?: {...} }

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-hnpay-signature, x-hnpay-key",
};

async function fanout(domain: string, payload: unknown) {
  const url = `https://${domain}/api/public/payments/ingest`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: { "content-type": "application/json", "x-hnpay-source": "hn-tvcc" },
      body: JSON.stringify(payload),
    });
    clearTimeout(t);
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message };
  }
}

export const Route = createFileRoute("/api/public/payments/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body: any = await request.json().catch(() => ({}));
          const {
            event_type = "payment.received",
            provider = "hnpay-ai",
            external_id = null,
            website_id = null,
            site_domain = null,
            owner_id = "e3066a24-8c0b-4cee-af2a-b2646ae6cfbc",
            amount = null,
            currency = null,
            subscription = null,
          } = body ?? {};

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Resolve website by id or domain
          let site: any = null;
          if (website_id) {
            const { data } = await supabaseAdmin.from("websites").select("id, domain, owner_id").eq("id", website_id).maybeSingle();
            site = data;
          } else if (site_domain) {
            const { data } = await supabaseAdmin.from("websites").select("id, domain, owner_id").eq("domain", site_domain).maybeSingle();
            site = data;
          }
          const resolvedOwner = site?.owner_id ?? owner_id;

          // Update subscription state if provided
          let subscription_id: string | null = null;
          if (subscription && site) {
            const patch: any = {
              owner_id: resolvedOwner,
              website_id: site.id,
              plan_name: subscription.plan_name ?? "Pro",
              status: subscription.status ?? "active",
              price: amount ?? subscription.price ?? 0,
              currency: currency ?? subscription.currency ?? "USD",
              starts_at: subscription.starts_at ?? new Date().toISOString(),
              ends_at: subscription.ends_at ?? null,
            };
            const { data: sub } = await (supabaseAdmin as any)
              .from("subscriptions").insert(patch).select("id").maybeSingle();
            subscription_id = sub?.id ?? null;
          }

          // Fan-out to all active sites (or just the target site if scoped)
          const { data: targets } = await supabaseAdmin
            .from("websites").select("id, domain").eq("is_active", true).limit(500);
          const list = site ? [site] : (targets ?? []);
          const results = await Promise.all(
            list.map((w: any) => fanout(w.domain, { ...body, source: "hnpay-ai", relayed_by: "hn-tvcc" }))
          );
          const delivered = results.filter((r) => r.ok).length;
          const failed = results.length - delivered;

          const { data: ev } = await (supabaseAdmin as any).from("payment_events").insert({
            owner_id: resolvedOwner,
            event_type,
            provider,
            website_id: site?.id ?? null,
            subscription_id,
            amount,
            currency,
            status: "processed",
            external_id,
            fanout_total: results.length,
            fanout_delivered: delivered,
            fanout_failed: failed,
            payload: body,
          }).select("id").maybeSingle();

          await (supabaseAdmin as any).from("activity_log").insert({
            owner_id: resolvedOwner,
            action: "payments.hnpay.ingest",
            entity_type: "payment_event",
            entity_id: ev?.id ?? null,
            details: { event_type, provider, delivered, failed, total: results.length },
          });

          return Response.json(
            { ok: true, event_id: ev?.id, fanout: { total: results.length, delivered, failed } },
            { headers: CORS },
          );
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "err" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});