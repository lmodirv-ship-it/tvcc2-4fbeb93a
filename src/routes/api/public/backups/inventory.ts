import { createFileRoute } from "@tanstack/react-router";

/** قائمة مواقع المالك لسكريبت سيرفر التخزين. POST + x-tvcc-secret */
export const Route = createFileRoute("/api/public/backups/inventory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-tvcc-secret") ?? "";
        const envSecret = process.env["NIGHTLY_BACKUP_SECRET"] ?? "";
        if (!provided || !envSecret || provided !== envSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as { destination_id?: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: dest } = await admin
          .from("backup_destinations")
          .select("id, owner_id, base_path, scope")
          .eq("id", body.destination_id ?? "")
          .maybeSingle();
        if (!dest) return new Response("Destination not found", { status: 404 });

        let q = admin
          .from("websites")
          .select("id, domain, server_id, verified")
          .eq("owner_id", dest.owner_id)
          .order("domain");
        if (dest.scope === "verified") q = q.eq("verified", true);
        const { data: sites } = await q;

        const rows = ((sites as any[]) ?? []).filter((s) => s.domain);
        return Response.json({
          ok: true,
          base_path: dest.base_path,
          count: rows.length,
          domains: rows.map((s) => s.domain),
          sites: rows,
        });
      },
    },
  },
});
