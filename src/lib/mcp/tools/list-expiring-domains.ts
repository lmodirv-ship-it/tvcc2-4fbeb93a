import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_expiring_domains",
  title: "List expiring domains",
  description:
    "List registered domains whose registration expires within a given number of days, soonest first.",
  inputSchema: {
    within_days: z.number().int().optional().describe("Look-ahead window in days (default 60)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ within_days }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const days = Math.min(Math.max(within_days ?? 60, 1), 1095);
    const cutoff = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await supabaseForUser(ctx)
      .from("domains")
      .select("domain, registrar, expires_at, auto_renew, ssl_status, dns_status")
      .not("expires_at", "is", null)
      .lte("expires_at", cutoff)
      .order("expires_at", { ascending: true });
    if (error) return fail(error.message);
    return ok({ within_days: days, count: data?.length ?? 0, domains: data ?? [] });
  },
});
