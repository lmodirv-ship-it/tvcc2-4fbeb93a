import { createFileRoute } from "@tanstack/react-router";

/**
 * خط الاتصال الحي بين سكريبت سيرفر التخزين والمنصة.
 * السكريبت يرسل نبضة كل 5 دقائق ← المنصة ترد بالتعليمات (المسار، المواقع، إعادة المسح).
 * POST + x-tvcc-secret
 */
export const Route = createFileRoute("/api/public/backups/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        const provided = request.headers.get("x-tvcc-secret") ?? "";
        const envSecret = process.env["NIGHTLY_BACKUP_SECRET"] ?? "";
        if (!provided || !envSecret || provided !== envSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          destination_id?: string;
          hostname?: string;
          base_path?: string;
          agent_version?: string;
          domains_count?: number;
          folders_count?: number;
          sites_found?: number;
          disk_total_gb?: number;
          disk_free_gb?: number;
          mem_total_mb?: number;
          mem_free_mb?: number;
          load_avg?: number;
          uptime_seconds?: number;
          note?: string;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: dest } = await admin
          .from("backup_destinations")
          .select("id, owner_id, base_path, scope, is_enabled, storage_server_id, host")
          .eq("id", body.destination_id ?? "")
          .maybeSingle();
        if (!dest) return new Response("Destination not found", { status: 404 });

        const row = {
          owner_id: dest.owner_id,
          destination_id: dest.id,
          hostname: body.hostname ?? dest.host ?? null,
          base_path: body.base_path ?? dest.base_path ?? null,
          agent_version: body.agent_version ?? null,
          status: "online",
          domains_count: body.domains_count ?? 0,
          folders_count: body.folders_count ?? 0,
          sites_found: body.sites_found ?? 0,
          disk_total_gb: body.disk_total_gb ?? null,
          disk_free_gb: body.disk_free_gb ?? null,
          mem_total_mb: body.mem_total_mb ?? null,
          mem_free_mb: body.mem_free_mb ?? null,
          load_avg: body.load_avg ?? null,
          uptime_seconds: body.uptime_seconds ?? null,
          latency_ms: Date.now() - started,
          payload: { note: body.note ?? null },
          last_ping_at: new Date().toISOString(),
        };

        const { data: existing } = await admin
          .from("storage_link_beacons")
          .select("id")
          .eq("destination_id", dest.id)
          .eq("hostname", row.hostname ?? "")
          .maybeSingle();

        if (existing?.id) {
          await admin.from("storage_link_beacons").update(row).eq("id", existing.id);
        } else {
          await admin.from("storage_link_beacons").insert(row);
        }

        // تحديث آخر نشاط للوجهة (بدون حذف أي شيء)
        await admin
          .from("backup_destinations")
          .update({ last_run_status: "linked", last_run_at: new Date().toISOString() })
          .eq("id", dest.id);

        // التعليمات المرسلة للسكريبت
        let q = admin
          .from("websites")
          .select("domain, verified")
          .eq("owner_id", dest.owner_id)
          .order("domain");
        if (dest.scope === "verified") q = q.eq("verified", true);
        const { data: sites } = await q;
        const domains = ((sites as any[]) ?? []).map((s) => s.domain).filter(Boolean);

        return Response.json({
          ok: true,
          server_time: new Date().toISOString(),
          interval_seconds: 300,
          base_path: dest.base_path,
          enabled: dest.is_enabled !== false,
          actions: {
            ensure_folders: true,
            scan: true,
            report: true,
          },
          domains,
          count: domains.length,
        });
      },
    },
  },
});
