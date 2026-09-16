/** مولّد سكريبت المزامنة المحلي ودالة Edge البديلة. لا يحذف أي شيء أبداً. */

export function buildSyncScript(opts: {
  platformUrl: string;
  sourceId: string;
  secret: string;
  schema: string;
  intervalSeconds: number;
  pgUrl: string;
}): string {
  const { platformUrl, sourceId, secret, schema, intervalSeconds, pgUrl } = opts;
  return `#!/usr/bin/env node
// tvcc-dbsync.js — مزامنة سوبابيز المحلي مع منصة TVCC (اتجاه واحد: محلي ← المنصة)
// التشغيل:  node tvcc-dbsync.js            (يعمل باستمرار)
//           node tvcc-dbsync.js --once     (دورة واحدة)
//           node tvcc-dbsync.js --dry-run  (بدون إرسال)
// يتطلب: node 18+ و psql على نفس الجهاز. لا يحذف أي جدول أو صف.

const { execFileSync } = require("child_process");

const PLATFORM = process.env.TVCC_URL || ${JSON.stringify(platformUrl)};
const SOURCE_ID = process.env.TVCC_SOURCE_ID || ${JSON.stringify(sourceId)};
const SECRET = process.env.TVCC_SECRET || ${JSON.stringify(secret)};
const PGURL = process.env.TVCC_PGURL || ${JSON.stringify(pgUrl)};
const SCHEMA = process.env.TVCC_SCHEMA || ${JSON.stringify(schema)};
const INTERVAL = Number(process.env.TVCC_INTERVAL || ${intervalSeconds}) * 1000;
const BATCH = Number(process.env.TVCC_BATCH || 2000);
const ONCE = process.argv.includes("--once");
const DRY = process.argv.includes("--dry-run");

function log(...a) { console.log(new Date().toISOString(), ...a); }

function q(sql) {
  const wrapped = "select coalesce(json_agg(t), '[]'::json)::text from (" + sql + ") t";
  const out = execFileSync("psql", [PGURL, "-At", "-c", wrapped], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out.trim() || "[]");
}

async function api(path, method, body) {
  const res = await fetch(PLATFORM + path, {
    method,
    headers: { "Content-Type": "application/json", "x-tvcc-secret": SECRET },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error("HTTP " + res.status + " " + (data && data.error ? data.error : ""));
  return data;
}

function discover() {
  const tables = q(
    "select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace " +
    "where n.nspname = '" + SCHEMA + "' and c.relkind='r' order by 1"
  ).map(function (r) { return r.name; });

  return tables.map(function (name) {
    const columns = q(
      "select column_name as name, data_type as type from information_schema.columns " +
      "where table_schema='" + SCHEMA + "' and table_name='" + name + "' order by ordinal_position"
    );
    const pk = q(
      "select a.attname as name from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey) " +
      "where i.indrelid = '" + SCHEMA + "." + name + "'::regclass and i.indisprimary"
    ).map(function (r) { return r.name; });
    const names = columns.map(function (c) { return c.name; });
    const cursorColumn = ["updated_at", "created_at", "inserted_at", "id"].find(function (c) { return names.includes(c); }) || null;
    const count = q("select count(*)::bigint as n from \\"" + SCHEMA + "\\".\\"" + name + "\\"")[0];
    return {
      name: name,
      columns: columns,
      primaryKey: pk,
      strategy: cursorColumn ? "cursor" : "checksum",
      cursorColumn: cursorColumn,
      localRows: Number(count && count.n ? count.n : 0),
    };
  });
}

function fetchRows(table, cursorColumn, lastCursor) {
  const where = cursorColumn && lastCursor
    ? " where \\"" + cursorColumn + "\\" > '" + String(lastCursor).replace(/'/g, "''") + "'"
    : "";
  const order = cursorColumn ? " order by \\"" + cursorColumn + "\\" asc" : "";
  return q("select * from \\"" + SCHEMA + "\\".\\"" + table + "\\"" + where + order + " limit " + BATCH);
}

function localCount(table) {
  const r = q("select count(*)::bigint as n from \\"" + SCHEMA + "\\".\\"" + table + "\\"")[0];
  return Number(r && r.n ? r.n : 0);
}

async function cycle() {
  const schemaTables = discover();
  log("جداول محلية:", schemaTables.length);
  if (DRY) { log("[dry-run] لن يتم الإرسال"); return; }

  await api("/api/public/dbsync/schema", "POST", { sourceId: SOURCE_ID, tables: schemaTables });
  const state = await api("/api/public/dbsync/state?source=" + encodeURIComponent(SOURCE_ID), "GET");
  if (!state.source.active) { log("المصدر متوقف من المنصة"); return; }

  for (const t of state.tables) {
    try {
      const rows = fetchRows(t.table_name, t.cursor_column, t.last_cursor);
      if (!rows.length) continue;
      const cursor = t.cursor_column ? rows[rows.length - 1][t.cursor_column] : null;
      const res = await api("/api/public/dbsync/push", "POST", {
        sourceId: SOURCE_ID,
        table: t.table_name,
        rows: rows,
        cursor: cursor,
        localRows: localCount(t.table_name),
      });
      log(t.table_name, "أُرسل", rows.length, "مطبّق", res.applied);
    } catch (e) {
      log("خطأ في", t.table_name, e.message);
    }
  }
}

async function main() {
  while (true) {
    try { await cycle(); } catch (e) { log("دورة فاشلة:", e.message); }
    if (ONCE || DRY) return;
    await new Promise(function (r) { setTimeout(r, INTERVAL); });
  }
}

main();
`;
}

export function buildEdgeFunction(opts: {
  platformUrl: string;
  sourceId: string;
  secret: string;
  schema: string;
}): string {
  const { platformUrl, sourceId, secret, schema } = opts;
  return `// supabase/functions/tvcc-sync/index.ts  (سوبابيز المحلي)
// انشرها بـ: supabase functions deploy tvcc-sync --no-verify-jwt
// ثم ناديها كل دقيقة عبر pg_cron + pg_net أو cron النظام:
//   curl -X POST http://192.168.100.66:8000/functions/v1/tvcc-sync
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const PLATFORM = ${JSON.stringify(platformUrl)};
const SOURCE_ID = ${JSON.stringify(sourceId)};
const SECRET = ${JSON.stringify(secret)};
const SCHEMA = ${JSON.stringify(schema)};
// Transaction pooler أو Direct connection للقاعدة المحلية
const DB_URL = Deno.env.get("TVCC_PGURL") ?? "postgresql://postgres:postgres@db:5432/postgres";
const BATCH = 2000;

const sql = postgres(DB_URL, { prepare: false });

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(PLATFORM + path, {
    method,
    headers: { "Content-Type": "application/json", "x-tvcc-secret": SECRET },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()));
  return await res.json();
}

Deno.serve(async () => {
  const tables = await sql\`select c.relname as name from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = \${SCHEMA} and c.relkind = 'r' order by 1\`;

  const described = [];
  for (const t of tables) {
    const columns = await sql\`select column_name as name, data_type as type
      from information_schema.columns
      where table_schema = \${SCHEMA} and table_name = \${t.name} order by ordinal_position\`;
    const pk = await sql\`select a.attname as name from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = (\${SCHEMA} || '.' || \${t.name})::regclass and i.indisprimary\`;
    const names = columns.map((c: any) => c.name);
    const cursorColumn = ["updated_at", "created_at", "inserted_at", "id"].find((c) => names.includes(c)) ?? null;
    described.push({
      name: t.name,
      columns: columns.map((c: any) => ({ name: c.name, type: c.type })),
      primaryKey: pk.map((p: any) => p.name),
      strategy: cursorColumn ? "cursor" : "checksum",
      cursorColumn,
    });
  }

  await api("/api/public/dbsync/schema", "POST", { sourceId: SOURCE_ID, tables: described });
  const state = await api("/api/public/dbsync/state?source=" + SOURCE_ID, "GET");

  let sent = 0;
  for (const t of state.tables) {
    const ident = sql(SCHEMA + "." + t.table_name);
    const rows = t.cursor_column && t.last_cursor
      ? await sql\`select * from \${ident} where \${sql(t.cursor_column)} > \${t.last_cursor}
          order by \${sql(t.cursor_column)} asc limit \${BATCH}\`
      : await sql\`select * from \${ident} limit \${BATCH}\`;
    if (!rows.length) continue;
    const cursor = t.cursor_column ? rows[rows.length - 1][t.cursor_column] : null;
    await api("/api/public/dbsync/push", "POST", {
      sourceId: SOURCE_ID, table: t.table_name, rows, cursor,
    });
    sent += rows.length;
  }

  return Response.json({ ok: true, tables: state.tables.length, rows: sent });
});
`;
}

/** نبضة دورية من قاعدة السيرفر المحلي إلى المنصة — تبدأ المزامنة وتُظهر المصدر «متصل». */
export function buildHeartbeatScript(opts: {
  platformUrl: string;
  sourceId: string;
  secret: string;
  schema: string;
  intervalSeconds: number;
  pgUrl: string;
}): string {
  const { platformUrl, sourceId, secret, schema, intervalSeconds, pgUrl } = opts;
  return `#!/usr/bin/env node
// tvcc-heartbeat.js — نبضة دورية من القاعدة المحلية إلى منصة TVCC
// التشغيل الدائم:  nohup node tvcc-heartbeat.js &
// دورة واحدة:      node tvcc-heartbeat.js --once
// يتطلب node 18+ و psql. لا يحذف ولا يعدّل أي بيانات — قراءة فقط.

const { execFileSync } = require("child_process");

const PLATFORM = process.env.TVCC_URL || ${JSON.stringify(platformUrl)};
const SOURCE_ID = process.env.TVCC_SOURCE_ID || ${JSON.stringify(sourceId)};
const SECRET = process.env.TVCC_SECRET || ${JSON.stringify(secret)};
const PGURL = process.env.TVCC_PGURL || ${JSON.stringify(pgUrl)};
const SCHEMA = process.env.TVCC_SCHEMA || ${JSON.stringify(schema)};
let INTERVAL = Number(process.env.TVCC_INTERVAL || ${intervalSeconds}) * 1000;
const ONCE = process.argv.includes("--once");

function log() { console.log.apply(console, [new Date().toISOString()].concat([].slice.call(arguments))); }

function q(sql) {
  const wrapped = "select coalesce(json_agg(t), '[]'::json)::text from (" + sql + ") t";
  const out = execFileSync("psql", [PGURL, "-At", "-c", wrapped], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.trim() || "[]");
}

function counts() {
  return q(
    "select relname as \\"table\\", coalesce(n_live_tup,0)::bigint as rows from pg_stat_user_tables " +
    "where schemaname = '" + SCHEMA + "' order by 1"
  ).map(function (r) { return { table: r.table, rows: Number(r.rows) }; });
}

async function beat() {
  const started = Date.now();
  const rows = counts();
  const res = await fetch(PLATFORM + "/api/public/dbsync/beat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tvcc-secret": SECRET },
    body: JSON.stringify({
      sourceId: SOURCE_ID,
      counts: rows,
      lagSeconds: Math.round((Date.now() - started) / 1000),
    }),
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok || !data.ok) throw new Error("HTTP " + res.status + " " + (data.error || ""));
  if (data.interval_seconds) INTERVAL = data.interval_seconds * 1000;
  log("نبضة مرسلة — جداول:", rows.length, "| مُحدَّث:", data.tablesUpdated, "| المصدر فعّال:", data.active);
}

async function main() {
  while (true) {
    try { await beat(); } catch (e) { log("فشل النبضة:", e.message); }
    if (ONCE) return;
    await new Promise(function (r) { setTimeout(r, INTERVAL); });
  }
}

main();
`;
}
