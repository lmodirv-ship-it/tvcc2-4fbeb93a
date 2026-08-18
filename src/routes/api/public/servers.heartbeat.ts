import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { deriveAgentToken, signBody } from "@/lib/agent-token";

// Agent -> TVCC heartbeat.
// Headers: x-tvcc-server: <server uuid>, x-tvcc-signature: sha256=<hex HMAC(agentToken, rawBody)>
// Body: {
//   cpu_percent?, mem_used_mb?, mem_total_mb?, disk_used_gb?, disk_total_gb?,
//   load_avg?, uptime_seconds?, process_count?, os?, agent_version?,
//   sites?: [{ name, domain?, port?, status?, service_kind? }],
//   ai_models?: [{ model_id, name?, size_mb?, context_window? }],
//   ai_endpoint?: string
// }

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-tvcc-server, x-tvcc-signature",
};

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export const Route = createFileRoute("/api/public/servers/heartbeat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const secret = process.env["SERVERS_INGEST_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500, headers: CORS });

        const serverId = request.headers.get("x-tvcc-server") ?? "";
        const sigHeader = request.headers.get("x-tvcc-signature") ?? "";
        const raw = await request.text();

        if (!/^[0-9a-f-]{36}$/i.test(serverId)) {
          return new Response("Invalid server id", { status: 400, headers: CORS });
        }

        const token = deriveAgentToken(secret, serverId);
        const expected = `sha256=${signBody(token, raw)}`;
        if (!safeEqual(sigHeader, expected)) {
          return new Response("Invalid signature", { status: 401, headers: CORS });
        }

        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: server } = await admin
          .from("servers")
          .select("id, owner_id")
          .eq("id", serverId)
          .maybeSingle();
        if (!server) return new Response("Unknown server", { status: 404, headers: CORS });

        const now = new Date().toISOString();
        const cpu = num(body.cpu_percent);
        const memUsed = num(body.mem_used_mb);
        const memTotal = num(body.mem_total_mb);
        const diskUsed = num(body.disk_used_gb);
        const diskTotal = num(body.disk_total_gb);

        const worst = Math.max(
          cpu ?? 0,
          memTotal ? ((memUsed ?? 0) / memTotal) * 100 : 0,
          diskTotal ? ((diskUsed ?? 0) / diskTotal) * 100 : 0,
        );

        const publicIp = typeof body.public_ip === "string" ? body.public_ip.slice(0, 64) : null;
        const agentVersion = typeof body.agent_version === "string" ? body.agent_version.slice(0, 32) : null;

        // Track IP changes
        if (publicIp) {
          const { data: prev } = await admin
            .from("servers")
            .select("public_ip")
            .eq("id", serverId)
            .maybeSingle();
          if ((prev as any)?.public_ip !== publicIp) {
            await admin.from("server_ip_history").insert({
              owner_id: server.owner_id,
              server_id: serverId,
              public_ip: publicIp,
              detected_at: now,
            });
          }
        }

        await admin
          .from("servers")
          .update({
            status: worst >= 90 ? "warning" : "online",
            last_seen_at: now,
            agent_version: agentVersion,
            public_ip: publicIp,
            os: typeof body.os === "string" ? body.os : undefined,
            metadata: {
              ai_endpoint: typeof body.ai_endpoint === "string" ? body.ai_endpoint : null,
              ai_models: Array.isArray(body.ai_models) ? body.ai_models.slice(0, 100) : [],
            },
          })
          .eq("id", serverId);

        await admin.from("server_metrics").insert({
          owner_id: server.owner_id,
          server_id: serverId,
          cpu_percent: cpu,
          mem_used_mb: memUsed,
          mem_total_mb: memTotal,
          disk_used_gb: diskUsed,
          disk_total_gb: diskTotal,
          load_avg: num(body.load_avg),
          uptime_seconds: num(body.uptime_seconds),
          process_count: num(body.process_count),
          collected_at: now,
        });

        const sites = Array.isArray(body.sites) ? body.sites.slice(0, 200) : [];
        for (const s of sites as Array<Record<string, unknown>>) {
          if (typeof s?.name !== "string" || !s.name) continue;
          await admin.from("server_sites").upsert(
            {
              owner_id: server.owner_id,
              server_id: serverId,
              name: s.name.slice(0, 120),
              domain: typeof s.domain === "string" ? s.domain.slice(0, 200) : null,
              port: num(s.port),
              status: typeof s.status === "string" ? s.status.slice(0, 32) : "unknown",
              service_kind: typeof s.service_kind === "string" ? s.service_kind.slice(0, 40) : null,
              last_seen_at: now,
            },
            { onConflict: "server_id,name" },
          );
        }

        // Open ports discovered by the agent
        const ports = Array.isArray(body.ports) ? body.ports.slice(0, 300) : [];
        for (const p of ports as Array<Record<string, unknown>>) {
          const port = num(p?.port);
          if (!port) continue;
          await admin.from("server_ports").upsert(
            {
              owner_id: server.owner_id,
              server_id: serverId,
              port,
              protocol: typeof p.protocol === "string" ? p.protocol.slice(0, 8) : "tcp",
              address: typeof p.address === "string" ? p.address.slice(0, 64) : "*",
              process_name: typeof p.process_name === "string" ? p.process_name.slice(0, 80) : null,
              service: typeof p.service === "string" ? p.service.slice(0, 80) : null,
              is_public: typeof p.address === "string" ? !/^(127\.|::1|localhost)/.test(p.address) : false,
              last_seen_at: now,
            },
            { onConflict: "server_id,port,protocol,address" },
          );
        }

        // Config snapshots
        const configs = Array.isArray(body.configs) ? body.configs.slice(0, 20) : [];
        for (const c of configs as Array<Record<string, unknown>>) {
          if (typeof c?.path !== "string" || typeof c?.kind !== "string") continue;
          await admin.from("server_configs").upsert(
            {
              owner_id: server.owner_id,
              server_id: serverId,
              kind: c.kind.slice(0, 40),
              path: c.path.slice(0, 300),
              content: typeof c.content === "string" ? c.content.slice(0, 100000) : null,
              collected_at: now,
            },
            { onConflict: "server_id,kind,path" },
          );
        }

        // Command results reported by the agent
        const results = Array.isArray(body.command_results) ? body.command_results.slice(0, 20) : [];
        for (const r of results as Array<Record<string, unknown>>) {
          if (typeof r?.id !== "string") continue;
          const code = num(r.exit_code) ?? 0;
          const output = typeof r.output === "string" ? r.output.slice(0, 40000) : null;
          const { data: cmd } = await admin
            .from("server_commands")
            .update({
              status: code === 0 ? "done" : "failed",
              exit_code: code,
              output,
              completed_at: now,
            })
            .eq("id", r.id)
            .eq("server_id", serverId)
            .select("id, action, website_id, args")
            .maybeSingle();

          if (cmd) {
            await admin.from("operation_log").insert({
              owner_id: server.owner_id,
              scope: cmd.website_id ? "website" : "server",
              server_id: serverId,
              website_id: cmd.website_id,
              operation: cmd.action,
              title: `تنفيذ ${cmd.action} على السيرفر`,
              input: cmd.args ?? {},
              result: { exit_code: code, output: output?.slice(0, 4000) ?? "" },
              status: code === 0 ? "success" : "error",
              actor: "agent",
            });

            const backupId = (cmd.args as Record<string, unknown> | null)?.["backup_id"];
            if (typeof backupId === "string" && (cmd.action === "site_backup" || cmd.action === "db_dump")) {
              const pathMatch = output?.match(/(\/\S+\.(?:tar\.gz|sql\.gz))/);
              const sizeMatch = output?.match(/\((\d+)\s*MB\)/);
              await admin
                .from("site_backups")
                .update({
                  status: code === 0 ? "completed" : "failed",
                  storage_path: pathMatch?.[1] ?? null,
                  size_mb: sizeMatch ? Number(sizeMatch[1]) : null,
                  error_message: code === 0 ? null : output?.slice(0, 500) ?? null,
                  completed_at: now,
                })
                .eq("id", backupId);
            }
          }
        }

        // Hand back pending whitelisted commands for this server
        const { data: pending } = await admin
          .from("server_commands")
          .select("id, action, args")
          .eq("server_id", serverId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(5);

        if (pending?.length) {
          await admin
            .from("server_commands")
            .update({ status: "running", dispatched_at: now })
            .in(
              "id",
              (pending as Array<{ id: string }>).map((p) => p.id),
            );
        }

        return Response.json(
          { ok: true, received_at: now, commands: pending ?? [] },
          { headers: CORS },
        );
      },
    },
  },
});
