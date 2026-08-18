import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_site_groups",
  title: "List site groups",
  description:
    "List the user's website groups. Optionally include the member websites of each group.",
  inputSchema: {
    include_members: z.boolean().optional().describe("Include the websites belonging to each group."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_members }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: groups, error } = await supabase
      .from("site_groups")
      .select("id, name, description, color, icon, created_at")
      .order("name");
    if (error) return fail(error.message);
    if (!include_members) return ok({ count: groups?.length ?? 0, groups: groups ?? [] });

    const { data: members, error: mErr } = await supabase
      .from("website_group_members")
      .select("group_id, websites(domain, name)");
    if (mErr) return fail(mErr.message);

    const byGroup = new Map<string, unknown[]>();
    for (const m of (members ?? []) as Array<{ group_id: string; websites: unknown }>) {
      const list = byGroup.get(m.group_id) ?? [];
      if (m.websites) list.push(m.websites);
      byGroup.set(m.group_id, list);
    }
    return ok({
      count: groups?.length ?? 0,
      groups: (groups ?? []).map((g) => ({ ...g, members: byGroup.get(g.id) ?? [] })),
    });
  },
});
