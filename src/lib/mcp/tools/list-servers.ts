import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_servers",
  title: "List servers",
  description: "List the user's VPS servers with status, OS and last heartbeat time.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx) as any;
    const { data, error } = await supabase
      .from("servers")
      .select("id, name, hostname, provider, region, os, status, last_seen_at, agent_version")
      .order("name");
    if (error) return fail(error.message);
    return ok({ count: data?.length ?? 0, servers: data ?? [] });
  },
});
