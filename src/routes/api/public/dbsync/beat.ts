import { createFileRoute } from "@tanstack/react-router";
import { checkSyncSecret, json, unauthorized } from "@/lib/dbsync.server";

/** نبضة دورية من قاعدة السيرفر المحلي: تثبت أن المصدر حيّ وتحدّث أعداد الصفوف. */
export const Route = createFileRoute("/api/public/dbsync/beat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkSyncSecret(request)) return unauthorized();

        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "bad_json" }, 400);
        }

        const sourceId = String(body?.sourceId || "").trim();
        if (!sourceId) return json({ ok: false, error: "source required" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;

        const { data: source } = await sb
          .from("db_sync_sources")
          .select("id,is_active,interval_seconds")
          .eq("id", sourceId)
          .maybeSingle();
        if (!source) return json({ ok: false, error: "unknown source" }, 404);

        const now = new Date().toISOString();
        await sb
          .from("db_sync_sources")
          .update({
            last_beacon_at: now,
            status: source.is_active ? "online" : "paused",
            lag_seconds: Number(body?.lagSeconds ?? 0) || 0,
          })
          .eq("id", sourceId);

        // تحديث أعداد الصفوف المحلية فقط — لا حذف ولا تعديل لأي بيانات مرآة.
        const counts = Array.isArray(body?.counts) ? body.counts : [];
        let updated = 0;
        for (const c of counts.slice(0, 500)) {
          const name = String(c?.table || "").trim();
          if (!name) continue;
          const { error } = await sb
            .from("db_sync_tables")
            .update({ local_rows: Number(c?.rows ?? 0) || 0 })
            .eq("source_id", sourceId)
            .eq("table_name", name);
          if (!error) updated += 1;
        }

        return json({
          ok: true,
          active: source.is_active,
          interval_seconds: source.interval_seconds ?? 60,
          tablesUpdated: updated,
        });
      },
    },
  },
});
