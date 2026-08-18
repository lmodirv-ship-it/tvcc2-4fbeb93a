import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
};

export const Route = createFileRoute("/api/public/hn-rls/verify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const domain = (url.searchParams.get("domain") ?? "")
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "")
          .trim()
          .toLowerCase();
        const serial = (url.searchParams.get("serial") ?? "").trim().toUpperCase();

        if (!domain && !serial) {
          return Response.json(
            { valid: false, error: "missing domain or serial" },
            { status: 400, headers: corsHeaders },
          );
        }
        if (domain && !/^[a-z0-9.-]{3,253}$/.test(domain)) {
          return Response.json(
            { valid: false, error: "invalid domain" },
            { status: 400, headers: corsHeaders },
          );
        }
        if (serial && !/^HN-RLS-\d{4}-[0-9A-F]{6}$/.test(serial)) {
          return Response.json(
            { valid: false, error: "invalid serial" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Only non-sensitive fields are ever projected here: no owner, no signature.
        let query = supabaseAdmin
          .from("hn_certificates")
          .select("serial, domain, status, issued_at, expires_at, fingerprint, verification_method")
          .order("issued_at", { ascending: false })
          .limit(1);
        query = serial ? query.eq("serial", serial) : query.eq("domain", domain);

        const { data, error } = await query.maybeSingle();
        if (error) {
          return Response.json(
            { valid: false, error: "lookup_failed" },
            { status: 500, headers: corsHeaders },
          );
        }
        if (!data) {
          return Response.json(
            { valid: false, status: "not_found" },
            { status: 404, headers: corsHeaders },
          );
        }

        const expired = new Date(data.expires_at).getTime() <= Date.now();
        const status = data.status === "active" && expired ? "expired" : data.status;

        return Response.json(
          {
            valid: status === "active",
            issuer: "HN Network Registry (HN.RLS)",
            serial: data.serial,
            domain: data.domain,
            status,
            verification_method: data.verification_method,
            issued_at: data.issued_at,
            expires_at: data.expires_at,
            fingerprint: data.fingerprint,
          },
          { status: 200, headers: corsHeaders },
        );
      },
    },
  },
});
