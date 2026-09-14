import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: owner } = await supabase.rpc("has_role", { _user_id: userId, _role: "system_owner" });
  if (!admin && !owner) throw new Error("صلاحيات غير كافية — السيطرة الفيدرالية للمالك والمدير فقط");
}

/** نظرة عامة فيدرالية: طبولوجيا + موارد مجمّعة + تنبيهات. */
export const getFederatedOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [servers, websites, metrics, alerts, clones, deployments] = await Promise.all([
      supabase.from("servers").select("id, name, hostname, role, status, last_seen_at, agent_version"),
      supabase.from("websites").select("id, name, domain, status, server_id, manara_code"),
      supabase
        .from("server_metrics")
        .select("server_id, cpu_percent, mem_used_mb, mem_total_mb, disk_used_gb, disk_total_gb, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("federated_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(50),
      supabase.from("site_clones").select("id, status, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("blueprint_deployments").select("id, status, created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    const latest = new Map<string, any>();
    for (const m of metrics.data ?? []) if (!latest.has(m.server_id)) latest.set(m.server_id, m);
    return {
      servers: servers.data ?? [],
      websites: websites.data ?? [],
      metrics: Object.fromEntries(latest),
      alerts: alerts.data ?? [],
      recentClones: clones.data ?? [],
      recentDeployments: deployments.data ?? [],
      totals: {
        servers: (servers.data ?? []).length,
        websites: (websites.data ?? []).length,
        online: (servers.data ?? []).filter((s: any) => s.status === "online").length,
      },
    };
  });

/** الأسطول: مواقع + سيرفرات + عمليات الاستنساخ + القوالب. */
export const getFleetData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [websites, servers, clones, blueprints, deployments] = await Promise.all([
      supabase.from("websites").select("id, name, domain, status, server_id, manara_code, slug, site_url").order("name"),
      supabase.from("servers").select("id, name, hostname, role, status").order("name"),
      supabase.from("site_clones").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("fleet_blueprints").select("id, name, version, is_active, updated_at").order("name"),
      supabase.from("blueprint_deployments").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      websites: websites.data ?? [],
      servers: servers.data ?? [],
      clones: clones.data ?? [],
      blueprints: blueprints.data ?? [],
      deployments: deployments.data ?? [],
    };
  });

/** بدء استنساخ موقع: يسجّل العملية ويرسل أمر site_clone للوكيل. */
export const startSiteClone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; targetServerId: string; newDomain?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: clone, error } = await supabase
      .from("site_clones")
      .insert({ source_website_id: data.websiteId, target_server_id: data.targetServerId, new_domain: data.newDomain ?? null, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("server_commands").insert({
      server_id: data.targetServerId,
      action: "site_clone",
      args: { clone_id: clone.id, website_id: data.websiteId, new_domain: data.newDomain ?? null },
      status: "pending",
      owner_id: userId,
      requested_by: userId,
      dry_run: false,
    });
    return clone;
  });

/** سجل الاستعلامات الجماعية. */
export const getFederatedQueries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.from("federated_queries").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DESTRUCTIVE = /\b(drop|truncate|delete\s+from\s+\w+\s*;|alter\s+table|grant|revoke)\b/i;

export const runFederatedQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sql: string; targetKind: "site" | "group" | "all"; targetIds: string[]; confirmed: boolean; dryRun: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const destructive = DESTRUCTIVE.test(data.sql);
    if (destructive && !data.confirmed) throw new Error("استعلام مدمّر محتمل — يتطلب تأكيداً نصياً مطابقاً");
    const { data: row, error } = await supabase
      .from("federated_queries")
      .insert({
        sql_text: data.sql,
        target_kind: data.targetKind,
        target_ids: data.targetIds,
        destructive,
        confirmed: data.confirmed,
        status: data.dryRun ? "dry_run" : "queued",
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data.dryRun) {
      // وزّع كأمر multi_sql على سيرفرات الأهداف عبر الوكيل
      let serverIds: string[] = [];
      if (data.targetKind === "all") {
        const { data: sv } = await supabase.from("servers").select("id").eq("status", "online");
        serverIds = (sv ?? []).map((s: any) => s.id);
      } else {
        const { data: ws } = await supabase.from("websites").select("server_id").in("id", data.targetIds);
        serverIds = [...new Set((ws ?? []).map((w: any) => w.server_id).filter(Boolean))] as string[];
      }
      for (const sid of serverIds) {
        await supabase.from("server_commands").insert({
          server_id: sid,
          action: "multi_sql",
          args: { query_id: row.id, sql: data.sql },
          status: "pending",
          owner_id: userId,
        requested_by: userId,
        dry_run: false,
        });
      }
    }
    return row;
  });

/** قوالب النشر الأم. */
export const saveBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; name: string; description?: string; schemaSql: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { data: row, error } = await supabase
        .from("fleet_blueprints")
        .update({ name: data.name, description: data.description ?? null, schema_sql: data.schemaSql })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("fleet_blueprints")
      .insert({ name: data.name, description: data.description ?? null, schema_sql: data.schemaSql, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deployBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { blueprintId: string; websiteIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: bp } = await supabase.from("fleet_blueprints").select("*").eq("id", data.blueprintId).single();
    if (!bp) throw new Error("القالب غير موجود");
    const { data: ws } = await supabase.from("websites").select("id, server_id").in("id", data.websiteIds);
    let created = 0;
    for (const w of ws ?? []) {
      await supabase.from("blueprint_deployments").insert({ blueprint_id: bp.id, website_id: w.id, server_id: w.server_id, status: "pending" });
      if (w.server_id) {
        await supabase.from("server_commands").insert({
          server_id: w.server_id,
          action: "blueprint_apply",
          args: { blueprint_id: bp.id, website_id: w.id, schema_sql: bp.schema_sql },
          status: "pending",
          owner_id: userId,
        requested_by: userId,
        dry_run: false,
        });
      }
      created++;
    }
    return { created };
  });

/** صفحة الوكيل: إعدادات + Nginx + لقطات. */
export const getAgentsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [servers, configs, commands, nginx, snapshots, websites] = await Promise.all([
      supabase.from("servers").select("id, name, hostname, status, agent_version, last_seen_at").order("name"),
      supabase.from("agent_configs").select("*"),
      supabase.from("server_commands").select("id, server_id, action, status, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("nginx_configs").select("id, server_id, website_id, file_path, status, version, updated_at").order("updated_at", { ascending: false }),
      supabase.from("site_snapshots").select("*").order("created_at", { ascending: false }),
      supabase.from("websites").select("id, name, domain, server_id, status"),
    ]);
    return {
      servers: servers.data ?? [],
      configs: configs.data ?? [],
      commands: commands.data ?? [],
      nginx: nginx.data ?? [],
      snapshots: snapshots.data ?? [],
      websites: websites.data ?? [],
    };
  });

export const saveAgentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; heartbeatIntervalSec: number; allowedCommands: string[]; autostart: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("agent_configs")
      .upsert({
        server_id: data.serverId,
        heartbeat_interval_sec: data.heartbeatIntervalSec,
        allowed_commands: data.allowedCommands,
        autostart: data.autostart,
      }, { onConflict: "server_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("server_commands").insert({
      server_id: data.serverId,
      action: "agent_config_set",
      args: { heartbeat_interval_sec: data.heartbeatIntervalSec, allowed_commands: data.allowedCommands, autostart: data.autostart },
      status: "pending",
      owner_id: userId,
      requested_by: userId,
      dry_run: false,
    });
    return row;
  });

export const getNginxConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase.from("nginx_configs").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return row;
  });

/** حفظ ملف Nginx: يرسل للوكيل مع فحص nginx -t قبل التطبيق والتراجع عند الفشل. */
export const saveNginxConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; serverId: string; websiteId?: string; filePath: string; content: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let row;
    if (data.id) {
      const { data: prev } = await supabase.from("nginx_configs").select("version").eq("id", data.id).single();
      const r = await supabase
        .from("nginx_configs")
        .update({ content: data.content, file_path: data.filePath, website_id: data.websiteId ?? null, version: (prev?.version ?? 0) + 1 })
        .eq("id", data.id)
        .select()
        .single();
      if (r.error) throw new Error(r.error.message);
      row = r.data;
    } else {
      const r = await supabase
        .from("nginx_configs")
        .insert({ server_id: data.serverId, website_id: data.websiteId ?? null, file_path: data.filePath, content: data.content })
        .select()
        .single();
      if (r.error) throw new Error(r.error.message);
      row = r.data;
    }
    await supabase.from("server_commands").insert({
      server_id: data.serverId,
      action: "nginx_write",
      args: { config_id: row.id, file_path: data.filePath, content: data.content, test_first: true, rollback_on_fail: true },
      status: "pending",
      owner_id: userId,
      requested_by: userId,
      dry_run: false,
    });
    return row;
  });

/** لقطة موقع: نسختان فقط (current/previous) — الحالية تتحول إلى previous تلقائياً. */
export const createSiteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: site } = await supabase.from("websites").select("id, server_id, domain").eq("id", data.websiteId).single();
    if (!site?.server_id) throw new Error("الموقع غير مربوط بسيرفر");
    const { data: prev } = await supabase.from("site_snapshots").select("*").eq("website_id", data.websiteId).eq("slot", "current").maybeSingle();
    if (prev) {
      await supabase.from("site_snapshots").upsert({ website_id: data.websiteId, server_id: site.server_id, slot: "previous", path: prev.path, size_bytes: prev.size_bytes, note: prev.note }, { onConflict: "website_id,slot" });
      await supabase.from("site_snapshots").delete().eq("id", prev.id);
    }
    await supabase.from("server_commands").insert({
      server_id: site.server_id,
      action: "site_snapshot",
      args: { website_id: data.websiteId, domain: site.domain, slots: 2 },
      status: "pending",
      owner_id: userId,
      requested_by: userId,
      dry_run: false,
    });
    const { data: row, error } = await supabase
      .from("site_snapshots")
      .upsert({ website_id: data.websiteId, server_id: site.server_id, slot: "current", note: data.note ?? null, path: `/var/backups/tvcc/${site.domain}/current.tar.gz` }, { onConflict: "website_id,slot" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const rollbackSiteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: snap } = await supabase.from("site_snapshots").select("*").eq("website_id", data.websiteId).eq("slot", "previous").maybeSingle();
    if (!snap?.server_id) throw new Error("لا توجد نسخة قديمة لهذا الموقع");
    await supabase.from("server_commands").insert({
      server_id: snap.server_id,
      action: "site_rollback",
      args: { website_id: data.websiteId, snapshot_id: snap.id, path: snap.path },
      status: "pending",
      owner_id: userId,
      requested_by: userId,
      dry_run: false,
    });
    return { ok: true };
  });
