import { createFileRoute } from "@tanstack/react-router";

/** نتيجة تنفيذ مهمة نسخ من سكريبت سيرفر التخزين. POST + x-tvcc-secret */
export const Route = createFileRoute("/api/public/backups/report")({
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
          copy_id?: string;
          status?: string;
          size_bytes?: number;
          remote_path?: string;
          error_message?: string;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        if (!body.copy_id) return new Response("copy_id required", { status: 400 });

        const status = body.status === "completed" ? "completed" : body.status === "running" ? "running" : "failed";
        const patch: Record<string, unknown> = {
          status,
          error_message: body.error_message ?? null,
          size_bytes: body.size_bytes ?? null,
        };
        if (status === "completed") patch["completed_at"] = new Date().toISOString();
        if (body.remote_path) patch["remote_path"] = body.remote_path;

        const { error } = await admin.from("site_backup_copies").update(patch).eq("id", body.copy_id);
        if (error) {
          delete patch["size_bytes"];
          delete patch["completed_at"];
          await admin.from("site_backup_copies").update(patch).eq("id", body.copy_id);
        }

        if (body.destination_id) {
          await admin
            .from("backup_destinations")
            .update({ last_run_at: new Date().toISOString(), last_run_status: "running" })
            .eq("id", body.destination_id);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
