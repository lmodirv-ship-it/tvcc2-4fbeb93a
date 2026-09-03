import { createFileRoute } from "@tanstack/react-router";
import { exportCatalogToHubs, resolveGroupToken } from "@/lib/exchange.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

async function run(request: Request) {
  const url = new URL(request.url);
  const header = request.headers.get("authorization") ?? "";
  const token =
    (header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "") ||
    (url.searchParams.get("token") ?? "").trim();

  const ownerId = await resolveGroupToken(token);
  if (!ownerId) return Response.json({ error: "invalid_token" }, { status: 401, headers: CORS });

  const result = await exportCatalogToHubs(ownerId);
  return Response.json({ ok: true, ...result }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

/** تصدير يومي تلقائي للائحة المواقع إلى مراكز المجموعة. */
export const Route = createFileRoute("/api/public/hub/export")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
