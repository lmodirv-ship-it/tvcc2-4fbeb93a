import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

/** أقسام مركز قواعد البيانات التي تُقرأ مباشرةً من القاعدة الداخلية. */
export const INSIGHT_SECTIONS = [
  "overview", "schema", "auth", "storage", "functions", "realtime",
  "advisors", "monitoring", "health", "secrets", "sync", "transfer", "activity",
] as const;
export type InsightSection = (typeof INSIGHT_SECTIONS)[number];

export type InsightGroup = { title: string; description?: string; columns: string[]; rows: Record<string, unknown>[] };
export type InsightStat = { label: string; value: string | number; tone?: "ok" | "warn" | "bad" };
export type InsightResult = { available: boolean; reason?: string; stats: InsightStat[]; groups: InsightGroup[] };

async function runSql(sql: string): Promise<any[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("tvcc_exec_sql", { sql: sql.trim().replace(/[\s;]+$/, "") });
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

async function safe(sql: string): Promise<any[]> {
  try { return await runSql(sql); } catch { return []; }
}

function group(title: string, rows: any[], columns: string[], description?: string): InsightGroup {
  return { title, description, columns, rows };
}

const Q = {
  size: `SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
           (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
           (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tables,
           version() AS version`,
  biggest: `SELECT relname AS table_name, n_live_tup AS live_rows,
              pg_size_pretty(pg_total_relation_size(relid)) AS total_size
            FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 25`,
  columns: `SELECT table_name, column_name, data_type, is_nullable, coalesce(column_default,'—') AS default_value
            FROM information_schema.columns WHERE table_schema='public'
            ORDER BY table_name, ordinal_position LIMIT 400`,
  fks: `SELECT tc.table_name AS from_table, kcu.column_name AS from_column,
          ccu.table_name AS to_table, ccu.column_name AS to_column, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
        ORDER BY tc.table_name LIMIT 400`,
  indexes: `SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
            FROM pg_indexes WHERE schemaname='public' ORDER BY tablename LIMIT 300`,
  users: `SELECT email, coalesce(raw_user_meta_data->>'full_name','—') AS full_name,
            to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at,
            coalesce(to_char(last_sign_in_at,'YYYY-MM-DD HH24:MI'),'—') AS last_sign_in,
            CASE WHEN email_confirmed_at IS NULL THEN 'غير مؤكد' ELSE 'مؤكد' END AS confirmed
          FROM auth.users ORDER BY created_at DESC LIMIT 200`,
  roles: `SELECT u.email, ur.role::text AS role FROM public.user_roles ur
          JOIN auth.users u ON u.id = ur.user_id ORDER BY u.email LIMIT 200`,
  buckets: `SELECT id AS bucket, CASE WHEN public THEN 'عام' ELSE 'خاص' END AS visibility,
              coalesce(file_size_limit,0) AS size_limit,
              (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id) AS objects
            FROM storage.buckets b ORDER BY id`,
  objects: `SELECT bucket_id AS bucket, name, coalesce((metadata->>'size')::bigint,0) AS size_bytes,
              to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at
            FROM storage.objects ORDER BY created_at DESC LIMIT 100`,
  functions: `SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
                CASE p.prosecdef WHEN true THEN 'security definer' ELSE 'invoker' END AS security,
                l.lanname AS language
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              JOIN pg_language l ON l.oid=p.prolang
              WHERE n.nspname='public' ORDER BY p.proname LIMIT 200`,
  triggers: `SELECT event_object_table AS table_name, trigger_name, action_timing AS timing,
               event_manipulation AS event
             FROM information_schema.triggers WHERE trigger_schema='public'
             ORDER BY event_object_table LIMIT 300`,
  realtime: `SELECT p.pubname AS publication, pt.schemaname AS schema, pt.tablename AS table_name
             FROM pg_publication p LEFT JOIN pg_publication_tables pt ON pt.pubname = p.pubname
             ORDER BY p.pubname, pt.tablename LIMIT 300`,
  rlsOff: `SELECT c.relname AS table_name, 'RLS غير مفعّل' AS issue, 'حرج' AS level
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity = false
           ORDER BY c.relname`,
  noPolicy: `SELECT c.relname AS table_name, 'RLS مفعّل بلا سياسات' AS issue, 'حرج' AS level
             FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity = true
               AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
             ORDER BY c.relname`,
  noPk: `SELECT c.relname AS table_name, 'بدون مفتاح أساسي' AS issue, 'تحذير' AS level
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind='r'
           AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='p')
         ORDER BY c.relname`,
  unindexedFk: `SELECT tc.table_name, tc.constraint_name AS issue, 'أداء' AS level
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
                WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
                  AND NOT EXISTS (
                    SELECT 1 FROM pg_indexes i WHERE i.schemaname='public'
                      AND i.tablename=tc.table_name AND i.indexdef LIKE '%'||kcu.column_name||'%')
                ORDER BY tc.table_name LIMIT 100`,
  activity: `SELECT state, count(*) AS sessions,
               coalesce(max(extract(epoch from (now()-query_start)))::int,0) AS longest_seconds
             FROM pg_stat_activity WHERE datname=current_database() GROUP BY state ORDER BY sessions DESC`,
  statDb: `SELECT numbackends AS connections, xact_commit AS commits, xact_rollback AS rollbacks,
             blks_hit AS cache_hits, blks_read AS disk_reads, tup_inserted AS inserted,
             tup_updated AS updated, tup_deleted AS deleted, deadlocks
           FROM pg_stat_database WHERE datname=current_database()`,
  limits: `SELECT current_setting('max_connections') AS max_connections,
             (SELECT count(*)::text FROM pg_stat_activity) AS used_connections,
             current_setting('statement_timeout') AS statement_timeout,
             current_setting('idle_in_transaction_session_timeout') AS idle_timeout,
             current_setting('TimeZone') AS timezone,
             current_setting('server_encoding') AS encoding`,
  bloat: `SELECT relname AS table_name, n_dead_tup AS dead_rows, n_live_tup AS live_rows,
            coalesce(to_char(last_autovacuum,'YYYY-MM-DD HH24:MI'),'—') AS last_autovacuum
          FROM pg_stat_user_tables WHERE n_dead_tup > 0 ORDER BY n_dead_tup DESC LIMIT 25`,
};

async function build(section: InsightSection, supabase: any, databaseId: string): Promise<InsightResult> {
  const stats: InsightStat[] = [];
  const groups: InsightGroup[] = [];

  if (section === "overview" || section === "health" || section === "monitoring") {
    const [size] = await safe(Q.size);
    if (size) {
      stats.push({ label: "حجم القاعدة", value: size.size ?? "—" });
      stats.push({ label: "عدد الجداول", value: size.tables ?? 0 });
      stats.push({ label: "الاتصالات الحالية", value: size.connections ?? 0 });
    }
  }

  if (section === "overview") {
    groups.push(group("أكبر الجداول", await safe(Q.biggest), ["table_name", "live_rows", "total_size"]));
  }

  if (section === "schema") {
    const [cols, fks, idx] = await Promise.all([safe(Q.columns), safe(Q.fks), safe(Q.indexes)]);
    stats.push({ label: "الأعمدة", value: cols.length }, { label: "المفاتيح الأجنبية", value: fks.length }, { label: "الفهارس", value: idx.length });
    groups.push(group("العلاقات (المفاتيح الأجنبية)", fks, ["from_table", "from_column", "to_table", "to_column", "constraint_name"]));
    groups.push(group("الفهارس", idx, ["table_name", "index_name", "definition"]));
    groups.push(group("الأعمدة", cols, ["table_name", "column_name", "data_type", "is_nullable", "default_value"]));
  }

  if (section === "auth") {
    const [users, roles] = await Promise.all([safe(Q.users), safe(Q.roles)]);
    stats.push({ label: "الحسابات", value: users.length }, { label: "أدوار ممنوحة", value: roles.length });
    groups.push(group("مستخدمو المنصة", users, ["email", "full_name", "confirmed", "last_sign_in", "created_at"]));
    groups.push(group("الأدوار", roles, ["email", "role"]));
  }

  if (section === "storage") {
    const [buckets, objects] = await Promise.all([safe(Q.buckets), safe(Q.objects)]);
    const total = objects.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);
    stats.push({ label: "الحاويات", value: buckets.length }, { label: "أحدث الملفات", value: objects.length }, { label: "حجمها", value: `${(total / 1048576).toFixed(1)} MB` });
    groups.push(group("الحاويات", buckets, ["bucket", "visibility", "objects", "size_limit"]));
    groups.push(group("أحدث الملفات", objects, ["bucket", "name", "size_bytes", "created_at"]));
  }

  if (section === "functions") {
    const [fns, trg] = await Promise.all([safe(Q.functions), safe(Q.triggers)]);
    stats.push({ label: "الدوال", value: fns.length }, { label: "المحفّزات", value: trg.length });
    groups.push(group("الدوال", fns, ["name", "arguments", "security", "language"]));
    groups.push(group("المحفّزات", trg, ["table_name", "trigger_name", "timing", "event"]));
  }

  if (section === "realtime") {
    const rows = await safe(Q.realtime);
    const enabled = rows.filter((r) => r.table_name).length;
    stats.push({ label: "منشورات", value: new Set(rows.map((r) => r.publication)).size }, { label: "جداول تبث", value: enabled });
    groups.push(group("الجداول المنشورة للبث الحي", rows, ["publication", "schema", "table_name"]));
  }

  if (section === "advisors") {
    const [rlsOff, noPolicy, noPk, fkIdx] = await Promise.all([safe(Q.rlsOff), safe(Q.noPolicy), safe(Q.noPk), safe(Q.unindexedFk)]);
    const critical = rlsOff.length + noPolicy.length;
    stats.push(
      { label: "مشاكل حرجة", value: critical, tone: critical ? "bad" : "ok" },
      { label: "تحذيرات بنية", value: noPk.length, tone: noPk.length ? "warn" : "ok" },
      { label: "فرص أداء", value: fkIdx.length, tone: fkIdx.length ? "warn" : "ok" },
    );
    groups.push(group("أمان: RLS غير مفعّل", rlsOff, ["table_name", "issue", "level"], "كل جدول هنا مكشوف لأي اتصال مسموح."));
    groups.push(group("أمان: بلا سياسات", noPolicy, ["table_name", "issue", "level"]));
    groups.push(group("بنية: بلا مفتاح أساسي", noPk, ["table_name", "issue", "level"]));
    groups.push(group("أداء: مفاتيح أجنبية بلا فهرس", fkIdx, ["table_name", "issue", "level"]));
  }

  if (section === "monitoring") {
    const [act, stat, bloat] = await Promise.all([safe(Q.activity), safe(Q.statDb), safe(Q.bloat)]);
    const s = stat[0];
    if (s) {
      const hit = Number(s.cache_hits ?? 0), read = Number(s.disk_reads ?? 0);
      const ratio = hit + read ? ((hit / (hit + read)) * 100).toFixed(1) : "—";
      stats.push({ label: "نسبة الذاكرة المؤقتة", value: `${ratio}%` }, { label: "التعاملات المنفّذة", value: s.commits ?? 0 }, { label: "الأقفال المتعارضة", value: s.deadlocks ?? 0, tone: Number(s.deadlocks) ? "warn" : "ok" });
      groups.push(group("إحصاءات القاعدة", stat, ["connections", "commits", "rollbacks", "cache_hits", "disk_reads", "inserted", "updated", "deleted", "deadlocks"]));
    }
    groups.push(group("الجلسات الحالية", act, ["state", "sessions", "longest_seconds"]));
    groups.push(group("جداول تحتاج تنظيفاً", bloat, ["table_name", "dead_rows", "live_rows", "last_autovacuum"]));
  }

  if (section === "health") {
    const [limits, biggest, bloat] = await Promise.all([safe(Q.limits), safe(Q.biggest), safe(Q.bloat)]);
    const l = limits[0];
    if (l) {
      const used = Number(l.used_connections ?? 0), max = Number(l.max_connections ?? 0);
      stats.push({ label: "الاتصالات", value: `${used} / ${max}`, tone: max && used / max > 0.8 ? "bad" : "ok" });
      groups.push(group("الحدود والإعدادات", limits, ["max_connections", "used_connections", "statement_timeout", "idle_timeout", "timezone", "encoding"]));
    }
    groups.push(group("أثقل الجداول", biggest, ["table_name", "live_rows", "total_size"]));
    groups.push(group("صفوف ميتة تحتاج تنظيفاً", bloat, ["table_name", "dead_rows", "live_rows", "last_autovacuum"]));
  }

  if (section === "secrets") {
    const { data: rows } = await supabase.from("vault_secrets")
      .select("id,name,category,description,last_rotated_at,rotation_period_days,expires_at,updated_at").order("name").limit(200);
    const list = (rows ?? []).map((r: any) => ({
      name: r.name, category: r.category ?? "—", description: r.description ?? "—",
      last_rotated_at: r.last_rotated_at ? new Date(r.last_rotated_at).toLocaleString("ar") : "—",
      expires_at: r.expires_at ? new Date(r.expires_at).toLocaleString("ar") : "—",
      updated_at: r.updated_at ? new Date(r.updated_at).toLocaleString("ar") : "—",
    }));
    const expiring = list.filter((r: any) => r.expires_at !== "—").length;
    stats.push({ label: "الأسرار المحفوظة", value: list.length }, { label: "لها تاريخ انتهاء", value: expiring });
    groups.push(group("الأسماء فقط — القيم لا تغادر الخزنة", list, ["name", "category", "description", "last_rotated_at", "expires_at", "updated_at"]));
  }

  if (section === "sync") {
    const { data: syncs } = await supabase.from("site_storage_syncs")
      .select("id,domain,status,auto_sync,interval_minutes,file_count,size_bytes,last_synced_at,last_output").order("updated_at", { ascending: false }).limit(100);
    const rows = (syncs ?? []).map((r: any) => ({
      domain: r.domain ?? "—", status: r.status ?? "—",
      auto_sync: r.auto_sync ? `كل ${r.interval_minutes ?? 0} دقيقة` : "يدوي",
      files: r.file_count ?? 0,
      size: r.size_bytes ? `${(r.size_bytes / 1048576).toFixed(1)} MB` : "—",
      last_synced_at: r.last_synced_at ? new Date(r.last_synced_at).toLocaleString("ar") : "—",
    }));
    const failed = rows.filter((r: any) => r.status === "failed" || r.status === "error").length;
    stats.push({ label: "مهام المزامنة", value: rows.length }, { label: "متعثّرة", value: failed, tone: failed ? "warn" : "ok" });
    groups.push(group("مهام المزامنة", rows, ["domain", "status", "auto_sync", "files", "size", "last_synced_at"]));
  }

  if (section === "transfer") {
    const { data: transfers } = await supabase.from("file_transfers")
      .select("id,name,mode,status,dry_run,file_count,size_bytes,target_path,created_at").order("created_at", { ascending: false }).limit(100);
    const rows = (transfers ?? []).map((r: any) => ({
      name: r.name ?? "—", mode: r.mode ?? "—", status: r.status ?? "—",
      files: r.file_count ?? 0,
      size: r.size_bytes ? `${(r.size_bytes / 1048576).toFixed(1)} MB` : "—",
      target_path: r.target_path ?? "—",
      created_at: new Date(r.created_at).toLocaleString("ar"),
    }));
    stats.push({ label: "عمليات النقل", value: rows.length });
    groups.push(group("آخر عمليات الاستيراد والتصدير", rows, ["name", "mode", "status", "files", "size", "target_path", "created_at"]));
  }

  if (section === "activity") {
    const [{ data: audits }, { data: events }] = await Promise.all([
      supabase.from("audit_log").select("action,resource,resource_id,severity,created_at").order("created_at", { ascending: false }).limit(150),
      supabase.from("security_events").select("category,action,resource,severity,created_at").order("created_at", { ascending: false }).limit(150),
    ]);
    const a = (audits ?? []).map((r: any) => ({
      action: r.action, resource: r.resource ?? "—", resource_id: (r.resource_id ?? "—").toString().slice(0, 12),
      severity: r.severity ?? "info", created_at: new Date(r.created_at).toLocaleString("ar"),
    }));
    const e = (events ?? []).map((r: any) => ({
      category: r.category, action: r.action, resource: r.resource ?? "—",
      severity: r.severity ?? "info", created_at: new Date(r.created_at).toLocaleString("ar"),
    }));
    stats.push({ label: "عمليات مسجّلة", value: a.length }, { label: "أحداث أمنية", value: e.length });
    groups.push(group("سجل العمليات", a, ["action", "resource", "resource_id", "severity", "created_at"]));
    groups.push(group("الأحداث الأمنية", e, ["category", "action", "resource", "severity", "created_at"]));
  }

  return { available: true, stats, groups };
}

/** قراءة حيّة لقسم واحد من مركز قواعد البيانات (القاعدة الداخلية فقط). */
export const getDbInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { databaseId: string; section: string }) => input)
  .handler(async ({ data, context }): Promise<InsightResult> => {
    const { supabase, userId } = context;
    if (!(await isAdminOrOwner(supabase, userId))) throw new Error("هذه البيانات متاحة للمالك والمدير فقط");
    const section = data.section as InsightSection;
    if (!INSIGHT_SECTIONS.includes(section)) return { available: false, reason: "قسم غير مدعوم للقراءة المباشرة", stats: [], groups: [] };
    const { data: db } = await supabase.from("databases").select("id,db_kind,name").eq("id", data.databaseId).single();
    if (!db) throw new Error("القاعدة غير موجودة");
    if (db.db_kind !== "internal") {
      return { available: false, reason: "القراءة المباشرة متاحة لقاعدة TVCC الداخلية — القواعد الخارجية تُقرأ عبر الوكيل", stats: [], groups: [] };
    }
    return build(section, supabase, db.id);
  });
