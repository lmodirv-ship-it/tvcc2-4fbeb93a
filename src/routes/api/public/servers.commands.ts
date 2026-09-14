import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { deriveAgentToken, signBody } from "@/lib/agent-token";
import { AGENT_VERSION } from "@/lib/agent-version";

/**
 * Fast task channel for the TVCC agent (separate from the 60s heartbeat).
 *
 * POST /api/public/servers/commands
 * Headers: x-tvcc-server, x-tvcc-signature: sha256=<hmac(agentToken, rawBody)>
 * Body: { results?: [{ id, exit_code, output, duration_ms? }], public_ip?, agent_version?, wait?: number }
 * Reply: { ok, commands: [...], capabilities: [...], agent_version, script_url, poll_after_ms }
 */

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function claimPending(admin: any, serverId: string) {
  const { data: pending } = await admin
    .from("server_commands")
    .select("id, action, args, dry_run")
    .eq("server_id", serverId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (pending?.length) {
    const now = new Date().toISOString();
    await admin
      .from("server_commands")
      .update({ status: "running", dispatched_at: now, started_at: now })
      .in("id", (pending as Array<{ id: string }>).map((p) => p.id));
  }

  // كلمات السر لا تُخزَّن في الأوامر — تُحقن فقط لحظة التسليم للوكيل.
  for (const cmd of ((pending as any[]) ?? [])) {
    const ref = cmd?.args?.secret_ref;
    if (!ref) continue;
    const { data: secret } = await admin
      .from("vault_secrets")
      .select("value_encrypted")
      .eq("id", ref)
      .maybeSingle();
    if (!secret?.value_encrypted) continue;
    try {
      const { decryptSecret } = await import("@/lib/vault-crypto.server");
      const [iv, ciphertext] = String(secret.value_encrypted).split(":");
      cmd.args = { ...cmd.args, target_password: decryptSecret(ciphertext, iv) };
      delete cmd.args.secret_ref;
    } catch {
      /* تجاهل سرّاً تعذّر فكّه */
    }
  }
  return pending ?? [];
}

export const Route = createFileRoute("/api/public/servers/commands")({
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
        if (!safeEqual(sigHeader, `sha256=${signBody(token, raw)}`)) {
          return new Response("Invalid signature", { status: 401, headers: CORS });
        }

        let body: Record<string, unknown> = {};
        try {
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: server } = await admin
          .from("servers")
          .select("id, owner_id, public_ip")
          .eq("id", serverId)
          .maybeSingle();
        if (!server) return new Response("Unknown server", { status: 404, headers: CORS });

        const now = new Date().toISOString();
        const agentVersion =
          typeof body.agent_version === "string" ? body.agent_version.slice(0, 32) : null;
        const publicIp = typeof body.public_ip === "string" ? body.public_ip.slice(0, 64) : null;

        // --- 1. Results reported by the agent ------------------------------
        const results = Array.isArray(body.results) ? body.results.slice(0, 20) : [];
        for (const r of results as Array<Record<string, unknown>>) {
          if (typeof r?.id !== "string") continue;
          const code = typeof r.exit_code === "number" ? r.exit_code : 0;
          const output = typeof r.output === "string" ? r.output.slice(0, 40000) : null;
          const duration = typeof r.duration_ms === "number" ? Math.round(r.duration_ms) : null;

          const { data: cmd } = await admin
            .from("server_commands")
            .update({
              status: code === 0 ? "done" : "failed",
              exit_code: code,
              output,
              completed_at: now,
              finished_at: now,
              duration_ms: duration,
              progress: null,
            })
            .eq("id", r.id)
            .eq("server_id", serverId)
            .select("id, action, website_id, args, job_id")
            .maybeSingle();

          if (!cmd) continue;

          const args = (cmd.args ?? {}) as Record<string, unknown>;
          const websiteId = cmd.website_id ?? (typeof args.website_id === "string" ? args.website_id : null);
          const databaseId = typeof args.database_id === "string" ? args.database_id : null;
          const historyId = typeof args.history_id === "string" ? args.history_id : null;
          if (historyId) {
            await admin.from("query_history").update({
              status: code === 0 ? "completed" : "failed",
              success_count: code === 0 ? 1 : 0,
              failed_count: code === 0 ? 0 : 1,
              took_ms: duration,
              results: code === 0 ? { output: output?.slice(0, 30000) ?? "" } : null,
              error: code === 0 ? null : output?.slice(0, 4000) ?? "Agent command failed",
              finished_at: now,
            }).eq("id", historyId);
          }
          if (databaseId) {
            const discovery = cmd.action === "db_discover" && code === 0;
            await admin.from("databases").update({
              pairing_status: discovery ? "connected" : undefined,
              status: discovery ? "online" : undefined,
              agent_last_seen_at: now,
              last_error: code === 0 ? null : output?.slice(0, 2000),
              last_sync_at: cmd.action === "db_sync" && code === 0 ? now : undefined,
            }).eq("id", databaseId);
            await admin.from("db_connections").update({
              status: discovery ? "connected" : code === 0 ? "available" : "error",
              last_seen_at: now,
              last_latency_ms: duration,
              last_error: code === 0 ? null : output?.slice(0, 2000),
              pairing_code_hash: discovery ? null : undefined,
              pairing_expires_at: discovery ? null : undefined,
            }).eq("database_id", databaseId);
          }
          if (cmd.action === "site_archive" && typeof args.destination_id === "string") {
            const kb = Number(/size_kb=(\d+)/.exec(output ?? "")?.[1] ?? 0);
            await admin
              .from("site_backup_copies")
              .update({
                status: code === 0 ? "completed" : "failed",
                size_bytes: kb ? kb * 1024 : null,
                error_message: code === 0 ? null : output?.slice(0, 2000) ?? "فشل النسخ",
                completed_at: code === 0 ? now : null,
              })
              .eq("destination_id", args.destination_id)
              .eq("website_id", websiteId)
              .eq("copy_kind", String(args.kind ?? "current"));
          }
          if (cmd.action === "site_identity_provision" && websiteId && databaseId) {
            await admin.from("site_databases").update({
              provisioning_status: code === 0 ? "ready" : "failed",
              provisioned_at: code === 0 ? now : null,
              provisioning_error: code === 0 ? null : output?.slice(0, 2000),
              status: code === 0 ? "active" : "error",
            }).eq("website_id", websiteId).eq("database_id", databaseId);
          }

          await admin.from("operation_log").insert({
            owner_id: server.owner_id,
            scope: cmd.website_id ? "website" : "server",
            server_id: serverId,
            website_id: cmd.website_id,
            operation: cmd.action,
            title: `تنفيذ ${cmd.action} على السيرفر`,
            input: args,
            result: { exit_code: code, output: output?.slice(0, 4000) ?? "" },
            status: code === 0 ? "success" : "error",
            actor: "agent",
          });

          if (cmd.job_id) {
            await admin
              .from("agent_job_steps")
              .update({ status: code === 0 ? "done" : "failed", output, exit_code: code })
              .eq("command_id", cmd.id);
            const { data: steps } = await admin
              .from("agent_job_steps")
              .select("status")
              .eq("job_id", cmd.job_id);
            const all = (steps ?? []) as Array<{ status: string }>;
            const done = all.filter((s) => s.status === "done").length;
            const failed = all.some((s) => s.status === "failed");
            const finished = all.every((s) => ["done", "failed"].includes(s.status));
            await admin
              .from("agent_jobs")
              .update({
                progress: all.length ? Math.round((done / all.length) * 100) : 0,
                status: finished ? (failed ? "failed" : "done") : "running",
                finished_at: finished ? now : null,
              })
              .eq("id", cmd.job_id);
          }
        }

        // --- 2. Progress updates for long running commands -----------------
        const progress = Array.isArray(body.progress) ? body.progress.slice(0, 10) : [];
        for (const p of progress as Array<Record<string, unknown>>) {
          if (typeof p?.id !== "string") continue;
          await admin
            .from("server_commands")
            .update({ progress: String(p.text ?? "").slice(0, 500) })
            .eq("id", p.id)
            .eq("server_id", serverId);
        }

        // --- 3. Agent instance bookkeeping + IP change handling ------------
        // Multi-agent: each agent on a server has its own key + role (default main).
        const agentKey = typeof body.agent_key === "string" && /^[a-z0-9-]{1,40}$/i.test(body.agent_key)
          ? body.agent_key : "main";
        const agentRole = typeof body.agent_role === "string" && /^[a-z0-9-]{1,40}$/i.test(body.agent_role)
          ? body.agent_role : agentKey;
        const machineId = typeof body.machine_id === "string" ? body.machine_id.slice(0, 80) : null;
        if (machineId && !(server as any).machine_id) {
          await admin.from("servers").update({ machine_id: machineId }).eq("id", serverId);
        }
        await admin.from("agent_instances").upsert(
          {
            owner_id: server.owner_id,
            server_id: serverId,
            agent_key: agentKey,
            role: agentRole,
            agent_id: typeof body.agent_id === "string" ? body.agent_id.slice(0, 64) : null,
            agent_version: agentVersion,
            os: typeof body.os === "string" ? body.os.slice(0, 120) : null,
            status: "online",
            last_poll_at: now,
            verified_at: now, // signature was verified above
            machine_id: machineId,
            net_rx_bytes: typeof body.net_rx_bytes === "number" ? Math.round(body.net_rx_bytes) : null,
            net_tx_bytes: typeof body.net_tx_bytes === "number" ? Math.round(body.net_tx_bytes) : null,
            uptime_seconds: typeof body.uptime_seconds === "number" ? Math.round(body.uptime_seconds) : null,
            last_error: null,
            meta: { public_ip: publicIp },
          },
          { onConflict: "server_id,agent_key" },
        );

        if (publicIp && publicIp !== server.public_ip) {
          await admin.from("servers").update({ public_ip: publicIp, last_seen_at: now }).eq("id", serverId);
          await admin.from("server_ip_history").insert({
            owner_id: server.owner_id,
            server_id: serverId,
            public_ip: publicIp,
            detected_at: now,
          });
          await admin.from("server_events").insert({
            owner_id: server.owner_id,
            server_id: serverId,
            kind: "ip_changed",
            severity: "warning",
            message: `تغيّر عنوان IP إلى ${publicIp} — تحديث سجلات النطاقات تلقائياً`,
            meta: { public_ip: publicIp },
          });
          // Refresh .HN registry rows bound to this server
          await admin.from("hn_domains").update({ ip_address: publicIp }).eq("server_id", serverId);
          // Re-apply vhosts for every domain bound to a port on this server
          const { data: links } = await admin
            .from("port_links")
            .select("domain, source_port")
            .eq("source_server_id", serverId)
            .eq("link_kind", "domain")
            .limit(50);
          for (const l of (links ?? []) as Array<{ domain: string | null; source_port: number }>) {
            if (!l.domain) continue;
            await admin.from("server_commands").insert({
              owner_id: server.owner_id,
              server_id: serverId,
              action: "port_bind_domain",
              args: { domain: l.domain, port: l.source_port, ssl: false, reason: "ip_changed" },
              dry_run: false,
              requested_by: server.owner_id,
              status: "pending",
            });
          }
        } else {
          await admin.from("servers").update({ last_seen_at: now }).eq("id", serverId);
        }

        // --- 4. Capabilities map sent back to the agent --------------------
        const { data: caps } = await admin
          .from("agent_capabilities")
          .select("action, allowed, max_per_hour")
          .eq("server_id", serverId);

        // --- 5. Long-poll for new work -------------------------------------
        const waitMs = Math.min(20000, Math.max(0, Number(body.wait ?? 15000)));
        let commands = await claimPending(admin, serverId);
        const deadline = Date.now() + waitMs;
        while (!commands.length && Date.now() < deadline) {
          await sleep(1500);
          commands = await claimPending(admin, serverId);
        }

        const url = new URL(request.url);
        return Response.json(
          {
            ok: true,
            now,
            commands,
            capabilities: caps ?? [],
            agent_version: AGENT_VERSION,
            script_url: `${url.origin}/api/public/servers/agent?id=${serverId}&token=${token}`,
            poll_after_ms: 500,
          },
          { headers: CORS },
        );
      },
    },
  },
});
