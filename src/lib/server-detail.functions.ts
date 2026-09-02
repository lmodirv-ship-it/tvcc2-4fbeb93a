import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Per-server command center: full telemetry, roles, access, tasks and port bindings. */

async function queue(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  opts: { websiteId?: string | null; dryRun?: boolean } = {},
) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      website_id: opts.websiteId ?? null,
      action,
      args,
      dry_run: opts.dryRun ?? false,
      requested_by: ownerId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

function healthScore(server: any, metric: any) {
  let score = 100;
  const seen = server?.last_seen_at ? Date.now() - new Date(server.last_seen_at).getTime() : Infinity;
  if (seen > 15 * 60_000) score -= 45;
  else if (seen > 5 * 60_000) score -= 20;
  else if (seen > 2 * 60_000) score -= 8;

  const cpu = Number(metric?.cpu_percent ?? 0);
  const memPct = metric?.mem_total_mb ? (Number(metric.mem_used_mb) / Number(metric.mem_total_mb)) * 100 : 0;
  const diskPct = metric?.disk_total_gb ? (Number(metric.disk_used_gb) / Number(metric.disk_total_gb)) * 100 : 0;
  for (const v of [cpu, memPct, diskPct]) {
    if (v >= 95) score -= 18;
    else if (v >= 85) score -= 10;
    else if (v >= 70) score -= 4;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export const getServerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const id = data.serverId;

    const [
      { data: server },
      { data: metrics },
      { data: disks },
      { data: nets },
      { data: services },
      { data: containers },
      { data: ports },
      { data: events },
      { data: links },
      { data: runtimes },
      { data: commands },
      { data: access },
      { data: ipHistory },
      { data: sites },
      { data: hnDomains },
    ] = await Promise.all([
      sb.from("servers").select("*").eq("id", id).maybeSingle(),
      sb.from("server_metrics").select("*").eq("server_id", id).order("collected_at", { ascending: false }).limit(60),
      sb.from("server_disks").select("*").eq("server_id", id),
      sb.from("server_net_interfaces").select("*").eq("server_id", id),
      sb.from("server_services").select("*").eq("server_id", id).order("name"),
      sb.from("server_containers").select("*").eq("server_id", id),
      sb.from("server_ports").select("*").eq("server_id", id).order("port"),
      sb.from("server_events").select("*").eq("server_id", id).order("created_at", { ascending: false }).limit(40),
      sb.from("port_links").select("*").or(`source_server_id.eq.${id},target_server_id.eq.${id}`),
      sb.from("site_runtimes").select("*").eq("server_id", id),
      sb.from("server_commands").select("*").eq("server_id", id).order("created_at", { ascending: false }).limit(25),
      sb.from("server_access").select("*").eq("server_id", id),
      sb.from("server_ip_history").select("*").eq("server_id", id).order("detected_at", { ascending: false }).limit(10),
      sb.from("websites").select("id, name, domain, verified, status").order("name").limit(500),
      sb.from("hn_domains").select("id, fqdn, status, server_id").limit(500),
    ]);

    if (!server) throw new Error("السيرفر غير موجود");

    const latest = (metrics ?? [])[0] ?? null;
    return {
      server,
      health: healthScore(server, latest),
      latest,
      metrics: (metrics ?? []).slice().reverse(),
      disks: disks ?? [],
      nets: nets ?? [],
      services: services ?? [],
      containers: containers ?? [],
      ports: ports ?? [],
      events: events ?? [],
      links: links ?? [],
      runtimes: runtimes ?? [],
      commands: commands ?? [],
      access: access ?? [],
      ipHistory: ipHistory ?? [],
      verifiedDomains: (sites ?? []).filter((s: any) => s.verified && s.domain).map((s: any) => ({ id: s.id, domain: s.domain, kind: "web" })),
      unverifiedDomains: (sites ?? []).filter((s: any) => !s.verified && s.domain).map((s: any) => ({ id: s.id, domain: s.domain })),
      hnDomains: (hnDomains ?? []).map((d: any) => ({ id: d.id, domain: d.fqdn, kind: "hn", status: d.status })),
    };
  });

/* --------------------------------------------------------------- role */

export const setServerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; role: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("servers")
      .update({ role: data.role })
      .eq("id", data.serverId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------- access */

export const grantServerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; email: string; level: "view" | "operate" | "manage" }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("id").eq("email", data.email.trim().toLowerCase()).maybeSingle();
    if (!profile) throw new Error("لا يوجد مستخدم بهذا البريد");
    const { error } = await sb.from("server_access").upsert(
      { owner_id: context.userId, server_id: data.serverId, user_id: profile.id, level: data.level },
      { onConflict: "server_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeServerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("server_access").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------- port → domain binding */

export const bindPortToDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; port: number; domain: string; ssl?: boolean; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { isSafePort } = await import("./ports.server");
    if (!isSafePort(data.port)) throw new Error("رقم منفذ غير صالح");
    const domain = data.domain.trim().toLowerCase();

    const isHn = domain.endsWith(".hn");
    if (isHn) {
      const { data: d } = await sb.from("hn_domains").select("id").eq("fqdn", domain).maybeSingle();
      if (!d) throw new Error("النطاق الداخلي غير مسجل في سجل .HN");
    } else {
      const { data: site } = await sb.from("websites").select("id, verified").eq("domain", domain).maybeSingle();
      if (!site?.verified) throw new Error("لم تُثبت ملكية هذا النطاق بعد — تحقق منه أولاً");
    }

    await queue(sb, context.userId, data.serverId, "port_bind_domain", {
      domain, port: data.port, ssl: !isHn && data.ssl !== false,
    }, { dryRun: data.dryRun });

    if (!data.dryRun) {
      await sb.from("port_links").insert({
        owner_id: context.userId,
        name: `${domain} → :${data.port}`,
        link_kind: "domain",
        domain,
        source_server_id: data.serverId,
        source_port: data.port,
        target_host: "127.0.0.1",
        target_port: data.port,
        bridge_kind: "http_proxy",
        status: "applying",
      });
    }
    return { ok: true };
  });

export const unbindPortDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: link } = await sb.from("port_links").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("الرابط غير موجود");
    await queue(sb, context.userId, link.source_server_id, "port_unbind_domain", { domain: link.domain });
    await sb.from("port_links").delete().eq("id", data.id);
    return { ok: true };
  });

/* --------------------------------------------- port → Supabase CLI bridge */

export const bindPortToSupabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; port: number; projectDir?: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { isSafePort } = await import("./ports.server");
    if (!isSafePort(data.port)) throw new Error("رقم منفذ غير صالح");

    await queue(sb, context.userId, data.serverId, "supabase_bind", {
      port: data.port, project_dir: data.projectDir ?? "/opt/supabase",
    }, { dryRun: data.dryRun });

    if (!data.dryRun) {
      await sb.from("port_links").insert({
        owner_id: context.userId,
        name: `Supabase CLI :${data.port}`,
        link_kind: "supabase",
        source_server_id: data.serverId,
        source_port: data.port,
        target_host: "127.0.0.1",
        target_port: data.port,
        target_url: `http://127.0.0.1:${data.port}`,
        bridge_kind: "supabase_cli",
        status: "applying",
      });
    }
    return { ok: true };
  });

/* ------------------------------------------------------ generic commands */

export const runServerAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; action: string; args?: Record<string, unknown>; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const id = await queue(context.supabase as any, context.userId, data.serverId, data.action, data.args ?? {}, { dryRun: data.dryRun });
    return { ok: true, commandId: id };
  });

export const scheduleServerTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; name: string; taskType: string; intervalMinutes: number; payload?: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("scheduled_tasks").insert({
      owner_id: context.userId,
      server_id: data.serverId,
      name: data.name,
      task_type: data.taskType,
      schedule_kind: "interval",
      interval_minutes: Math.max(1, data.intervalMinutes),
      payload: data.payload ?? {},
      is_active: true,
      next_run_at: new Date(Date.now() + data.intervalMinutes * 60_000).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
