import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_service_links",
  title: "List service links",
  description:
    "List how the user's sites are wired together: site runtimes on servers, database links, port bridges and storage sync state.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx) as any;
    const [runtimes, dbs, links, storages] = await Promise.all([
      supabase.from("site_runtimes").select("domain, server_id, runtime_kind, port, status"),
      supabase.from("site_databases").select("website_id, server_id, db_engine, db_name, host, port, connection_kind, status"),
      supabase.from("port_links").select("source_server_id, source_port, target_host, target_port, bridge_kind, status"),
      supabase.from("storages").select("name, server_id, path, used_gb, watch_enabled, sync_status"),
    ]);
    const err = runtimes.error ?? dbs.error ?? links.error ?? storages.error;
    if (err) return fail(err.message);
    return ok({
      runtimes: runtimes.data ?? [],
      databases: dbs.data ?? [],
      port_links: links.data ?? [],
      storages: storages.data ?? [],
    });
  },
});
