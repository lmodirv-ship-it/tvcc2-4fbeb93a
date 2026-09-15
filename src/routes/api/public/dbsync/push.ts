import { createFileRoute } from "@tanstack/react-router";
import {
  checkSyncSecret,
  json,
  mirrorRowCount,
  mirrorTableName,
  safeIdent,
  unauthorized,
  upsertRows,
} from "@/lib/dbsync.server";

export const Route = createFileRoute("/api/public/dbsync/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkSyncSecret(request)) return unauthorized();

        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "invalid json" }, 400);
        }

        const sourceId = String(body?.sourceId ?? "");
        const tableRaw = String(body?.table ?? "");
        const rows: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows.slice(0, 5000) : [];
        const cursor = body?.cursor == null ? null : String(body.cursor);
        const localRows = body?.localRows == null ? null : Number(body.localRows);
        if (!sourceId || !tableRaw) return json({ ok: false, error: "sourceId and table required" }, 400);

        const started = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: source } = await (supabaseAdmin as any)
          .from("db_sync_sources")
          .select("id,owner_id,label")
          .eq("id", sourceId)
          .maybeSingle();
        if (!source) return json({ ok: false, error: "unknown source" }, 404);

        let table: string;
        try {
          table = safeIdent(tableRaw);
        } catch {
          return json({ ok: false, error: "invalid table" }, 400);
        }

        const { data: meta } = await (supabaseAdmin as any)
          .from("db_sync_tables")
          .select("id,primary_key,columns")
          .eq("source_id", sourceId)
          .eq("table_name", table)
          .maybeSingle();
        if (!meta) return json({ ok: false, error: "table not registered" }, 409);

        const mirror = mirrorTableName(source.label, table);
        const declared: string[] = (meta.columns ?? []).map((c: any) => String(c.name));

        let applied = 0;
        let error: string | null = null;
        try {
          const columns = declared.length
            ? declared.filter((c) => rows.some((r) => c in r))
            : Object.keys(rows[0] ?? {});
          if (rows.length && columns.length) {
            applied = await upsertRows(mirror, columns, meta.primary_key ?? [], rows, source.label);
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "sync error";
        }

        const duration = Date.now() - started;
        const mirrorRows = await mirrorRowCount(mirror);

        await (supabaseAdmin as any)
          .from("db_sync_tables")
          .update({
            last_cursor: error ? undefined : (cursor ?? undefined),
            last_sync_at: new Date().toISOString(),
            last_status: error ? "failed" : "synced",
            last_error: error,
            mirror_rows: mirrorRows,
            ...(localRows != null && Number.isFinite(localRows) ? { local_rows: localRows } : {}),
          })
          .eq("id", meta.id);

        await (supabaseAdmin as any).from("db_sync_batches").insert({
          owner_id: source.owner_id,
          source_id: sourceId,
          table_name: table,
          rows_sent: rows.length,
          rows_applied: applied,
          duration_ms: duration,
          status: error ? "failed" : "success",
          error,
        });

        await (supabaseAdmin as any)
          .from("db_sync_sources")
          .update({ last_beacon_at: new Date().toISOString(), status: "online" })
          .eq("id", sourceId);

        if (error) return json({ ok: false, error, mirrorRows }, 500);
        return json({ ok: true, applied, mirrorRows, durationMs: duration });
      },
    },
  },
});
