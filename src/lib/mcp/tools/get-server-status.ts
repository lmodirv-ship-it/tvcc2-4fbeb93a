import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_server_status",
  title: "Get server status",
  description:
    "Get one server's latest resource metrics (CPU, memory, disk, load, uptime), the services its agent discovered, and the websites hosted on it.",
  inputSchema: {
    server_id: z.string().optional().describe("Server UUID."),
    hostname: z.string().optional().describe("Server hostname or IP, used when server_id is unknown."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ server_id, hostname }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    if (!server_id && !hostname) return fail("Provide server_id or hostname.");
    const supabase = supabaseForUser(ctx) as any;

    let q = supabase.from("servers").select("*").limit(1);
    q = server_id ? q.eq("id", server_id) : q.eq("hostname", hostname);
    const { data: server, error } = await q.maybeSingle();
    if (error) return fail(error.message);
    if (!server) return fail("Server not found.");

    const [{ data: metrics }, { data: agentSites }, { data: websites }] = await Promise.all([
      supabase
        .from("server_metrics")
        .select("*")
        .eq("server_id", server.id)
        .order("collected_at", { ascending: false })
        .limit(1),
      supabase.from("server_sites").select("name, domain, port, status, service_kind").eq("server_id", server.id),
      supabase.from("websites").select("id, name, domain, status").eq("server_id", server.id),
    ]);

    return ok({
      server: {
        id: server.id,
        name: server.name,
        hostname: server.hostname,
        status: server.status,
        os: server.os,
        last_seen_at: server.last_seen_at,
      },
      latest_metrics: metrics?.[0] ?? null,
      agent_services: agentSites ?? [],
      websites: websites ?? [],
    });
  },
});
