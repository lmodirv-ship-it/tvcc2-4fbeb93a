import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function enqueue(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  dryRun = false,
) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      action,
      args,
      dry_run: dryRun,
      requested_by: ownerId,
      status: "pending",
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** كل بيانات شبكة VPN + القواعد التلقائية + لقطات الصحة لسيرفر أو للكل. */
export const getMeshOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const peersQ = sb.from("server_vpn_peers").select("*").order("created_at", { ascending: false });
    const rulesQ = sb.from("server_automation_rules").select("*").order("created_at", { ascending: false });
    const healthQ = sb
      .from("server_health_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const bootQ = sb
      .from("server_boot_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.serverId) {
      peersQ.eq("server_id", data.serverId);
      rulesQ.eq("server_id", data.serverId);
      healthQ.eq("server_id", data.serverId);
      bootQ.eq("server_id", data.serverId);
    }
    const [{ data: peers }, { data: rules }, { data: health }, { data: boots }, { data: servers }] =
      await Promise.all([
        peersQ,
        rulesQ,
        healthQ,
        bootQ,
        sb
          .from("servers")
          .select("id, name, hostname, public_ip, private_ip, role, status, last_seen_at, agent_version")
          .order("name"),
      ]);
    return {
      peers: peers ?? [],
      rules: rules ?? [],
      health: health ?? [],
      boots: boots ?? [],
      servers: servers ?? [],
    };
  });

/** تهيئة واجهة WireGuard على سيرفر وتسجيل القرين. */
export const setupVpnNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      serverId: string;
      internalIp: string;
      interfaceName?: string;
      listenPort?: number;
      allowedIps?: string;
      dryRun?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const iface = data.interfaceName || "wg0";
    const port = data.listenPort ?? 51820;
    const { data: peer, error } = await sb
      .from("server_vpn_peers")
      .upsert(
        {
          owner_id: context.userId,
          server_id: data.serverId,
          interface: iface,
          internal_ip: data.internalIp,
          allowed_ips: data.allowedIps || "10.77.0.0/24",
          listen_port: port,
          status: data.dryRun ? "simulated" : "pending",
        },
        { onConflict: "server_id,internal_ip" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const cmd = await enqueue(
      sb,
      context.userId,
      data.serverId,
      "vpn_setup",
      { interface: iface, internal_ip: data.internalIp, listen_port: port },
      !!data.dryRun,
    );
    return { peer, command: cmd };
  });

/** ربط سيرفرين داخل الشبكة الخاصة (peer على الطرفين). */
export const linkVpnPeers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      serverId: string;
      peerServerId: string;
      peerPublicKey: string;
      peerInternalIp: string;
      endpoint?: string | null;
      interfaceName?: string;
      dryRun?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const iface = data.interfaceName || "wg0";
    const { error } = await sb
      .from("server_vpn_peers")
      .upsert(
        {
          owner_id: context.userId,
          server_id: data.serverId,
          peer_server_id: data.peerServerId,
          interface: iface,
          internal_ip: data.peerInternalIp,
          public_key: data.peerPublicKey,
          endpoint: data.endpoint ?? null,
          allowed_ips: `${data.peerInternalIp}/32`,
          status: data.dryRun ? "simulated" : "linking",
        },
        { onConflict: "server_id,internal_ip" },
      );
    if (error) throw new Error(error.message);
    const cmd = await enqueue(
      sb,
      context.userId,
      data.serverId,
      "vpn_peer_add",
      {
        interface: iface,
        public_key: data.peerPublicKey,
        allowed_ips: `${data.peerInternalIp}/32`,
        endpoint: data.endpoint ?? "",
        keepalive: 25,
      },
      !!data.dryRun,
    );
    return { command: cmd };
  });

/** فحص حالة الشبكة الخاصة على سيرفر. */
export const checkVpn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; interfaceName?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    return enqueue(sb, context.userId, data.serverId, "vpn_status", {
      interface: data.interfaceName || "wg0",
    });
  });

/** حذف قرين VPN. */
export const removeVpnPeer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: peer } = await sb.from("server_vpn_peers").select("*").eq("id", data.peerId).maybeSingle();
    if (!peer) throw new Error("القرين غير موجود");
    if (peer.public_key) {
      await enqueue(sb, context.userId, peer.server_id, "vpn_peer_remove", {
        interface: peer.interface,
        public_key: peer.public_key,
      });
    }
    const { error } = await sb.from("server_vpn_peers").delete().eq("id", data.peerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حفظ قاعدة تلقائية (شرط ⇒ إجراء). */
export const saveAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      serverId: string;
      name: string;
      metric: string;
      comparator?: string;
      threshold: number;
      action: string;
      notify?: boolean;
      cooldownMinutes?: number;
      enabled?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      owner_id: context.userId,
      server_id: data.serverId,
      name: data.name,
      metric: data.metric,
      comparator: data.comparator || "gt",
      threshold: data.threshold,
      action: data.action,
      notify: data.notify ?? true,
      cooldown_minutes: data.cooldownMinutes ?? 30,
      enabled: data.enabled ?? true,
    };
    const q = data.id
      ? sb.from("server_automation_rules").update(row).eq("id", data.id)
      : sb.from("server_automation_rules").insert(row);
    const { data: saved, error } = await q.select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("server_automation_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حساب مؤشر صحة السيرفر (0–100) وتخزين لقطة + تنفيذ القواعد التلقائية. */
export const evaluateServerHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: server }, { data: metric }, { data: services }, { data: ports }, { data: rules }] =
      await Promise.all([
        sb.from("servers").select("*").eq("id", data.serverId).maybeSingle(),
        sb
          .from("server_metrics")
          .select("*")
          .eq("server_id", data.serverId)
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb.from("server_services").select("name, status").eq("server_id", data.serverId),
        sb.from("server_ports").select("port, status").eq("server_id", data.serverId),
        sb
          .from("server_automation_rules")
          .select("*")
          .eq("server_id", data.serverId)
          .eq("enabled", true),
      ]);
    if (!server) throw new Error("السيرفر غير موجود");

    const cpu = Number(metric?.cpu_percent ?? 0);
    const pct = (used?: number | null, total?: number | null) =>
      total && Number(total) > 0 ? Math.round((Number(used ?? 0) / Number(total)) * 100) : 0;
    const mem = pct(metric?.mem_used_mb, metric?.mem_total_mb);
    const disk = pct(metric?.disk_used_gb, metric?.disk_total_gb);
    const servicesDown = (services ?? []).filter((s: any) => s.status && s.status !== "running" && s.status !== "active").length;
    const portsDown = (ports ?? []).filter((p: any) => p.status && p.status !== "open").length;
    const lastSeen = server.last_seen_at ? new Date(server.last_seen_at).getTime() : 0;
    const ageSec = lastSeen ? Math.round((Date.now() - lastSeen) / 1000) : 999999;

    let score = 100;
    const reasons: { key: string; label: string; penalty: number }[] = [];
    const hit = (cond: boolean, penalty: number, key: string, label: string) => {
      if (!cond) return;
      score -= penalty;
      reasons.push({ key, label, penalty });
    };
    hit(ageSec > 900, 40, "heartbeat", `لا توجد نبضة منذ ${Math.round(ageSec / 60)} دقيقة`);
    hit(ageSec > 180 && ageSec <= 900, 15, "heartbeat_late", "النبضة متأخرة");
    hit(cpu >= 90, 15, "cpu", `ضغط المعالج ${cpu}%`);
    hit(mem >= 90, 15, "memory", `الذاكرة ممتلئة ${mem}%`);
    hit(disk >= 90, 20, "disk", `القرص ممتلئ ${disk}%`);
    hit(disk >= 75 && disk < 90, 8, "disk_warn", `القرص ${disk}%`);
    hit(servicesDown > 0, Math.min(20, servicesDown * 7), "services", `${servicesDown} خدمة متوقفة`);
    hit(portsDown > 0, Math.min(10, portsDown * 3), "ports", `${portsDown} منفذ معطّل`);
    score = Math.max(0, Math.min(100, score));
    const level = score >= 80 ? "healthy" : score >= 50 ? "warning" : "critical";

    await sb.from("server_health_snapshots").insert({
      owner_id: context.userId,
      server_id: data.serverId,
      score,
      level,
      reasons,
      cpu_percent: cpu,
      memory_percent: mem,
      disk_percent: disk,
      services_down: servicesDown,
      ports_down: portsDown,
      heartbeat_age_seconds: Math.min(ageSec, 2147483647),
    });

    // القواعد التلقائية
    const values: Record<string, number> = {
      cpu_percent: cpu,
      memory_percent: mem,
      disk_percent: disk,
      services_down: servicesDown,
      ports_down: portsDown,
      health_score: score,
      heartbeat_age_seconds: ageSec,
    };
    const triggered: string[] = [];
    for (const rule of rules ?? []) {
      const v = values[rule.metric];
      if (v === undefined) continue;
      const th = Number(rule.threshold);
      const fire = rule.comparator === "lt" ? v < th : v > th;
      if (!fire) continue;
      const cooled =
        !rule.last_triggered_at ||
        Date.now() - new Date(rule.last_triggered_at).getTime() > rule.cooldown_minutes * 60_000;
      if (!cooled) continue;
      await enqueue(sb, context.userId, data.serverId, rule.action, rule.action_payload ?? {});
      await sb
        .from("server_automation_rules")
        .update({ last_triggered_at: new Date().toISOString(), trigger_count: (rule.trigger_count ?? 0) + 1 })
        .eq("id", rule.id);
      if (rule.notify) {
        await sb.from("notifications").insert({
          owner_id: context.userId,
          title: `قاعدة تلقائية: ${rule.name}`,
          message: `${rule.metric}=${v} على ${server.name} ⇒ ${rule.action}`,
          type: "warning",
        });
      }
      triggered.push(rule.name);
    }

    return { score, level, reasons, triggered, cpu, mem, disk, servicesDown, portsDown, ageSec };
  });
