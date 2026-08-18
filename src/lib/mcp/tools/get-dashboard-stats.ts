import { defineTool } from "@lovable.dev/mcp-js";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_dashboard_stats",
  title: "Get dashboard stats",
  description:
    "Summary counters for the signed-in user's control panel: websites, active websites, groups, domains and active subscriptions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const head = { count: "exact" as const, head: true };

    const [sites, active, groups, domains, subs] = await Promise.all([
      supabase.from("websites").select("id", head),
      supabase.from("websites").select("id", head).eq("is_active", true),
      supabase.from("site_groups").select("id", head),
      supabase.from("domains").select("id", head),
      supabase.from("subscriptions").select("id", head).eq("status", "active"),
    ]);

    const firstError = [sites, active, groups, domains, subs].find((r) => r.error)?.error;
    if (firstError) return fail(firstError.message);

    return ok({
      websites: sites.count ?? 0,
      active_websites: active.count ?? 0,
      site_groups: groups.count ?? 0,
      domains: domains.count ?? 0,
      active_subscriptions: subs.count ?? 0,
    });
  },
});
