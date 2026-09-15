import { createFileRoute } from "@tanstack/react-router";
import {
  checkSyncSecret,
  ensureMirrorTable,
  json,
  mirrorTableName,
  safeIdent,
  unauthorized,
} from "@/lib/dbsync.server";

type IncomingTable = {
  name: string;
  columns: { name: string; type: string }[];
  primaryKey?: string[];
  strategy?: string;
  cursorColumn?: string | null;
  localRows?: number;
};

export const Route = createFileRoute("/api/public/dbsync/schema")({
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
        const tables: IncomingTable[] = Array.isArray(body?.tables) ? body.tables.slice(0, 500) : [];
        if (!sourceId || !tables.length) return json({ ok: false, error: "sourceId and tables required" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: source } = await (supabaseAdmin as any)
          .from("db_sync_sources")
          .select("id,owner_id,label,is_active")
          .eq("id", sourceId)
          .maybeSingle();
        if (!source) return json({ ok: false, error: "unknown source" }, 404);

        const registered: string[] = [];
        const skipped: { table: string; error: string }[] = [];

        for (const t of tables) {
          try {
            const tableName = safeIdent(t.name);
            const columns = (t.columns ?? []).filter((c) => c?.name).slice(0, 200);
            if (!columns.length) throw new Error("no columns");
            const primaryKey = (t.primaryKey ?? []).map((p) => safeIdent(p));
            const mirror = mirrorTableName(source.label, tableName);

            await ensureMirrorTable(mirror, columns, primaryKey);

            await (supabaseAdmin as any)
              .from("db_sync_tables")
              .upsert(
                {
                  owner_id: source.owner_id,
                  source_id: sourceId,
                  table_name: tableName,
                  primary_key: primaryKey,
                  columns: columns,
                  strategy: t.strategy === "checksum" ? "checksum" : "cursor",
                  cursor_column: t.cursorColumn ?? null,
                  local_rows: Number(t.localRows ?? 0),
                  last_status: "registered",
                  last_error: null,
                },
                { onConflict: "source_id,table_name", ignoreDuplicates: false },
              );
            registered.push(tableName);
          } catch (e) {
            skipped.push({ table: String(t?.name ?? "?"), error: e instanceof Error ? e.message : "error" });
          }
        }

        await (supabaseAdmin as any)
          .from("db_sync_sources")
          .update({ last_beacon_at: new Date().toISOString(), status: "online" })
          .eq("id", sourceId);

        return json({ ok: true, registered: registered.length, skipped });
      },
    },
  },
});
