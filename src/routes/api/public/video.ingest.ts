import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/video/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-tvcc-source",
      } }),
      POST: async ({ request }) => {
        const auth = await verifyIngestSignature(request, "VIDEO_INGEST_SECRET", [
          "x-tvcc-signature",
          "x-video-signature",
        ]);
        if (!auth.ok) return auth.response;
        try {
          const body: any = JSON.parse(auth.raw || "{}");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const requestId: string | undefined = body?.request_id;
          if (!requestId) return Response.json({ ok: false, error: "missing request_id" }, { status: 400 });
          const status = body?.status ?? (body?.video_url ? "ready" : "processing");
          const patch: any = {
            status,
            video_url: body?.video_url ?? null,
            thumbnail_url: body?.thumbnail_url ?? null,
            duration_seconds: body?.duration_seconds ?? null,
            external_id: body?.external_id ?? null,
            error_message: body?.error ?? null,
            payload: body ?? {},
          };
          if (status === "ready" || status === "failed") patch.completed_at = new Date().toISOString();

          const { data: row } = await (supabaseAdmin as any).from("video_requests")
            .update(patch).eq("id", requestId).select().maybeSingle();

          if (row?.owner_id) {
            await (supabaseAdmin as any).from("activity_log").insert({
              owner_id: row.owner_id,
              action: "video.request.ingested",
              entity_type: "video_request",
              entity_id: requestId,
              details: { status, video_url: patch.video_url },
            });
            if (status === "ready") {
              await (supabaseAdmin as any).from("notifications").insert({
                owner_id: row.owner_id,
                type: "video.ready",
                severity: "success",
                title: "فيديو جاهز من استوديو الشرح",
                message: row.target_site ? `تم إنشاء شرح للموقع: ${row.target_site}` : "طلب الفيديو جاهز",
                metadata: { video_url: patch.video_url, request_id: requestId, channel: row.requester_channel ?? "hn-nawat" },
              });
            }
          }

          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "err" }, { status: 500 });
        }
      },
    },
  },
});