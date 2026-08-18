import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "update_website",
  title: "Update a website",
  description:
    "Update the display name, description or active state of an existing website, identified by its exact domain.",
  inputSchema: {
    domain: z.string().min(1).describe("Exact domain of the website to update."),
    name: z.string().optional().describe("New display name."),
    description: z.string().optional().describe("New description."),
    is_active: z.boolean().optional().describe("Activate or deactivate the website."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  needsApproval: true,
  handler: async ({ domain, name, description, is_active }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (is_active !== undefined) patch.is_active = is_active;
    if (Object.keys(patch).length === 0) return fail("Nothing to update: provide name, description or is_active.");

    const { data, error } = await supabaseForUser(ctx)
      .from("websites")
      .update(patch)
      .eq("domain", domain)
      .select("id, name, domain, description, is_active")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail(`No website found for domain "${domain}".`);
    return ok(data);
  },
});
