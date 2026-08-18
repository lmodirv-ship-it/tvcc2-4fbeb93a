import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_website",
  title: "Get website details",
  description: "Fetch the full record for one managed website, looked up by its exact domain.",
  inputSchema: {
    domain: z.string().min(1).describe("Exact domain, e.g. hn-db.fun"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ domain }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("websites")
      .select("*")
      .eq("domain", domain)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail(`No website found for domain "${domain}".`);
    return ok(data);
  },
});
