import { timingSafeEqual } from "crypto";

/**
 * Server-only helpers for the local → platform database sync.
 * Local rows land in the dedicated `local_mirror` schema, never in platform tables.
 * Nothing here ever drops or deletes anything.
 */

export const MIRROR_SCHEMA = "local_mirror";

export function checkSyncSecret(request: Request): boolean {
  const secret = process.env["DBSYNC_INGEST_SECRET"];
  if (!secret) return false;
  const provided = request.headers.get("x-tvcc-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** اسم آمن: أحرف وأرقام وشرطة سفلية فقط، بحد أقصى 63 حرفاً. */
export function safeIdent(name: unknown): string {
  const s = String(name ?? "").trim().toLowerCase();
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(s)) throw new Error(`اسم غير صالح: ${s}`);
  return s;
}

export function quoteIdent(name: unknown): string {
  return `"${safeIdent(name)}"`;
}

export function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

const ALLOWED_TYPES = new Set([
  "text", "varchar", "character varying", "char", "character", "citext", "uuid",
  "int2", "int4", "int8", "smallint", "integer", "bigint", "numeric", "decimal",
  "real", "double precision", "float4", "float8", "boolean", "bool",
  "json", "jsonb", "date", "time", "timetz", "timestamp", "timestamptz",
  "timestamp with time zone", "timestamp without time zone", "inet", "cidr", "macaddr",
  "bytea", "interval",
]);

/** أي نوع غير معروف يُحفظ كنص حتى لا تفشل المزامنة. */
export function mapType(raw: unknown): string {
  const t = String(raw ?? "text").trim().toLowerCase();
  if (t.endsWith("[]")) {
    const base = t.slice(0, -2);
    return ALLOWED_TYPES.has(base) ? `${base}[]` : "text[]";
  }
  return ALLOWED_TYPES.has(t) ? t : "text";
}

export async function runSql(sql: string): Promise<any[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("tvcc_exec_sql", { sql });
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

export type ColumnSpec = { name: string; type: string };

/** ينشئ الجدول في local_mirror أو يضيف الأعمدة الناقصة فقط — بلا حذف أو تغيير نوع. */
export async function ensureMirrorTable(
  mirrorName: string,
  columns: ColumnSpec[],
  primaryKey: string[],
): Promise<void> {
  const table = safeIdent(mirrorName);
  const cols = columns.map((c) => ({ name: safeIdent(c.name), type: mapType(c.type) }));
  if (!cols.length) throw new Error("لا توجد أعمدة");
  const pk = primaryKey.map(safeIdent).filter((p) => cols.some((c) => c.name === p));

  const existing = await runSql(
    `select column_name from information_schema.columns
     where table_schema = '${MIRROR_SCHEMA}' and table_name = '${table}'`,
  );

  if (!existing.length) {
    const defs = cols.map((c) => `"${c.name}" ${c.type}`).join(", ");
    const pkClause = pk.length ? `, PRIMARY KEY (${pk.map((p) => `"${p}"`).join(", ")})` : "";
    await runSql(
      `CREATE TABLE IF NOT EXISTS ${MIRROR_SCHEMA}."${table}" (
         ${defs},
         _synced_at timestamptz NOT NULL DEFAULT now(),
         _source text
         ${pkClause}
       )`,
    );
    await runSql(`GRANT SELECT ON ${MIRROR_SCHEMA}."${table}" TO authenticated`);
    await runSql(`GRANT ALL ON ${MIRROR_SCHEMA}."${table}" TO service_role`);
    return;
  }

  const have = new Set(existing.map((r: any) => String(r.column_name)));
  for (const c of cols) {
    if (!have.has(c.name)) {
      await runSql(`ALTER TABLE ${MIRROR_SCHEMA}."${table}" ADD COLUMN IF NOT EXISTS "${c.name}" ${c.type}`);
    }
  }
  if (!have.has("_synced_at")) {
    await runSql(`ALTER TABLE ${MIRROR_SCHEMA}."${table}" ADD COLUMN IF NOT EXISTS _synced_at timestamptz DEFAULT now()`);
  }
  if (!have.has("_source")) {
    await runSql(`ALTER TABLE ${MIRROR_SCHEMA}."${table}" ADD COLUMN IF NOT EXISTS _source text`);
  }
}

/** upsert دفعة صفوف بالمفتاح الأساسي؛ بدون مفتاح يتم الإدراج فقط. */
export async function upsertRows(
  mirrorName: string,
  columns: string[],
  primaryKey: string[],
  rows: Record<string, unknown>[],
  sourceLabel: string,
): Promise<number> {
  if (!rows.length) return 0;
  const table = safeIdent(mirrorName);
  const cols = columns.map(safeIdent);
  const pk = primaryKey.map(safeIdent).filter((p) => cols.includes(p));

  const values = rows
    .map((row) => `(${cols.map((c) => quoteLiteral((row as any)[c])).join(", ")}, now(), ${quoteLiteral(sourceLabel)})`)
    .join(",\n");

  const colList = [...cols.map((c) => `"${c}"`), "_synced_at", "_source"].join(", ");
  const conflict = pk.length
    ? `ON CONFLICT (${pk.map((p) => `"${p}"`).join(", ")}) DO UPDATE SET ${[
        ...cols.filter((c) => !pk.includes(c)).map((c) => `"${c}" = EXCLUDED."${c}"`),
        "_synced_at = now()",
        "_source = EXCLUDED._source",
      ].join(", ")}`
    : "";

  await runSql(
    `INSERT INTO ${MIRROR_SCHEMA}."${table}" (${colList}) VALUES\n${values}\n${conflict}`,
  );
  return rows.length;
}

export async function mirrorRowCount(mirrorName: string): Promise<number> {
  try {
    const out = await runSql(`select count(*)::bigint as n from ${MIRROR_SCHEMA}."${safeIdent(mirrorName)}"`);
    return Number(out?.[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/** اسم الجدول داخل المرآة: <source_slug>__<table> حتى لا تتعارض المصادر. */
export function mirrorTableName(sourceSlug: string, tableName: string): string {
  const slug = String(sourceSlug).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "src";
  const table = safeIdent(tableName);
  return safeIdent(`${slug}__${table}`.slice(0, 63));
}
