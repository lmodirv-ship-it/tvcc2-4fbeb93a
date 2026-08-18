import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint: re-evaluate server status and notify on stale heartbeats.
export const Route = createFileRoute("/api/public/servers/check-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret") ?? "";
        const expected = process.env["ALERT_CRON_SECRET"];
        if (!expected) return new Response("Not configured", { status: 500 });
        if (secret !== expected) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - 5 * 60000).toISOString();

        const { data: staleServers } = await admin
          .from("servers")
          .select("id, owner_id, name, hostname, public_ip, status, last_seen_at")
          .lt("last_seen_at", staleThreshold)
          .neq("status", "offline");

        const results = [] as any[];
        for (const s of staleServers as any[] ?? []) {
          await admin
            .from("servers")
            .update({ status: "offline" })
            .eq("id", s.id);

          // Create a synthetic alert for offline transition
          await admin.from("server_alert_history").insert({
            owner_id: s.owner_id,
            server_id: s.id,
            rule_id: null,
            metric: "heartbeat",
            threshold: 0,
            value: 0,
            severity: "critical",
            message: `السيرفر ${s.name} غير متصل — آخر heartbeat: ${s.last_seen_at ?? "never"}`,
            channels: ["ui"],
            resolved: false,
          });
          results.push({ server: s.id, status: "marked_offline" });
        }

        return Response.json({ ok: true, offline: results.length, results });
      },
    },
  },
});
