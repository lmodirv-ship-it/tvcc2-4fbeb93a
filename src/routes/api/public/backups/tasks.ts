import { createFileRoute } from "@tanstack/react-router";

/** مهام النسخ المعلّقة لسكريبت سيرفر التخزين. POST + x-tvcc-secret */
export const Route = createFileRoute("/api/public/backups/tasks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-tvcc-secret") ?? "";
        const envSecret = process.env["NIGHTLY_BACKUP_SECRET"] ?? "";
        if (!provided || !envSecret || provided !== envSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          destination_id?: string;
          limit?: number;
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: dest } = await admin
          .from("backup_destinations")
          .select("id, owner_id, base_path, scope")
          .eq("id", body.destination_id ?? "")
          .maybeSingle();
        if (!dest) return new Response("Destination not found", { status: 404 });

        const limit = Math.min(Math.max(Number(body.limit ?? 25), 1), 200);

        const { data: rows } = await admin
          .from("site_backup_copies")
          .select("id, website_id, domain, copy_kind, remote_path, status")
          .eq("destination_id", dest.id)
          .in("status", ["pending", "running"])
          .order("copy_kind")
          .limit(limit);

        // إن لم توجد مهام معلّقة، جهّز مهام «حالية» لكل المواقع
        let tasks = ((rows as any[]) ?? []).filter((r) => r.domain);
        if (tasks.length === 0) {
          let q = admin
            .from("websites")
            .select("id, domain")
            .eq("owner_id", dest.owner_id)
            .order("domain")
            .limit(limit);
          if (dest.scope === "verified") q = q.eq("verified", true);
          const { data: sites } = await q;
          const base = String(dest.base_path ?? "/var/www/tvcc").replace(/\/+$/, "");
          const made: any[] = [];
          for (const s of ((sites as any[]) ?? []).filter((s) => s.domain)) {
            const row = {
              owner_id: dest.owner_id,
              destination_id: dest.id,
              website_id: s.id,
              domain: s.domain,
              copy_kind: "current",
              remote_path: `${base}/${s.domain}/current`,
              status: "pending",
            };
            const { data: up } = await admin
              .from("site_backup_copies")
              .upsert(row, { onConflict: "destination_id,website_id,copy_kind" })
              .select("id, website_id, domain, copy_kind, remote_path, status")
              .maybeSingle();
            if (up) made.push(up);
          }
          tasks = made;
        }

        return Response.json({ ok: true, base_path: dest.base_path, count: tasks.length, tasks });
      },
    },
  },
});
