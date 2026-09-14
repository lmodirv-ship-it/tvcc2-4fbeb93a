import { createFileRoute } from "@tanstack/react-router";

/** تقرير مسح السيرفر: أي مواقع موجودة فعلاً عليه. POST + x-tvcc-secret */
export const Route = createFileRoute("/api/public/backups/scan-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-tvcc-secret") ?? "";
        const envSecret = process.env["NIGHTLY_BACKUP_SECRET"] ?? "";
        if (!provided || !envSecret || provided !== envSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          destination_id?: string;
          hostname?: string;
          sites?: Array<{ domain: string; source?: string; doc_root?: string; port?: number; details?: unknown }>;
          services?: unknown;
          ports?: unknown;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: dest } = await admin
          .from("backup_destinations")
          .select("id, owner_id, host, storage_server_id")
          .eq("id", body.destination_id ?? "")
          .maybeSingle();
        if (!dest) return new Response("Destination not found", { status: 404 });

        // سيرفر المسح: المخصّص للوجهة، أو مطابقة الاسم/العنوان
        let serverId: string | null = dest.storage_server_id ?? null;
        if (!serverId) {
          const { data: servers } = await admin
            .from("servers")
            .select("id, hostname, public_ip, private_ip")
            .eq("owner_id", dest.owner_id)
            .limit(500);
          const host = String(dest.host ?? "").trim();
          const hit = ((servers as any[]) ?? []).find(
            (s) =>
              s.hostname === body.hostname ||
              s.hostname === host ||
              s.public_ip === host ||
              s.private_ip === host,
          );
          serverId = hit?.id ?? null;
        }

        const sites = (body.sites ?? []).filter((s) => s?.domain);
        if (sites.length) {
          await admin.from("server_site_scans").insert(
            sites.map((s) => ({
              owner_id: dest.owner_id,
              server_id: serverId,
              host: body.hostname ?? dest.host,
              domain: s.domain,
              source: s.source ?? null,
              doc_root: s.doc_root ?? null,
              port: s.port ?? null,
              details: { ...(s.details as object ?? {}), services: body.services ?? [], ports: body.ports ?? [] },
            })),
          );
        }

        // ربط الموقع بالسيرفر عندما يكون غير مربوط
        let linked = 0;
        if (serverId && sites.length) {
          const domains = sites.map((s) => s.domain);
          const { data: matches } = await admin
            .from("websites")
            .select("id, domain, server_id")
            .eq("owner_id", dest.owner_id)
            .in("domain", domains);
          for (const w of ((matches as any[]) ?? []).filter((w) => !w.server_id)) {
            await admin.from("websites").update({ server_id: serverId }).eq("id", w.id);
            linked += 1;
          }
        }

        return Response.json({ ok: true, scanned: sites.length, linked, server_id: serverId });
      },
    },
  },
});
