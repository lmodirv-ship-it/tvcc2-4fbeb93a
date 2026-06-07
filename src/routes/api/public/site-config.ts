import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/site-config")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const domain = (url.searchParams.get("domain") || "").trim().toLowerCase();
        const siteId = (url.searchParams.get("site_id") || "").trim();

        if (!domain && !siteId) {
          return Response.json(
            { error: "missing domain or site_id" },
            { status: 400, headers: corsHeaders },
          );
        }

        const query = supabaseAdmin
          .from("websites")
          .select(
            "id, site_id, name, domain, frontend_domain, status, is_active, hn_db_connection_id, hn_cloud_storage_id, api_config_url, android_enabled, android_latest_version, android_version_code, android_apk_url, android_status, android_updated_at",
          )
          .limit(1);

        const { data, error } = siteId
          ? await query.eq("site_id", siteId).maybeSingle()
          : await query.or(`frontend_domain.eq.${domain},domain.eq.${domain}`).maybeSingle();

        if (error) {
          return Response.json(
            { error: "lookup_failed" },
            { status: 500, headers: corsHeaders },
          );
        }
        if (!data || !data.is_active) {
          return Response.json(
            { error: "not_found" },
            { status: 404, headers: corsHeaders },
          );
        }

        return Response.json(
          {
            site: {
              site_id: data.site_id,
              name: data.name,
              domain: data.domain,
              frontend_domain: data.frontend_domain,
              status: data.status,
            },
            database: {
              connection_id: data.hn_db_connection_id,
              configured: !!data.hn_db_connection_id,
            },
            storage: {
              storage_id: data.hn_cloud_storage_id,
              configured: !!data.hn_cloud_storage_id,
            },
            api_config_url: data.api_config_url,
            android: data.android_enabled
              ? {
                  enabled: true,
                  version: data.android_latest_version,
                  version_code: data.android_version_code,
                  apk_url: data.android_apk_url,
                  status: data.android_status,
                  updated_at: data.android_updated_at,
                }
              : { enabled: false },
          },
          { headers: corsHeaders },
        );
      },
    },
  },
});
