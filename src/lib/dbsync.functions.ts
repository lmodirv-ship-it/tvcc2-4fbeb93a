import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

async function assertAdmin(supabase: any, userId: string) {
  const ok = await isAdminOrOwner(supabase, userId);
  if (!ok) throw new Error("المزامنة متاحة للمالك والمدير فقط");
}

export const listSyncState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const [{ data: sources }, { data: tables }, { data: batches }, { data: servers }, { data: websites }] =
      await Promise.all([
        supabase.from("db_sync_sources").select("*").order("created_at"),
        supabase.from("db_sync_tables").select("*").order("table_name"),
        supabase.from("db_sync_batches").select("*").order("created_at", { ascending: false }).limit(60),
        supabase.from("servers").select("id,name,hostname,public_ip,private_ip,status").limit(200),
        supabase.from("websites").select("id,name,domain,site_code").order("name").limit(300),
      ]);

    return {
      sources: sources ?? [],
      tables: tables ?? [],
      batches: batches ?? [],
      servers: servers ?? [],
      websites: websites ?? [],
    };
  });

export const upsertSyncSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string | null;
    label: string;
    host: string;
    port?: number;
    databaseName?: string;
    schemaName?: string;
    mode?: "script" | "edge";
    serverId?: string | null;
    websiteId?: string | null;
    intervalSeconds?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const label = String(data.label || "").trim().slice(0, 80);
    const host = String(data.host || "").trim();
    if (!label) throw new Error("اسم المصدر مطلوب");
    if (!host) throw new Error("عنوان السيرفر المحلي مطلوب");

    const payload = {
      owner_id: userId,
      label,
      host,
      port: data.port ?? 8000,
      database_name: data.databaseName || "postgres",
      schema_name: data.schemaName || "public",
      mode: data.mode === "edge" ? "edge" : "script",
      server_id: data.serverId || null,
      website_id: data.websiteId || null,
      interval_seconds: Math.min(3600, Math.max(30, data.intervalSeconds ?? 60)),
    };

    const q = data.id
      ? supabase.from("db_sync_sources").update(payload).eq("id", data.id).select("*").maybeSingle()
      : supabase.from("db_sync_sources").insert(payload).select("*").maybeSingle();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { source: row };
  });

export const toggleSyncSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("db_sync_sources")
      .update({ is_active: data.active, status: data.active ? "pending" : "paused" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSyncTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("db_sync_tables").update({ is_enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إعادة مطابقة كاملة: تصفير المؤشر فقط — لا حذف لأي صف في المرآة. */
export const resyncSyncTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("db_sync_tables")
      .update({ last_cursor: null, last_status: "pending", last_error: null, is_enabled: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSyncScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string; kind: "script" | "edge" | "heartbeat"; pgUrl?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { data: source } = await supabase
      .from("db_sync_sources")
      .select("id,label,host,port,schema_name,interval_seconds")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (!source) throw new Error("المصدر غير موجود");

    const secret = process.env["DBSYNC_INGEST_SECRET"];
    if (!secret) throw new Error("مفتاح المزامنة غير مهيأ");

    const platformUrl = process.env["TVCC_PUBLIC_URL"] || "https://tvcc.hnpay.live";
    const { buildEdgeFunction, buildSyncScript, buildHeartbeatScript } = await import("./dbsync-script.server");
    const pgUrl = data.pgUrl || `postgresql://postgres:postgres@${source.host}:5432/postgres`;

    if (data.kind === "edge") {
      return {
        filename: "tvcc-sync-edge.ts",
        content: buildEdgeFunction({ platformUrl, sourceId: source.id, secret, schema: source.schema_name }),
      };
    }

    if (data.kind === "heartbeat") {
      return {
        filename: "tvcc-heartbeat.js",
        content: buildHeartbeatScript({
          platformUrl,
          sourceId: source.id,
          secret,
          schema: source.schema_name,
          intervalSeconds: source.interval_seconds ?? 60,
          pgUrl,
        }),
      };
    }

    return {
      filename: "tvcc-dbsync.js",
      content: buildSyncScript({
        platformUrl,
        sourceId: source.id,
        secret,
        schema: source.schema_name,
        intervalSeconds: source.interval_seconds ?? 60,
        pgUrl,
      }),
    };
  });
