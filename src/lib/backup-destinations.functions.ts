import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** وجهات النسخ الليلي + حالة نسخ كل موقع. */
export const listBackupDestinations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: destinations }, { data: copies }] = await Promise.all([
      sb
        .from("backup_destinations")
        .select("id, name, host, username, port, base_path, is_enabled, last_run_at, last_run_status, last_run_summary, notes, created_at, secret_id, storage_server_id, scope")
        .order("created_at", { ascending: false }),
      sb
        .from("site_backup_copies")
        .select("id, destination_id, website_id, domain, copy_kind, remote_path, size_bytes, status, error_message, completed_at, updated_at")
        .order("domain"),
    ]);
    const hosts = new Set(((destinations ?? []) as any[]).map((d) => String(d.host ?? "").trim()));
    const [{ data: servers }, { data: agents }] = await Promise.all([
      sb.from("servers").select("id, name, hostname, public_ip, private_ip, status, last_seen_at, ram_mb, disk_gb").limit(500),
      sb.from("agent_instances").select("server_id, status, last_heartbeat_at, poll_latency_ms, link_quality").limit(500),
    ]);

    const matched = ((servers ?? []) as any[]).filter((s) =>
      hosts.has(String(s.hostname ?? "")) || hosts.has(String(s.public_ip ?? "")) || hosts.has(String(s.private_ip ?? "")),
    );

    const metricsByServer = new Map<string, any>();
    if (matched.length) {
      const { data: metrics } = await sb
        .from("server_metrics")
        .select("server_id, collected_at, cpu_percent, mem_total_mb, mem_used_mb, mem_available_mb, disk_total_gb, disk_used_gb, latency_ms, uptime_seconds, load_avg")
        .in("server_id", matched.map((s) => s.id))
        .order("collected_at", { ascending: false })
        .limit(600);
      for (const m of (metrics ?? []) as any[]) {
        if (!metricsByServer.has(m.server_id)) metricsByServer.set(m.server_id, m);
      }
    }

    const agentByServer = new Map<string, any>();
    for (const a of (agents ?? []) as any[]) {
      const prev = agentByServer.get(a.server_id);
      if (!prev || (a.status === "online" && prev.status !== "online")) agentByServer.set(a.server_id, a);
    }

    const fresh = Date.now() - 10 * 60 * 1000;
    const enriched = ((destinations ?? []) as any[]).map((d) => {
      const host = String(d.host ?? "").trim();
      const srv = matched.find((s) => s.hostname === host || s.public_ip === host || s.private_ip === host) ?? null;
      const m = srv ? metricsByServer.get(srv.id) ?? null : null;
      const ag = srv ? agentByServer.get(srv.id) ?? null : null;
      const agentOnline = !!ag && ag.status === "online" && !!ag.last_heartbeat_at && new Date(ag.last_heartbeat_at).getTime() > fresh;
      const memTotal = Number(m?.mem_total_mb ?? srv?.ram_mb ?? 0);
      const memUsed = Number(m?.mem_used_mb ?? 0);
      const diskTotal = Number(m?.disk_total_gb ?? srv?.disk_gb ?? 0);
      const diskUsed = Number(m?.disk_used_gb ?? 0);
      return {
        ...d,
        server: srv ? { id: srv.id, name: srv.name, status: srv.status, last_seen_at: srv.last_seen_at } : null,
        agent_online: agentOnline,
        ready: d.is_enabled && agentOnline,
        metrics: {
          collected_at: m?.collected_at ?? null,
          cpu_percent: m?.cpu_percent ?? null,
          latency_ms: m?.latency_ms ?? ag?.poll_latency_ms ?? null,
          link_quality: ag?.link_quality ?? null,
          uptime_seconds: m?.uptime_seconds ?? null,
          mem_total_mb: memTotal || null,
          mem_used_mb: memUsed || null,
          mem_free_mb: memTotal ? Math.max(0, memTotal - memUsed) : null,
          mem_percent: memTotal ? Math.round((memUsed / memTotal) * 100) : null,
          disk_total_gb: diskTotal || null,
          disk_used_gb: diskUsed || null,
          disk_free_gb: diskTotal ? Math.max(0, diskTotal - diskUsed) : null,
          disk_percent: diskTotal ? Math.round((diskUsed / diskTotal) * 100) : null,
        },
      };
    });

    return { destinations: enriched, copies: copies ?? [] };
  });

export const saveBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      name: string;
      host: string;
      username: string;
      port?: number;
      password?: string | null;
      basePath: string;
      isEnabled: boolean;
      notes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!data.name.trim() || !data.host.trim() || !data.basePath.trim()) {
      throw new Error("الاسم والسيرفر والمسار مطلوبة");
    }

    let secretId: string | null = null;
    if (data.password && data.password.trim()) {
      const { encryptSecret } = await import("@/lib/vault-crypto.server");
      const { ciphertext, iv } = encryptSecret(data.password.trim());
      const { data: secret, error: secretError } = await sb
        .from("vault_secrets")
        .insert({
          owner_id: context.userId,
          name: `backup-dest-${data.host}-${Date.now()}`,
          category: "ssh_password",
          description: `كلمة سر وجهة النسخ: ${data.name}`,
          value_encrypted: `${iv}:${ciphertext}`,
        })
        .select("id")
        .maybeSingle();
      if (secretError) throw new Error(secretError.message);
      secretId = secret?.id ?? null;
    }

    const payload: Record<string, unknown> = {
      owner_id: context.userId,
      name: data.name.trim(),
      host: data.host.trim(),
      username: (data.username || "root").trim(),
      port: data.port ?? 22,
      base_path: data.basePath.trim().replace(/\/+$/, ""),
      is_enabled: data.isEnabled,
      notes: data.notes ?? null,
    };
    if (secretId) payload["secret_id"] = secretId;

    if (data.id) {
      const { error } = await sb.from("backup_destinations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }

    const { data: row, error } = await sb
      .from("backup_destinations")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id };
  });

export const toggleBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isEnabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("backup_destinations")
      .update({ is_enabled: data.isEnabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("backup_destinations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** تشغيل النسخ الكامل فوراً لوجهة واحدة (نفس منطق المهمة الليلية). */
export const runBackupDestinationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: dest } = await sb
      .from("backup_destinations")
      .select("id, owner_id, name, host, username, port, base_path, secret_id, is_enabled")
      .eq("id", data.id)
      .maybeSingle();
    if (!dest) throw new Error("الوجهة غير موجودة");
    if (dest.owner_id !== context.userId) throw new Error("غير مصرح");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runNightlyBackupForDestination } = await import("@/lib/nightly-backup.server");
    return runNightlyBackupForDestination(supabaseAdmin as any, dest);
  });
