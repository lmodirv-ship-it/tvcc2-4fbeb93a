import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { deriveAgentToken } from "@/lib/agent-token";
import { buildAgentScript } from "@/lib/agent-script";

// Serves the install script for one server. The per-server token is the credential:
// GET /api/public/servers/agent?id=<uuid>&token=<agent token>
export const Route = createFileRoute("/api/public/servers/agent")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        const token = url.searchParams.get("token") ?? "";
        const secret = process.env["SERVERS_INGEST_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid id", { status: 400 });

        const expected = deriveAgentToken(secret, id);
        const a = Buffer.from(token);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid token", { status: 401 });
        }

        const endpoint = `${url.origin}/api/public/servers/heartbeat`;
        return new Response(buildAgentScript(id, expected, endpoint), {
          headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
