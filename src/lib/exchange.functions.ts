import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** تشغيل تصدير لائحة المواقع إلى مراكز المجموعة الآن. */
export const runHubExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { exportCatalogToHubs } = await import("@/lib/exchange.server");
    return exportCatalogToHubs(context.userId);
  });

export const listHubExports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("hub_exports")
      .select("id, hub_key, hub_url, sites_count, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const listServiceRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("service_requests")
      .select(
        "id, requester_domain, provider_domain, service_key, service_type, status, routed_by, error_message, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

/** إعادة توجيه طلب خدمة متعثّر عبر HN SRV. */
export const retryServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("service_requests")
      .select("id, service_key, service_type, payload, requester_domain")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("الطلب غير موجود");

    const { resolveProvider, dispatchToProvider } = await import("@/lib/exchange.server");
    const provider = await resolveProvider({
      ownerId: context.userId,
      serviceKey: row.service_key,
      serviceType: row.service_type,
      requesterDomain: row.requester_domain,
    });

    if (!provider.domain) {
      await context.supabase
        .from("service_requests")
        .update({ status: "failed", routed_by: provider.routed_by, error_message: "لم يُعثر على موقع مسؤول" })
        .eq("id", row.id);
      return { ok: false, reason: "provider_not_found" };
    }

    const dispatch = await dispatchToProvider(provider.domain, {
      id: row.id,
      service_key: row.service_key,
      service_type: row.service_type,
      payload: row.payload,
      requester_domain: row.requester_domain,
    });

    await context.supabase
      .from("service_requests")
      .update({
        provider_domain: provider.domain,
        provider_website_id: provider.website_id,
        routed_by: provider.routed_by,
        status: dispatch.ok ? "running" : "assigned",
        error_message: dispatch.ok ? null : `تعذّر تسليم الأمر (HTTP ${dispatch.status})`,
      })
      .eq("id", row.id);

    return { ok: dispatch.ok, provider: provider.domain, routed_by: provider.routed_by };
  });
