import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_website",
  title: "Add a website",
  description: "Register a new website in the control panel for the signed-in user.",
  inputSchema: {
    domain: z.string().min(1).describe("Domain to register, e.g. example.com"),
    name: z.string().optional().describe("Display name. Defaults to the domain."),
    description: z.string().optional().describe("Short description of the site."),
    is_active: z.boolean().optional().describe("Whether the site is active (default true)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ domain, name, description, is_active }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("websites")
      .insert({
        owner_id: ctx.getUserId(),
        domain,
        name: name ?? domain,
        description: description ?? null,
        is_active: is_active ?? true,
      })
      .select("id, name, domain, is_active, status")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data);
  },
});
