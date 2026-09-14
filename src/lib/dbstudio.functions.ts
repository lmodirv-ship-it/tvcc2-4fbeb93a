import { createHash, randomBytes } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRole, isAdminOrOwner } from "./roles.server";

const DB_ACTIONS = [
  "db_discover", "pg_meta", "pg_rows", "pg_write", "db_query", "db_policy",
  "pg_ddl", "pg_import_csv",
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

const PROTECTED_TABLES = new Set([
  "user_roles", "profiles", "audit_log", "security_events", "vault_secrets", "vault_secret_versions",
  "server_commands", "agent_instances", "agent_jobs", "agent_job_steps", "agent_configs", "agent_roles",
  "agent_role_bindings", "agent_capabilities", "agent_installers",
]);

function isInternalDb(db: any) {
  return db?.db_kind === "internal";
}

function isProtectedTable(schema: string, table: string) {
  if (["auth", "storage", "realtime", "supabase_functions", "vault", "pg_catalog", "information_schema"].includes(schema)) return true;
  return schema === "public" && PROTECTED_TABLES.has(table);
}

async function runInternalSql(sql: string, scalar = false): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const fn = scalar ? "tvcc_exec_sql_scalar" : "tvcc_exec_sql";
  const { data, error } = await (supabaseAdmin as any).rpc(fn, { sql });
  if (error) throw new Error(error.message);
  return data;
}

function internalCommand(action: string, args: Record<string, unknown>, output: unknown): AgentCommand {
  const now = new Date().toISOString();
  return {
    id: `internal-${action}-${Date.now()}`,
    action,
    args,
    status: "completed",
    output,
    exit_code: 0,
    created_at: now,
    completed_at: now,
  };
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
    const sortedDatabases = [...(databases.data ?? [])].sort((a: any, b: any) => {
      if (a.db_kind === "internal" && b.db_kind !== "internal") return -1;
      if (a.db_kind !== "internal" && b.db_kind === "internal") return 1;
      return String(a.name).localeCompare(String(b.name));
    });
    const selected = sortedDatabases.find((row) => row.id === data.databaseId) ?? sortedDatabases[0] ?? null;
    return {
      databases: sortedDatabases, connections: connections.data ?? [], servers: servers.data ?? [],
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

/* ============================================================
   محرر الجداول — قراءة المخططات والجداول والصفوف وتحريرها عبر الوكيل
   كل SQL يُبنى على الخادم من معرّفات محقّقة (لا نص حر من المستخدم).
   ============================================================ */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ident = (value: unknown, label: string) => {
  const text = String(value ?? "").trim();
  if (!IDENT.test(text)) throw new Error(`اسم ${label} غير صالح: ${text || "(فارغ)"}`);
  return text;
};

export const EDITOR_ACTIONS = ["pg_meta", "pg_rows", "pg_write", "pg_ddl", "db_policy", "pg_import_csv"] as const;

async function dbOrThrow(supabase: any, databaseId: string) {
  const { data: db } = await supabase.from("databases").select("*").eq("id", databaseId).single();
  if (!db) throw new Error("القاعدة غير موجودة");
  if (!db.server_id && !isInternalDb(db)) throw new Error("القاعدة غير مرتبطة بسيرفر عليه وكيل TVCC");
  return db;
}

function baseArgs(db: any) {
  return {
    database_id: db.id,
    engine: db.db_type,
    host: db.host,
    port: db.port,
    database: db.db_name ?? "postgres",
    env_key: db.env_key,
  };
}

/** آخر نتائج أوامر المحرر لهذه القاعدة (تُقرأ منها الشبكة والقوائم). */
export const getEditorCommands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: rows } = await supabase
      .from("server_commands")
      .select("id,action,args,status,output,exit_code,created_at,completed_at")
      .eq("args->>database_id", data.databaseId)
      .in("action", [...EDITOR_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(60);
    return rows ?? [];
  });

/** قراءة المخططات أو الجداول أو الأعمدة أو السياسات. */
export const readCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; mode: "schemas" | "tables" | "columns" | "policies"; schema?: string; table?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const db = await dbOrThrow(supabase, data.databaseId);
    const schema = data.schema ? ident(data.schema, "المخطط") : undefined;
    const table = data.table ? ident(data.table, "الجدول") : undefined;
    const sql = data.mode === "schemas"
      ? `select nspname as schema from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by 1`
      : data.mode === "tables"
        ? `select c.relname as name,
                  case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'matview' when 'f' then 'foreign' when 'p' then 'partitioned' else c.relkind::text end as kind,
                  c.relrowsecurity as rls_enabled,
                  coalesce(s.n_live_tup, 0) as rows,
                  pg_size_pretty(pg_total_relation_size(c.oid)) as size
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           left join pg_stat_user_tables s on s.relid = c.oid
           where n.nspname = '${schema ?? "public"}' and c.relkind in ('r','v','m','f','p')
           order by c.relname`
        : data.mode === "columns"
          ? `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull as not_null,
                    pg_get_expr(d.adbin, d.adrelid) as default_value,
                    coalesce(pk.is_pk, false) as is_primary, fk.ref as foreign_ref
             from pg_attribute a
             join pg_class c on c.oid = a.attrelid
             join pg_namespace n on n.oid = c.relnamespace
             left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
             left join lateral (select true as is_pk from pg_constraint k where k.conrelid = c.oid and k.contype='p' and a.attnum = any(k.conkey)) pk on true
             left join lateral (select (fn.nspname||'.'||fc.relname) as ref from pg_constraint k join pg_class fc on fc.oid=k.confrelid join pg_namespace fn on fn.oid=fc.relnamespace where k.conrelid=c.oid and k.contype='f' and a.attnum = any(k.conkey) limit 1) fk on true
             where n.nspname = '${schema ?? "public"}' and c.relname = '${table}' and a.attnum > 0 and not a.attisdropped
             order by a.attnum`
          : `select polname as name, cmd_label as command, roles, qual, with_check from (
               select p.polname,
                      case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end as cmd_label,
                      array_to_string(array(select rolname from pg_roles where oid = any(p.polroles)), ', ') as roles,
                      pg_get_expr(p.polqual, p.polrelid) as qual,
                      pg_get_expr(p.polwithcheck, p.polrelid) as with_check
               from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = '${schema ?? "public"}' ${table ? `and c.relname = '${table}'` : ""}
             ) t order by name`;
    if (isInternalDb(db)) {
      const rows = await runInternalSql(sql);
      return internalCommand(data.mode === "policies" ? "db_policy" : "pg_meta", {
        database_id: db.id, mode: data.mode, schema: schema ?? "public", table: table ?? null, sql, read_only: true,
      }, { rows });
    }
    return queueCommand(supabase, userId, db.server_id, data.mode === "policies" ? "db_policy" : "pg_meta", {
      ...baseArgs(db), mode: data.mode, schema: schema ?? "public", table: table ?? null, sql, read_only: true,
    });
  });

const FILTER_OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", lt: "<", gte: ">=", lte: "<=", like: "ilike", isnull: "isnull", notnull: "notnull" };

/** قراءة صفوف جدول مع فلترة وترتيب وصفحات. */
export const readTableRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    databaseId: string; schema: string; table: string; page?: number; pageSize?: number;
    sort?: { column: string; dir: "asc" | "desc" } | null;
    filters?: { column: string; op: string; value?: string }[];
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const db = await dbOrThrow(supabase, data.databaseId);
    const schema = ident(data.schema, "المخطط");
    const table = ident(data.table, "الجدول");
    const pageSize = Math.min(Math.max(Number(data.pageSize ?? 100), 1), 1000);
    const page = Math.max(Number(data.page ?? 1), 1);
    const where = (data.filters ?? []).filter((f) => f.column && FILTER_OPS[f.op]).map((f) => {
      const col = ident(f.column, "العمود");
      if (f.op === "isnull") return `"${col}" is null`;
      if (f.op === "notnull") return `"${col}" is not null`;
      const raw = String(f.value ?? "").replace(/'/g, "''");
      const value = f.op === "like" ? `'%${raw}%'` : `'${raw}'`;
      return `"${col}"::text ${FILTER_OPS[f.op]} ${value}`;
    });
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const orderSql = data.sort?.column ? `order by "${ident(data.sort.column, "العمود")}" ${data.sort.dir === "desc" ? "desc" : "asc"}` : "";
    const sql = `select * from "${schema}"."${table}" ${whereSql} ${orderSql} limit ${pageSize} offset ${(page - 1) * pageSize}`;
    const countSql = `select count(*)::bigint as total from "${schema}"."${table}" ${whereSql}`;
    if (isInternalDb(db)) {
      if (isProtectedTable(schema, table)) throw new Error("لا يمكن قراءة هذا الجدول من خلال المحرّر");
      const rows = await runInternalSql(sql);
      const total = await runInternalSql(countSql, true);
      return internalCommand("pg_rows", {
        database_id: db.id, schema, table, page, page_size: pageSize, sql, count_sql: countSql, read_only: true,
      }, { rows, total: Number(total ?? 0) });
    }
    return queueCommand(supabase, userId, db.server_id, "pg_rows", {
      ...baseArgs(db), schema, table, page, page_size: pageSize, sql, count_sql: countSql, read_only: true,
    });
  });

/** حفظ تغييرات الصفوف (إضافة/تعديل/حذف) بعد تأكيد صريح. */
export const writeTableRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    databaseId: string; schema: string; table: string; pk: string; confirm: boolean;
    inserts?: Record<string, unknown>[];
    updates?: { pk: unknown; values: Record<string, unknown> }[];
    deletes?: unknown[];
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!data.confirm) throw new Error("التغييرات تحتاج تأكيداً صريحاً قبل الحفظ");
    const db = await dbOrThrow(supabase, data.databaseId);
    const schema = ident(data.schema, "المخطط");
    const table = ident(data.table, "الجدول");
    const pk = ident(data.pk, "المفتاح الأساسي");
    const lit = (value: unknown) => value === null || value === undefined || value === ""
      ? "null"
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : `'${String(value).replace(/'/g, "''")}'`;
    const statements: string[] = [];
    for (const row of data.inserts ?? []) {
      const cols = Object.keys(row).filter((key) => IDENT.test(key));
      if (!cols.length) continue;
      statements.push(`insert into "${schema}"."${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((c) => lit(row[c])).join(", ")})`);
    }
    for (const change of data.updates ?? []) {
      const cols = Object.keys(change.values).filter((key) => IDENT.test(key));
      if (!cols.length) continue;
      statements.push(`update "${schema}"."${table}" set ${cols.map((c) => `"${c}" = ${lit(change.values[c])}`).join(", ")} where "${pk}"::text = ${lit(String(change.pk))}`);
    }
    for (const id of data.deletes ?? []) {
      statements.push(`delete from "${schema}"."${table}" where "${pk}"::text = ${lit(String(id))}`);
    }
    if (!statements.length) throw new Error("لا توجد تغييرات للحفظ");
    const command = await queueCommand(supabase, userId, db.server_id, "pg_write", {
      ...baseArgs(db), schema, table, statements, sql: statements.join(";\n"), read_only: false,
    });
    await audit(supabase, userId, "pg_write", db.id, {
      command_id: command.id, schema, table,
      inserts: data.inserts?.length ?? 0, updates: data.updates?.length ?? 0, deletes: data.deletes?.length ?? 0,
    });
    return command;
  });

type ColumnSpec = { name: string; type: string; nullable?: boolean; default?: string; primary?: boolean };
const TYPES = ["int8", "int4", "text", "varchar", "bool", "uuid", "timestamptz", "date", "numeric", "jsonb", "float8"];

/** تغييرات البنية: إنشاء جدول/عمود/فهرس، حذف عمود، تفعيل RLS. */
export const applyTableDdl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    databaseId: string; confirm: boolean;
    kind: "create_table" | "add_column" | "drop_column" | "rename_column" | "create_index" | "enable_rls" | "create_policy";
    schema: string; table: string;
    columns?: ColumnSpec[]; column?: ColumnSpec; newName?: string; rls?: boolean;
    policy?: { name: string; command: string; template: "own_rows" | "admin_only" | "public_read"; ownerColumn?: string };
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!data.confirm) throw new Error("تغييرات البنية تحتاج تأكيداً صريحاً");
    const db = await dbOrThrow(supabase, data.databaseId);
    const schema = ident(data.schema, "المخطط");
    const table = ident(data.table, "الجدول");
    const typeOf = (spec: ColumnSpec) => {
      const type = String(spec.type ?? "text").toLowerCase();
      if (!TYPES.includes(type)) throw new Error(`نوع غير مدعوم: ${type}`);
      return type;
    };
    const colSql = (spec: ColumnSpec) => {
      const name = ident(spec.name, "العمود");
      const def = spec.default ? ` default ${/^[A-Za-z0-9_().':+\- ]*$/.test(spec.default) ? spec.default : `'${spec.default.replace(/'/g, "''")}'`}` : "";
      return `"${name}" ${typeOf(spec)}${spec.nullable === false ? " not null" : ""}${def}${spec.primary ? " primary key" : ""}`;
    };
    const statements: string[] = [];
    if (data.kind === "create_table") {
      const cols = (data.columns ?? []).filter((c) => c.name);
      if (!cols.length) throw new Error("أضف عموداً واحداً على الأقل");
      statements.push(`create table "${schema}"."${table}" (${cols.map(colSql).join(", ")})`);
      statements.push(`grant select, insert, update, delete on "${schema}"."${table}" to authenticated`);
      statements.push(`grant all on "${schema}"."${table}" to service_role`);
      if (data.rls !== false) statements.push(`alter table "${schema}"."${table}" enable row level security`);
    } else if (data.kind === "add_column") {
      statements.push(`alter table "${schema}"."${table}" add column ${colSql(data.column!)}`);
    } else if (data.kind === "drop_column") {
      statements.push(`alter table "${schema}"."${table}" drop column "${ident(data.column?.name, "العمود")}"`);
    } else if (data.kind === "rename_column") {
      statements.push(`alter table "${schema}"."${table}" rename column "${ident(data.column?.name, "العمود")}" to "${ident(data.newName, "الاسم الجديد")}"`);
    } else if (data.kind === "create_index") {
      const col = ident(data.column?.name, "العمود");
      statements.push(`create index if not exists "idx_${table}_${col}" on "${schema}"."${table}" ("${col}")`);
    } else if (data.kind === "enable_rls") {
      statements.push(`alter table "${schema}"."${table}" ${data.rls === false ? "disable" : "enable"} row level security`);
    } else {
      const policy = data.policy!;
      const name = ident(policy.name, "السياسة");
      const cmd = ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"].includes(policy.command) ? policy.command : "SELECT";
      const owner = policy.ownerColumn ? ident(policy.ownerColumn, "عمود المالك") : "user_id";
      const using = policy.template === "own_rows" ? `auth.uid() = "${owner}"`
        : policy.template === "admin_only" ? `public.has_role(auth.uid(), 'admin')`
          : "true";
      const role = policy.template === "public_read" ? "anon, authenticated" : "authenticated";
      statements.push(cmd === "INSERT"
        ? `create policy "${name}" on "${schema}"."${table}" for insert to ${role} with check (${using})`
        : `create policy "${name}" on "${schema}"."${table}" for ${cmd.toLowerCase()} to ${role} using (${using})`);
    }
    const command = await queueCommand(supabase, userId, db.server_id, "pg_ddl", {
      ...baseArgs(db), schema, table, kind: data.kind, statements, sql: statements.join(";\n"), read_only: false,
    });
    await audit(supabase, userId, `pg_ddl_${data.kind}`, db.id, { command_id: command.id, schema, table, statements });
    return command;
  });

/** استيراد صفوف من CSV إلى جدول قائم. */
export const importTableCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; schema: string; table: string; csv: string; confirm: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!data.confirm) throw new Error("الاستيراد يحتاج تأكيداً صريحاً");
    const db = await dbOrThrow(supabase, data.databaseId);
    const schema = ident(data.schema, "المخطط");
    const table = ident(data.table, "الجدول");
    const csv = String(data.csv ?? "").trim();
    if (!csv) throw new Error("الملف فارغ");
    if (csv.length > 2_000_000) throw new Error("حجم CSV كبير جداً — قسّمه إلى دفعات");
    const header = csv.split(/\r?\n/)[0]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    header.forEach((c) => ident(c, "العمود"));
    const command = await queueCommand(supabase, userId, db.server_id, "pg_import_csv", {
      ...baseArgs(db), schema, table, columns: header, csv, read_only: false,
    });
    await audit(supabase, userId, "pg_import_csv", db.id, { command_id: command.id, schema, table, columns: header });
    return command;
  });

/* ============================================================
   مكتبة نماذج الجداول — معاينة وتطبيق واستخراج
   ============================================================ */

/** قائمة النماذج الجاهزة (بدون SQL). */
export const listDbTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { DB_TEMPLATES, templateSummary } = await import("./db-templates");
    return DB_TEMPLATES.map(templateSummary);
  });

type TemplateOptions = {
  databaseId: string;
  templateId: string;
  schema?: string;
  prefix?: string;
  rls?: boolean;
  seeds?: boolean;
  tables?: string[];
};

/** معاينة أوامر النموذج قبل أي تنفيذ (لا يلمس القاعدة). */
export const previewTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TemplateOptions) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { buildTemplateSql, getTemplate, templateSummary } = await import("./db-templates");
    const template = getTemplate(data.templateId);
    const statements = buildTemplateSql(template, {
      schema: data.schema, prefix: data.prefix, rls: data.rls, seeds: data.seeds, tables: data.tables,
    });
    return { summary: templateSummary(template), statements, sql: statements.join(";\n") + ";" };
  });

/** تطبيق النموذج على القاعدة عبر الوكيل (يتطلب تأكيداً صريحاً). */
export const applyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TemplateOptions & { confirm: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!data.confirm) throw new Error("تطبيق النموذج يحتاج تأكيداً صريحاً");
    const db = await dbOrThrow(supabase, data.databaseId);
    const { buildTemplateSql, getTemplate } = await import("./db-templates");
    const template = getTemplate(data.templateId);
    const schema = ident(data.schema ?? "public", "المخطط");
    const statements = buildTemplateSql(template, {
      schema, prefix: data.prefix, rls: data.rls, seeds: data.seeds, tables: data.tables,
    });
    const command = await queueCommand(supabase, userId, db.server_id, "pg_ddl", {
      ...baseArgs(db), schema, kind: "apply_template", template_id: template.id,
      statements, sql: statements.join(";\n") + ";", read_only: false,
    });
    await audit(supabase, userId, `template_apply_${template.id}`, db.id, {
      command_id: command.id, schema, tables: template.tables.length, statements: statements.length,
    });
    return command;
  });

/** فحص التوافق: يطلب من الوكيل قائمة الجداول الحالية ويُرجع أسماء جداول النموذج المتوقعة. */
export const inspectTemplateDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; templateId: string; schema?: string; prefix?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const db = await dbOrThrow(supabase, data.databaseId);
    const { getTemplate, templateTableName } = await import("./db-templates");
    const template = getTemplate(data.templateId);
    const schema = ident(data.schema ?? "public", "المخطط");
    const prefix = data.prefix ? `${ident(data.prefix, "البادئة").replace(/_?$/, "_")}` : "";
    const expected = template.tables.map((tbl) => templateTableName(prefix, tbl.name));
    const sql = `select c.relname as name, coalesce(s.n_live_tup,0) as rows
                 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 left join pg_stat_user_tables s on s.relid = c.oid
                 where n.nspname = '${schema}' and c.relkind in ('r','p') order by 1`;
    const command = await queueCommand(supabase, userId, db.server_id, "pg_meta", {
      ...baseArgs(db), mode: "tables", schema, template_id: template.id, sql, read_only: true,
    });
    return { command, expected, schema };
  });

/** استخراج نموذج من قاعدة قائمة: يطلب بنية المخطط كاملاً من الوكيل. */
export const extractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; schema?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const db = await dbOrThrow(supabase, data.databaseId);
    const schema = ident(data.schema ?? "public", "المخطط");
    const sql = `select c.relname as table_name, a.attname as column_name,
                        format_type(a.atttypid, a.atttypmod) as data_type,
                        a.attnotnull as not_null, pg_get_expr(d.adbin, d.adrelid) as default_value
                 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                 left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
                 where n.nspname = '${schema}' and c.relkind in ('r','p')
                 order by c.relname, a.attnum`;
    const command = await queueCommand(supabase, userId, db.server_id, "pg_meta", {
      ...baseArgs(db), mode: "extract_template", schema, sql, read_only: true,
    });
    await audit(supabase, userId, "template_extract", db.id, { command_id: command.id, schema });
    return command;
  });

/** ربط القاعدة بسيرفر عليه وكيل TVCC (أو فك الربط). */
export const linkDatabaseServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; serverId: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.serverId) {
      const { data: server } = await supabase.from("servers").select("id").eq("id", data.serverId).single();
      if (!server) throw new Error("السيرفر غير موجود");
    }
    const { error } = await supabase.from("databases").update({ server_id: data.serverId }).eq("id", data.databaseId);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "database_link_server", data.databaseId, { server_id: data.serverId });
    return { ok: true };
  });
