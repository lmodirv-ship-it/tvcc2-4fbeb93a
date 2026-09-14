import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRole, isAdminOrOwner } from "./roles.server";

const DB_ACTIONS = [
  "db_discover", "pg_meta", "pg_rows", "pg_write", "db_query", "db_policy",
  "auth_users", "storage_list", "edge_functions_list", "realtime_inspect",
  "advisor_scan", "db_export", "db_import_full", "db_sync", "db_migrate",
  "backup_run", "backup_verify", "backup_restore", "site_identity_provision",
  "tunnel_setup", "tunnel_status", "tunnel_drop", "agent_update",
] as const;

type DbAction = (typeof DB_ACTIONS)[number];

async function assertAdmin(supabase: any, userId: string) {
  const ok = await isAdminOrOwner(supabase, userId);
  if (!ok) throw new Error("إدارة قواعد البيانات متاحة للمالك والمدير فقط");
}

async function queueCommand(supabase: any, userId: string, serverId: string, action: DbAction, args: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("server_commands")
    .insert({ owner_id: userId, requested_by: userId, server_id: serverId, action, args, status: "pending", dry_run: false })
    .select("id, action, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function audit(supabase: any, userId: string, action: string, resourceId: string, after: Record<string, unknown>) {
  await supabase.from("audit_log").insert({
    owner_id: userId,
    actor_id: userId,
    action,
    resource: "databases",
    resource_id: resourceId,
    after_data: after,
  });
  const { logSecurityEvent } = await import("./security-log.server");
  await logSecurityEvent(supabase, userId, {
    category: "database",
    action,
    resource: "databases",
    resourceId,
    severity: /drop|truncate|restore|import|delete/i.test(action) ? "critical" : "info",
    details: after,
  });
}

export const getDbStudioData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [databases, connections, servers, siteDatabases, websites, history, commands, audits, backups] = await Promise.all([
      supabase.from("databases").select("*").order("is_primary", { ascending: false }).order("name"),
      supabase.from("db_connections").select("*").order("updated_at", { ascending: false }),
      supabase.from("servers").select("id,name,hostname,status,agent_version,last_seen_at,public_ip,private_ip,role").order("name"),
      supabase.from("site_databases").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("websites").select("id,name,domain,site_code,server_id,status").order("name").limit(500),
      supabase.from("query_history").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("server_commands").select("id,server_id,action,args,status,output,exit_code,progress,created_at,completed_at").in("action", [...DB_ACTIONS]).order("created_at", { ascending: false }).limit(80),
      supabase.from("audit_log").select("id,action,resource_id,severity,after_data,created_at").eq("resource", "databases").order("created_at", { ascending: false }).limit(40),
      supabase.from("site_backups").select("id,website_id,server_id,status,backup_type,size_bytes,verified_at,created_at").order("created_at", { ascending: false }).limit(40),
    ]);
    const selected = (databases.data ?? []).find((row) => row.id === data.databaseId) ?? databases.data?.[0] ?? null;
    return {
      databases: databases.data ?? [], connections: connections.data ?? [], servers: servers.data ?? [],
      siteDatabases: siteDatabases.data ?? [], websites: websites.data ?? [], history: history.data ?? [],
      commands: commands.data ?? [], audits: audits.data ?? [], backups: backups.data ?? [], selected,
    };
  });

export const connectDatabaseAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: db } = await supabase.from("databases").select("*").eq("id", data.databaseId).single();
    if (!db?.server_id) throw new Error("اربط القاعدة بسيرفر عليه وكيل TVCC أولاً");
    const pairingCode = randomBytes(4).toString("hex").toUpperCase();
    const pairingHash = createHash("sha256").update(pairingCode).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await supabase.from("db_connections").upsert({
      owner_id: userId,
      database_id: db.id,
      server_id: db.server_id,
      connection_kind: "agent_tunnel",
      status: "pairing",
      pairing_code_hash: pairingHash,
      pairing_expires_at: expiresAt,
      capabilities: {},
      last_error: null,
    }, { onConflict: "database_id" });
    await supabase.from("databases").update({ pairing_status: "pairing" }).eq("id", db.id);
    const upgrade = await queueCommand(supabase, userId, db.server_id, "agent_update", { reason: "dbstudio_connect" });
    const discover = await queueCommand(supabase, userId, db.server_id, "db_discover", {
      database_id: db.id,
      host: db.host,
      port: db.port,
      database: db.db_name ?? "postgres",
      gateway_url: db.connection_url,
      pairing_code: pairingCode,
    });
    await audit(supabase, userId, "database_agent_pair", db.id, { server_id: db.server_id, commands: [upgrade.id, discover.id] });
    return { pairingCode, expiresAt, commands: [upgrade, discover] };
  });

export const queueDbStudioAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; action: DbAction; args?: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!DB_ACTIONS.includes(data.action)) throw new Error("أمر قاعدة البيانات غير مسموح");
    const { data: db } = await supabase.from("databases").select("*").eq("id", data.databaseId).single();
    if (!db?.server_id) throw new Error("لا يوجد سيرفر مرتبط لتنفيذ العملية");
    const command = await queueCommand(supabase, userId, db.server_id, data.action, {
      database_id: db.id,
      engine: db.db_type,
      host: db.host,
      port: db.port,
      database: db.db_name ?? "postgres",
      env_key: db.env_key,
      ...(data.args ?? {}),
    });
    await audit(supabase, userId, data.action, db.id, { command_id: command.id, ...(data.args ?? {}) });
    return command;
  });

const WRITE_SQL = /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|comment|vacuum|reindex)\b/i;
const DESTRUCTIVE_SQL = /\b(drop|truncate|delete|revoke)\b/i;

export const runDbStudioQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; sql: string; confirmWrite?: boolean; title?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const sql = data.sql.trim();
    if (!sql) throw new Error("اكتب استعلاماً أولاً");
    const write = WRITE_SQL.test(sql);
    if (write && !data.confirmWrite) throw new Error("هذا الاستعلام يغيّر البيانات؛ فعّل تأكيد الكتابة أولاً");
    if (DESTRUCTIVE_SQL.test(sql) && !data.confirmWrite) throw new Error("الاستعلام المدمّر يحتاج تأكيداً صريحاً");
    const { data: db } = await supabase.from("databases").select("*").eq("id", data.databaseId).single();
    if (!db?.server_id) throw new Error("لا يوجد وكيل مرتبط بهذه القاعدة");
    const { data: history, error } = await supabase.from("query_history").insert({
      owner_id: userId,
      database_id: db.id,
      title: data.title ?? null,
      sql_text: sql,
      mode: write ? "write" : "read",
      target_kind: "database",
      target_ids: [db.id],
      targets_count: 1,
      status: "queued",
      confirmed_write: Boolean(data.confirmWrite),
    }).select("id").single();
    if (error) throw new Error(error.message);
    const command = await queueCommand(supabase, userId, db.server_id, "db_query", {
      database_id: db.id,
      history_id: history.id,
      engine: db.db_type,
      host: db.host,
      port: db.port,
      database: db.db_name ?? "postgres",
      env_key: db.env_key,
      sql,
      read_only: !write,
    });
    await audit(supabase, userId, "db_query", db.id, { command_id: command.id, history_id: history.id, mode: write ? "write" : "read" });
    return { command, historyId: history.id };
  });

export const provisionSiteIdentities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; websiteIds?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: db } = await supabase.from("databases").select("*").eq("id", data.databaseId).single();
    if (!db?.server_id) throw new Error("القاعدة غير مرتبطة بسيرفر");
    let query = supabase.from("websites").select("id,site_code,domain,server_id").not("site_code", "is", null);
    if (data.websiteIds?.length) query = query.in("id", data.websiteIds);
    const { data: sites } = await query.limit(500);
    let queued = 0;
    for (const site of sites ?? []) {
      const safeCode = String(site.site_code).replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();
      const schemaName = `site_${safeCode}`;
      const serverPath = `/srv/tvcc/sites/${site.site_code}`;
      await supabase.from("site_databases").upsert({
        owner_id: userId,
        website_id: site.id,
        database_id: db.id,
        server_id: site.server_id ?? db.server_id,
        connection_kind: db.db_kind === "local" ? "local" : "cloud",
        db_engine: db.db_type,
        db_name: db.db_name ?? "postgres",
        host: db.host,
        port: db.port,
        site_code: site.site_code,
        schema_name: schemaName,
        server_path: serverPath,
        provisioning_status: "queued",
        status: "pending",
      }, { onConflict: "site_code" });
      await queueCommand(supabase, userId, site.server_id ?? db.server_id, "site_identity_provision", {
        database_id: db.id,
        website_id: site.id,
        site_code: site.site_code,
        schema_name: schemaName,
        server_path: serverPath,
        database: db.db_name ?? "postgres",
        env_key: db.env_key,
      });
      queued++;
    }
    await audit(supabase, userId, "site_identity_provision_bulk", db.id, { queued });
    return { queued };
  });
