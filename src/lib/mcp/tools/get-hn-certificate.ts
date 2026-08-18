import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_hn_certificate",
  title: "Get HN.RLS certificate",
  description:
    "Read the HN.RLS certificate and project registration state for one managed domain: serial, status, validity window and fingerprint.",
  inputSchema: {
    domain: z.string().min(1).describe("Exact domain of the website, e.g. hn-db.fun"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ domain }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const normalized = domain.trim().toLowerCase();

    const { data: site, error: siteErr } = await supabase
      .from("websites")
      .select("id, name, domain, verified, hn_project_id, registration_status, registered_at")
      .eq("domain", normalized)
      .maybeSingle();
    if (siteErr) return fail(siteErr.message);
    if (!site) return fail(`No website found for domain "${domain}".`);

    const { data: cert, error: certErr } = await supabase
      .from("hn_certificates")
      .select("serial, status, verification_method, issued_at, expires_at, fingerprint")
      .eq("website_id", site.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (certErr) return fail(certErr.message);

    return ok({
      project: {
        name: site.name,
        domain: site.domain,
        domain_verified: site.verified,
        hn_project_id: site.hn_project_id,
        registration_status: site.registration_status,
        registered_at: site.registered_at,
      },
      certificate: cert ?? null,
    });
  },
});
