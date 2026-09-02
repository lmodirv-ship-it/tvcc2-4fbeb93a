import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/manara/resolve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = String(url.searchParams.get("key") || "").trim().toUpperCase();
        if (!/^ID\d{5,}$/.test(key)) {
          return Response.json({ error: "invalid_key" }, { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: project } = await supabaseAdmin
          .from("manara_projects")
          .select("id, project_key, name, current_address:current_address_id(url, host, port, kind, is_verified)")
          .eq("project_key", key)
          .eq("status", "active")
          .maybeSingle();

        if (!project || !project.current_address) {
          return Response.json({ error: "not_found" }, { status: 404, headers: CORS });
        }

        const addr = project.current_address as any;
        const { data: endpoints } = await supabaseAdmin
          .from("manara_endpoints")
          .select("kind, label, url, version, status")
          .eq("project_id", project.id)
          .in("status", ["active", "online", "pending"]);

        return Response.json(
          {
            ok: true,
            key: project.project_key,
            name: project.name,
            current: {
              url: addr.url,
              host: addr.host,
              port: addr.port,
              kind: addr.kind,
              verified: addr.is_verified,
            },
            endpoints: endpoints ?? [],
            etag: `${key}-${Date.now().toString(36)}`,
          },
          { headers: CORS },
        );
      },
    },
  },
});
