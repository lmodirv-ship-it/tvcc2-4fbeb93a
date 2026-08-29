import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint: run due backup schedules.
// Call with ?secret=<BACKUP_CRON_SECRET> or configure pg_cron to hit this URL.

export const Route = createFileRoute("/api/public/backups/run-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret") ?? "";
        const expected = process.env["BACKUP_CRON_SECRET"];
        if (!expected) return new Response("Not configured", { status: 500 });
        if (secret !== expected) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        // Simple cron matching: minute 0 of current hour if cron is "0 * * * *" etc.
        const now = new Date();
        const minute = now.getUTCMinutes();
        const hour = now.getUTCHours();
        const dom = now.getUTCDate();
        const month = now.getUTCMonth() + 1;
        const dow = now.getUTCDay();

        const { data: schedules } = await admin
          .from("backup_schedules")
          .select("*, websites(id, domain, server_id)")
          .eq("is_active", true);

        const due = (schedules as any[] ?? []).filter((s) => matchesCron(s.schedule, { minute, hour, dom, month, dow }));
        const results = [] as any[];

        for (const s of due) {
          const site = s.websites;
          if (!site?.server_id) {
            results.push({ schedule: s.id, status: "skipped", reason: "no_server" });
            continue;
          }
          const type = s.backup_type;
          const destPath = `${(s.dest_path ?? "/var/backups/tvcc").replace(/\/+$/, "")}/${site.domain}/${type}`;
          const { data: backup } = await admin
            .from("site_backups")
            .insert({
              owner_id: s.owner_id,
              website_id: s.website_id,
              server_id: site.server_id,
              target_server_id: s.target_server_id ?? null,
              dest_path: destPath,
              backup_type: type,
              label: `${site.domain} — scheduled ${now.toISOString().slice(0, 16)}`,
              status: "pending",
              is_latest: true,
            })
            .select("id")
            .maybeSingle();

          if (backup) {
            await admin
              .from("site_backups")
              .update({ is_latest: false })
              .eq("website_id", s.website_id)
              .eq("backup_type", type)
              .neq("id", backup.id);

            await admin.from("server_commands").insert({
              owner_id: s.owner_id,
              server_id: site.server_id,
              website_id: s.website_id,
              action: type === "database" ? "db_dump" : "site_backup",
              args: {
                domain: site.domain,
                backup_id: backup.id,
                backup_type: type,
                dest_path: destPath,
                target_server_id: s.target_server_id ?? null,
              },
              requested_by: s.owner_id,
              status: "pending",
            });
          }


          results.push({ schedule: s.id, backup: backup?.id, status: backup ? "queued" : "failed" });

          // Enforce retention
          const { data: oldBackups } = await admin
            .from("site_backups")
            .select("id")
            .eq("website_id", s.website_id)
            .eq("backup_type", type)
            .order("created_at", { ascending: false })
            .limit(1000);
          const toDelete = (oldBackups as any[] ?? []).slice(s.retention_count ?? 7);
          for (const ob of toDelete) {
            await admin.from("site_backups").update({ status: "pending_deletion" }).eq("id", ob.id);
          }
        }

        return Response.json({ ok: true, ran: results.length, results });
      },
    },
  },
});

function matchesCron(
  cron: string,
  t: { minute: number; hour: number; dom: number; month: number; dow: number },
): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [m, h, d, mo, dw] = parts;
  return fieldMatches(m, t.minute, 0, 59)
    && fieldMatches(h, t.hour, 0, 23)
    && fieldMatches(d, t.dom, 1, 31)
    && fieldMatches(mo, t.month, 1, 12)
    && fieldMatches(dw, t.dow, 0, 6);
}

function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [base, step] = part.split("/");
      const start = base === "*" ? min : Number(base);
      if (value >= start && (value - start) % Number(step) === 0) return true;
    } else if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (value >= start && value <= end) return true;
    } else if (Number(part) === value) {
      return true;
    }
  }
  return false;
}
