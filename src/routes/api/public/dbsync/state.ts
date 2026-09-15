import { createFileRoute } from "@tanstack/react-router";
import { checkSyncSecret, json, unauthorized } from "@/lib/dbsync.server";

export const Route = createFileRoute("/api/public/dbsync/state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!checkSyncSecret(request)) return unauthorized();
        const url = new URL(request.url);
        const sourceId = url.searchParams.get("source");
        if (!sourceId) return json({ ok: false, error: "source required" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: source } = await (supabaseAdmin as any)
          .from("db_sync_sources")
          .select("id,label,schema_name,interval_seconds,is_active")
          .eq("id", sourceId)
          .maybeSingle();
        if (!source) return json({ ok: false, error: "unknown source" }, 404);

        const { data: tables } = await (supabaseAdmin as any)
          .from("db_sync_tables")
          .select("table_name,primary_key,strategy,cursor_column,last_cursor,is_enabled")
          .eq("source_id", sourceId);

        await (supabaseAdmin as any)
          .from("db_sync_sources")
          .update({ last_beacon_at: new Date().toISOString(), status: source.is_active ? "online" : "paused" })
          .eq("id", sourceId);

        return json({
          ok: true,
          source: {
            id: source.id,
            label: source.label,
            schema: source.schema_name,
            interval_seconds: source.interval_seconds,
            active: source.is_active,
          },
          tables: (tables ?? []).filter((t: any) => t.is_enabled),
        });
      },
    },
  },
});
