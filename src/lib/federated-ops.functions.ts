import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: owner } = await supabase.rpc("has_role", { _user_id: userId, _role: "system_owner" });
  if (!admin && !owner) throw new Error("صلاحيات غير كافية — هذه العمليات للمالك والمدير فقط");
}

async function audit(
  supabase: any,
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  after?: any,
  severity = "info",
) {
  await supabase.from("audit_log").insert({
    owner_id: userId,
    actor_id: userId,
    action,
    resource,
    resource_id: resourceId ?? null,
    severity,
    after_data: after ?? null,
  });
}

async function queueCommand(supabase: any, userId: string, serverId: string, action: string, args: any) {
  const { data, error } = await supabase
    .from("server_commands")
    .insert({ server_id: serverId, action, args, status: "pending", owner_id: userId, requested_by: userId, dry_run: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/* ───────────────────────── الطبولوجيا والمزامنة ───────────────────────── */

export const getMeshTopology = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [servers, links, metrics, databases, audits] = await Promise.all([
      supabase.from("servers").select("id, name, hostname, role, status, agent_version, last_seen_at, network_kind, public_ip, private_ip").order("name"),
      supabase.from("server_links").select("*").order("created_at", { ascending: false }),
      supabase
        .from("server_metrics")
        .select("server_id, cpu_percent, mem_used_mb, mem_total_mb, disk_used_gb, disk_total_gb, collected_at")
        .order("collected_at", { ascending: false })
        .limit(300),
      supabase.from("databases").select("id, name, db_kind, host, port, status, sync_mode, is_primary, migration_status, last_sync_at, server_id, linked_database_id").order("name"),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    const latest = new Map<string, any>();
    for (const m of metrics.data ?? []) if (!latest.has(m.server_id)) latest.set(m.server_id, m);
    return {
      servers: servers.data ?? [],
      links: links.data ?? [],
      metrics: Object.fromEntries(latest),
      databases: databases.data ?? [],
      audits: audits.data ?? [],
    };
  });

/** تهجير/مزامنة قاعدة بيانات نحو قاعدة أخرى عبر الوكيل. */
export const migrateDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { sourceId: string; targetId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: rows } = await supabase.from("databases").select("*").in("id", [data.sourceId, data.targetId]);
    const source = (rows ?? []).find((r: any) => r.id === data.sourceId);
    const target = (rows ?? []).find((r: any) => r.id === data.targetId);
    if (!source || !target) throw new Error("قاعدة المصدر أو الوجهة غير موجودة");
    const serverId = target.server_id ?? source.server_id;
    if (!serverId) throw new Error("لا يوجد سيرفر مرتبط يملك وكيلاً لتنفيذ التهجير");
    const commandId = await queueCommand(supabase, userId, serverId, "db_migrate", {
      source: { host: source.host, port: source.port, db: source.db_name, env_key: source.env_key },
      target: { host: target.host, port: target.port, db: target.db_name, env_key: target.env_key },
      database_id: target.id,
    });
    await supabase.from("databases").update({ migration_status: "running", linked_database_id: source.id }).eq("id", target.id);
    await audit(supabase, userId, "db_migrate", "databases", target.id, { source: source.name, target: target.name });
    return { commandId };
  });

/* ───────────────────────── النسخ الاحتياطي و PITR ───────────────────────── */

export const getBackupCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [schedules, backups, groups, servers, databases, websites] = await Promise.all([
      supabase.from("backup_schedules").select("*").order("created_at"),
      supabase.from("site_backups").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("site_groups").select("id, name, group_kind, group_key, color, is_auto").order("sort_order"),
      supabase.from("servers").select("id, name, hostname, status").order("name"),
      supabase.from("databases").select("id, name, db_kind, host, port, status, migration_status, is_primary, last_sync_at, server_id, tables_count, rows_count").order("name"),
      supabase.from("websites").select("id, name, domain, status, server_id").order("name"),
    ]);
    const memberCounts: Record<string, number> = {};
    const { data: members } = await supabase.from("website_group_members").select("group_id");
    for (const m of members ?? []) memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
    return {
      schedules: schedules.data ?? [],
      backups: backups.data ?? [],
      groups: groups.data ?? [],
      servers: servers.data ?? [],
      databases: databases.data ?? [],
      websites: websites.data ?? [],
      memberCounts,
    };
  });

export const saveBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string; groupId?: string | null; websiteId?: string | null; serverId?: string | null; targetServerId?: string | null;
    schedule: string; copies: number; encrypt: boolean; destPath: string; label: string; isActive: boolean; retentionCount: number;
  }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const payload = {
      owner_id: userId,
      group_id: data.groupId ?? null,
      website_id: data.websiteId ?? null,
      server_id: data.serverId ?? null,
      target_server_id: data.targetServerId ?? null,
      backup_type: "full",
      schedule: data.schedule,
      copies: data.copies,
      encrypt: data.encrypt,
      dest_path: data.destPath,
      label: data.label,
      is_active: data.isActive,
      retention_count: data.retentionCount,
    };
    const q = data.id
      ? await supabase.from("backup_schedules").update(payload).eq("id", data.id).select().single()
      : await supabase.from("backup_schedules").insert(payload).select().single();
    if (q.error) throw new Error(q.error.message);
    await audit(supabase, userId, data.id ? "backup_schedule_update" : "backup_schedule_create", "backup_schedules", q.data.id, payload);
    return q.data;
  });

export const toggleBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; isActive: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("backup_schedules").update({ is_active: data.isActive }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** تشغيل نسخة احتياطية الآن: يسجّل السجلات ويرسل أمر backup_run لكل نسخة. */
export const runBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { scheduleId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: sch } = await supabase.from("backup_schedules").select("*").eq("id", data.scheduleId).single();
    if (!sch) throw new Error("سياسة النسخ غير موجودة");

    let websiteIds: string[] = [];
    if (sch.website_id) websiteIds = [sch.website_id];
    else if (sch.group_id) {
      const { data: members } = await supabase.from("website_group_members").select("website_id").eq("group_id", sch.group_id);
      websiteIds = (members ?? []).map((m: any) => m.website_id);
    }
    if (websiteIds.length === 0) throw new Error("لا توجد مواقع ضمن هذه السياسة");

    const { data: sites } = await supabase.from("websites").select("id, domain, server_id").in("id", websiteIds);
    const execServer = sch.server_id ?? sch.target_server_id;
    let created = 0;
    let queued = 0;
    for (const site of sites ?? []) {
      for (let copy = 1; copy <= (sch.copies ?? 1); copy++) {
        const { data: rec } = await supabase
          .from("site_backups")
          .insert({
            owner_id: userId,
            website_id: site.id,
            server_id: site.server_id ?? execServer,
            target_server_id: sch.target_server_id,
            backup_type: sch.backup_type ?? "full",
            label: `${sch.label ?? "نسخة"} #${copy}`,
            dest_path: `${sch.dest_path ?? "/var/backups/tvcc"}/${site.domain ?? site.id}/copy${copy}`,
            status: "pending",
            copy_index: copy,
            encrypted: sch.encrypt ?? true,
            is_latest: copy === 1,
          })
          .select("id")
          .single();
        created++;
        const target = site.server_id ?? execServer;
        if (rec && target) {
          await queueCommand(supabase, userId, target, "backup_run", {
            backup_id: rec.id,
            website_id: site.id,
            domain: site.domain,
            dest_path: `${sch.dest_path ?? "/var/backups/tvcc"}/${site.domain ?? site.id}/copy${copy}`,
            target_server_id: sch.target_server_id,
            encrypt: sch.encrypt ?? true,
            copy_index: copy,
          });
          queued++;
        }
      }
    }
    await supabase.from("backup_schedules").update({ last_run_at: new Date().toISOString() }).eq("id", sch.id);
    await audit(supabase, userId, "backup_run", "backup_schedules", sch.id, { sites: sites?.length ?? 0, created, queued });
    return { sites: sites?.length ?? 0, created, queued };
  });

export const verifyBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { backupId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: b } = await supabase.from("site_backups").select("*").eq("id", data.backupId).single();
    if (!b) throw new Error("النسخة غير موجودة");
    const server = b.target_server_id ?? b.server_id;
    if (!server) throw new Error("لا يوجد سيرفر لتنفيذ التحقق");
    await queueCommand(supabase, userId, server, "backup_verify", { backup_id: b.id, path: b.dest_path ?? b.storage_path });
    await audit(supabase, userId, "backup_verify", "site_backups", b.id);
    return { ok: true };
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { backupId: string; confirm: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.confirm !== "استعادة") throw new Error("اكتب كلمة «استعادة» للتأكيد");
    const { data: b } = await supabase.from("site_backups").select("*").eq("id", data.backupId).single();
    if (!b) throw new Error("النسخة غير موجودة");
    const server = b.server_id ?? b.target_server_id;
    if (!server) throw new Error("لا يوجد سيرفر لتنفيذ الاستعادة");
    await queueCommand(supabase, userId, server, "backup_restore", {
      backup_id: b.id,
      website_id: b.website_id,
      path: b.dest_path ?? b.storage_path,
      encrypted: b.encrypted,
    });
    await audit(supabase, userId, "backup_restore", "site_backups", b.id, null, "warning");
    return { ok: true };
  });

/* ───────────────────────── الشفاء الذاتي والتنبيهات ───────────────────────── */

export const getHealingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [rules, alerts, jobs, servers, audits] = await Promise.all([
      supabase.from("alert_rules").select("*").order("created_at"),
      supabase.from("federated_alerts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("agent_jobs").select("id, server_id, kind, status, progress, steps_total, current_step, error, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("servers").select("id, name, hostname, status, last_seen_at").order("name"),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    return { rules: rules.data ?? [], alerts: alerts.data ?? [], jobs: jobs.data ?? [], servers: servers.data ?? [], audits: audits.data ?? [] };
  });

export const saveAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string; name: string; scope: string; serverId?: string | null; metric: string;
    comparator: string; threshold: number; forSeconds: number; severity: string; isActive: boolean;
  }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const payload = {
      owner_id: userId,
      name: data.name,
      scope: data.scope,
      server_id: data.serverId ?? null,
      metric: data.metric,
      comparator: data.comparator,
      threshold: data.threshold,
      for_seconds: data.forSeconds,
      severity: data.severity,
      is_active: data.isActive,
    };
    const q = data.id
      ? await supabase.from("alert_rules").update(payload).eq("id", data.id).select().single()
      : await supabase.from("alert_rules").insert(payload).select().single();
    if (q.error) throw new Error(q.error.message);
    await audit(supabase, userId, data.id ? "alert_rule_update" : "alert_rule_create", "alert_rules", q.data.id, payload);
    return q.data;
  });

export const deleteAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("alert_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("federated_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إجراء شفاء ذاتي يدوي على سيرفر (إعادة تشغيل خدمة، تنظيف قرص، إعادة تحميل Nginx). */
export const runHealAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { serverId: string; kind: "service_restart" | "disk_cleanup" | "nginx_reload"; target?: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const id = await queueCommand(supabase, userId, data.serverId, "heal_action", { kind: data.kind, target: data.target ?? null });
    await audit(supabase, userId, "heal_action", "servers", data.serverId, { kind: data.kind, target: data.target ?? null }, "warning");
    return { commandId: id };
  });

/* ───────────────────────── الأصول والمجموعات ───────────────────────── */

export const getAssetsInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [groups, members, websites, servers, databases, domains] = await Promise.all([
      supabase.from("site_groups").select("*").order("sort_order"),
      supabase.from("website_group_members").select("group_id, website_id"),
      supabase.from("websites").select("id, name, domain, status, server_id, slug, site_url, manara_code").order("name"),
      supabase.from("servers").select("id, name, hostname, role, status").order("name"),
      supabase.from("databases").select("id, name, db_kind, host, status, migration_status, is_primary, tables_count, rows_count").order("name"),
      supabase.from("domains").select("id, name, status").limit(500),
    ]);
    return {
      groups: groups.data ?? [],
      members: members.data ?? [],
      websites: websites.data ?? [],
      servers: servers.data ?? [],
      databases: databases.data ?? [],
      domains: domains.data ?? [],
    };
  });

export const setSiteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { websiteId: string; groupId: string; attach: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.attach) {
      const { error } = await supabase.from("website_group_members").insert({ owner_id: userId, group_id: data.groupId, website_id: data.websiteId });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("website_group_members").delete().eq("group_id", data.groupId).eq("website_id", data.websiteId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
