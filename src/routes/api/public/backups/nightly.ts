import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * المهمة الليلية: تُستدعى كل يوم 00:00 لتشغيل النسخ الكامل لكل وجهة مفعّلة.
 * POST /api/public/backups/nightly   Header: x-tvcc-secret: <NIGHTLY_BACKUP_SECRET>
 */

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/backups/nightly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provided = request.headers.get("x-tvcc-secret") ?? url.searchParams.get("secret") ?? "";
        if (!provided) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runNightlyBackupForDestination } = await import("@/lib/nightly-backup.server");
        const admin = supabaseAdmin as any;

        const envSecret = process.env["NIGHTLY_BACKUP_SECRET"] ?? "";
        let allowed = envSecret.length > 0 && safeEqual(provided, envSecret);
        if (!allowed) {
          const { data: ok } = await admin.rpc("verify_cron_secret", {
            _name: "nightly_backup",
            _secret: provided,
          });
          allowed = ok === true;
        }
        if (!allowed) return new Response("Unauthorized", { status: 401 });

        const { data: destinations } = await admin
          .from("backup_destinations")
          .select("id, owner_id, name, host, username, port, base_path, secret_id, is_enabled")
          .eq("is_enabled", true);

        const results = [];
        for (const dest of ((destinations as any[]) ?? [])) {
          try {
            results.push(await runNightlyBackupForDestination(admin, dest));
          } catch (e) {
            results.push({ destination_id: dest.id, error: (e as Error).message });
          }
        }

        return Response.json({ ok: true, destinations: results.length, results });
      },
    },
  },
});
