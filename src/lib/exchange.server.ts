import { buildHnServiceCatalog } from "@/lib/hn-service.server";

/** مراكز المجموعة التي تُصدَّر إليها لائحة المواقع يومياً. */
export const GROUP_HUBS = [
  { key: "cour", url: "https://cour.hnapps.store" },
  { key: "hn-srv", url: "https://www.srv.hn-groupe.org" },
] as const;

export const EXPORT_PATHS = [
  "/api/public/tvcc/catalog",
  "/api/public/sites/import",
  "/api/tvcc/catalog",
];

/** مسارات مُحدِّد الموقع المسؤول عن الخدمة داخل HN SRV. */
export const ROUTE_PATHS = ["/api/public/services/route", "/api/services/route"];

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** يتحقق من التوكن القادم من مواقع المجموعة ويعيد مالك السجل. */
export async function resolveGroupToken(token: string): Promise<string | null> {
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("external_integrations")
    .select("owner_id, token, service_key")
    .in("service_key", ["hn-service", "hn-srv", "cour"])
    .not("token", "is", null);
  const match = (data ?? []).find((r) => r.token && timingSafeEqual(r.token, token));
  return match?.owner_id ?? null;
}

async function postJson(url: string, body: unknown, token?: string | null) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* نص عادي */ }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "network_error" };
  } finally {
    clearTimeout(t);
  }
}

/** تصدير لائحة كل المواقع إلى مراكز المجموعة وتسجيل النتيجة. */
export async function exportCatalogToHubs(ownerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const catalog = await buildHnServiceCatalog(ownerId);

  const { data: integrations } = await supabaseAdmin
    .from("external_integrations")
    .select("service_key, url, token")
    .eq("owner_id", ownerId);

  const hubs = GROUP_HUBS.map((h) => {
    const match = (integrations ?? []).find(
      (i) => i.service_key === h.key || (i.url ?? "").includes(new URL(h.url).hostname),
    );
    return { key: h.key, url: (match?.url || h.url).replace(/\/+$/, ""), token: match?.token ?? null };
  });

  const payload = {
    source: "TVCC",
    base_url: "https://tvcc.hnpay.live",
    kind: "sites.catalog",
    ...catalog,
  };

  const results: { hub: string; ok: boolean; status: number; path?: string }[] = [];
  for (const hub of hubs) {
    let done: { ok: boolean; status: number; body: unknown; path?: string } | null = null;
    for (const path of EXPORT_PATHS) {
      const r = await postJson(`${hub.url}${path}`, payload, hub.token);
      if (r.ok) { done = { ...r, path }; break; }
      done = { ...r, path };
      if (r.status && r.status !== 404) break;
    }
    await supabaseAdmin.from("hub_exports").insert({
      owner_id: ownerId,
      hub_key: hub.key,
      hub_url: hub.url,
      sites_count: catalog.count,
      status: done?.ok ? "success" : "failed",
      response: (done?.body ?? null) as never,
      error_message: done?.ok ? null : `HTTP ${done?.status ?? 0}`,
    });
    results.push({ hub: hub.key, ok: !!done?.ok, status: done?.status ?? 0, path: done?.path });
  }

  return { sites: catalog.count, results };
}

/** يسأل HN SRV عن الموقع المسؤول عن الخدمة، ويرجع لحل محلي عند تعذّر ذلك. */
export async function resolveProvider(opts: {
  ownerId: string;
  serviceKey: string;
  serviceType?: string | null;
  requesterDomain?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: integration } = await supabaseAdmin
    .from("external_integrations")
    .select("url, token")
    .eq("owner_id", opts.ownerId)
    .in("service_key", ["hn-srv", "hn-service"])
    .limit(1)
    .maybeSingle();

  const base = (integration?.url || GROUP_HUBS[1].url).replace(/\/+$/, "");
  for (const path of ROUTE_PATHS) {
    const r = await postJson(
      `${base}${path}`,
      { service_key: opts.serviceKey, service_type: opts.serviceType ?? null, requester: opts.requesterDomain ?? null },
      integration?.token ?? null,
    );
    const body = r.body as { domain?: string; provider_domain?: string } | null;
    const domain = body?.provider_domain || body?.domain;
    if (r.ok && domain) {
      const { data: site } = await supabaseAdmin
        .from("websites")
        .select("id, domain")
        .eq("owner_id", opts.ownerId)
        .eq("domain", domain)
        .maybeSingle();
      return { routed_by: "hn-srv", domain, website_id: site?.id ?? null };
    }
    if (r.status && r.status !== 404) break;
  }

  // حل محلي: أول خدمة عامة مطابقة داخل كتالوج المجموعة
  const { data: services } = await supabaseAdmin
    .from("site_services")
    .select("website_id, name, service_type, status, is_public, endpoint_url, websites(domain, owner_id)")
    .or(`service_type.eq.${opts.serviceType ?? opts.serviceKey},name.eq.${opts.serviceKey}`)
    .limit(20);

  const hit = (services ?? []).find(
    (s) => (s as { websites?: { owner_id?: string } }).websites?.owner_id === opts.ownerId,
  );
  if (hit) {
    const w = (hit as { websites?: { domain?: string } }).websites;
    return { routed_by: "tvcc-local", domain: w?.domain ?? null, website_id: hit.website_id };
  }
  return { routed_by: "unresolved", domain: null, website_id: null };
}

/** يرسل الأمر إلى الموقع المنفّذ. */
export async function dispatchToProvider(providerDomain: string, request: {
  id: string; service_key: string; service_type?: string | null; payload: unknown; requester_domain?: string | null;
}) {
  const base = `https://${providerDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const body = {
    kind: "service.execute",
    request_id: request.id,
    service_key: request.service_key,
    service_type: request.service_type ?? null,
    requester: request.requester_domain ?? null,
    payload: request.payload,
    result_callback: "https://tvcc.hnpay.live/api/public/services/result",
  };
  for (const path of ["/api/public/services/execute", "/api/public/core.ingest"]) {
    const r = await postJson(`${base}${path}`, body);
    if (r.ok) return { ok: true, status: r.status, path };
    if (r.status && r.status !== 404) return { ok: false, status: r.status, path };
  }
  return { ok: false, status: 0 };
}

export async function deliverResultToRequester(callbackUrl: string, body: unknown) {
  return postJson(callbackUrl, body);
}
