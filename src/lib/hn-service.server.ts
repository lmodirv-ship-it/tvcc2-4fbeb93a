import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type HnServiceCatalog = {
  generated_at: string;
  count: number;
  sites: {
    id: string;
    site_id: string | null;
    name: string | null;
    domain: string | null;
    frontend_domain: string | null;
    description: string | null;
    status: string | null;
    is_active: boolean | null;
    specialization: string | null;
    services: {
      id: string;
      name: string | null;
      service_type: string | null;
      description: string | null;
      endpoint_url: string | null;
      status: string | null;
      is_public: boolean | null;
      link_method: string | null;
      auth_type: string | null;
      port: number | null;
      health_path: string | null;
    }[];
  }[];
};

export async function buildHnServiceCatalog(ownerId: string): Promise<HnServiceCatalog> {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const supabaseAdmin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sites, error: sitesError } = await supabaseAdmin
    .from("websites")
    .select(
      "id, site_id, name, domain, frontend_domain, description, status, is_active, hn_db_connection_id, hn_cloud_storage_id, api_config_url, payments_provider_url"
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (sitesError) throw new Error(sitesError.message);

  const siteIds = (sites ?? []).map((s) => s.id);

  const { data: services, error: servicesError } = await supabaseAdmin
    .from("site_services")
    .select(
      "id, website_id, name, service_type, description, endpoint_url, status, is_public, link_method, auth_type, port, health_path"
    )
    .in("website_id", siteIds.length ? siteIds : ["00000000-0000-0000-0000-000000000000"]);

  if (servicesError) throw new Error(servicesError.message);

  const servicesBySite = new Map<string, typeof services>();
  for (const s of services ?? []) {
    const list = servicesBySite.get(s.website_id) ?? [];
    list.push(s);
    servicesBySite.set(s.website_id, list);
  }

  const specializationFromSite = (site: (typeof sites)[number]): string => {
    const parts: string[] = [];
    if (site.hn_db_connection_id) parts.push("HN-DB");
    if (site.hn_cloud_storage_id) parts.push("HN-Cloud");
    if (site.api_config_url) parts.push("API");
    if (site.payments_provider_url) parts.push("Payments");
    return parts.length ? parts.join(" + ") : "موقع TVCC عام";
  };

  return {
    generated_at: new Date().toISOString(),
    count: (sites ?? []).length,
    sites: (sites ?? []).map((site) => ({
      id: site.id,
      site_id: site.site_id,
      name: site.name,
      domain: site.domain,
      frontend_domain: site.frontend_domain,
      description: site.description,
      status: site.status,
      is_active: site.is_active,
      specialization: specializationFromSite(site),
      services: (servicesBySite.get(site.id) ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        service_type: s.service_type,
        description: s.description,
        endpoint_url: s.endpoint_url,
        status: s.status,
        is_public: s.is_public,
        link_method: s.link_method,
        auth_type: s.auth_type,
        port: s.port,
        health_path: s.health_path,
      })),
    })),
  };
}
