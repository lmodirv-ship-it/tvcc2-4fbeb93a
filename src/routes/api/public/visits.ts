import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/visits")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("site_visits")
          .select("counter")
          .order("updated_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        return Response.json({ counter: Number(data?.counter ?? 10000) });
      },
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("bump_site_visits");
        if (error) return Response.json({ counter: 10000 });
        return Response.json({ counter: Number(data ?? 10000) });
      },
    },
  },
});
