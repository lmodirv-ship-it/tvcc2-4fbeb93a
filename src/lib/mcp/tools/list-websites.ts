import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_websites",
  title: "List websites",
  description:
    "List the websites managed by the signed-in user, optionally filtered by a domain/name search term or active state.",
  inputSchema: {
    search: z.string().optional().describe("Filter by domain or name substring."),
    only_active: z.boolean().optional().describe("Return only active websites."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 50, max 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, only_active, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    let q = supabaseForUser(ctx)
      .from("websites")
      .select("id, name, domain, status, is_active, verified, frontend_domain, last_checked_at")
      .order("domain", { ascending: true })
      .limit(take);
    if (only_active) q = q.eq("is_active", true);
    if (search) q = q.or(`domain.ilike.%${search}%,name.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ count: data?.length ?? 0, websites: data ?? [] });
  },
});
