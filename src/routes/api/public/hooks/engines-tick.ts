import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/** نبضة دورية: تنفّذ كل جدولات المحركات المستحقّة. */
export const Route = createFileRoute("/api/public/hooks/engines-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env["ENGINES_TICK_SECRET"] ?? process.env["ENGINES_CRON_SECRET"];
        if (!expected) return new Response("Not configured", { status: 500 });
        const url = new URL(request.url);
        const provided =
          request.headers.get("x-tvcc-secret") ?? url.searchParams.get("secret") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runDueSchedules } = await import("@/lib/engines-run.server");
        try {
          const results = await runDueSchedules(supabaseAdmin);
          return Response.json({
            ok: true,
            ran: results.length,
            queued: results.reduce((n, r) => n + r.queued, 0),
            failed: results.filter((r) => !r.ok).length,
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
