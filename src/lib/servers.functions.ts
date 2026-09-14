import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveAgentToken, hashToken } from "./agent-token";
import { buildAgentScript } from "./agent-script";

const STALE_MS = 3 * 60 * 1000;

export const listServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: servers, error } = await sb
      .from("servers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = (servers ?? []) as Array<Record<string, any>>;
    const ids = list.map((s) => s.id);

    let latest: Record<string, any> = {};
    if (ids.length) {
      const { data: metrics } = await sb
        .from("server_metrics")
        .select("*")
        .in("server_id", ids)
        .order("collected_at", { ascending: false })
        .limit(ids.length * 5);
      for (const m of (metrics ?? []) as Array<Record<string, any>>) {
        if (!latest[m.server_id]) latest[m.server_id] = m;
      }
    }

    const { data: sites } = await sb.from("websites").select("id, server_id");
    const counts: Record<string, number> = {};
    for (const w of (sites ?? []) as Array<Record<string, any>>) {
      if (w.server_id) counts[w.server_id] = (counts[w.server_id] ?? 0) + 1;
    }

    const now = Date.now();
    return list.map((s) => {
      const stale = !s.last_seen_at || now - new Date(s.last_seen_at).getTime() > STALE_MS;
      return {
        ...s,
        status: stale && s.status !== "pending" ? "offline" : s.status,
        metrics: latest[s.id] ?? null,
        website_count: counts[s.id] ?? 0,
      };
    });
  });

export const getServerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: server, error } = await sb
      .from("servers")
      .select("*")
      .eq("id", data.serverId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!server) throw new Error("السيرفر غير موجود");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: metrics }, { data: sites }, { data: websites }] = await Promise.all([
      sb
        .from("server_metrics")
        .select("*")
        .eq("server_id", data.serverId)
        .gte("collected_at", since)
        .order("collected_at", { ascending: true })
        .limit(1500),
      sb.from("server_sites").select("*").eq("server_id", data.serverId).order("name"),
      sb.from("websites").select("id, name, domain, status, is_active").eq("server_id", data.serverId),
    ]);

    return {
      server,
      metrics: metrics ?? [],
      agentSites: sites ?? [],
      websites: websites ?? [],
    };
  });

export const createServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string; hostname: string; description?: string; provider?: string;
    region?: string; vcpu?: number; ram_mb?: number; disk_gb?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("servers")
      .insert({
        owner_id: context.userId,
        name: data.name,
        hostname: data.hostname,
        description: data.description ?? null,
        provider: data.provider ?? null,
        region: data.region ?? null,
        vcpu: data.vcpu ?? null,
        ram_mb: data.ram_mb ?? null,
        disk_gb: data.disk_gb ?? null,
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const secret = process.env["SERVERS_INGEST_SECRET"];
    if (secret && row) {
      const token = deriveAgentToken(secret, row.id);
      await sb.from("servers").update({ agent_token_hash: hashToken(token) }).eq("id", row.id);
    }
    return row;
  });

export const updateServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; patch: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const allowed = ["name", "hostname", "description", "provider", "region", "vcpu", "ram_mb", "disk_gb"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in data.patch) patch[k] = data.patch[k];
    const { error } = await (context.supabase as any)
      .from("servers")
      .update(patch)
      .eq("id", data.serverId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("servers").delete().eq("id", data.serverId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignWebsiteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; serverId: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("websites")
      .update({ server_id: data.serverId })
      .eq("id", data.websiteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Returns the agent token + a ready-to-paste install command. Shown to the owner only. */
export const getAgentInstall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; origin: string; agentKey?: string; agentRole?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: server } = await sb.from("servers").select("id").eq("id", data.serverId).maybeSingle();
    if (!server) throw new Error("السيرفر غير موجود");

    const secret = process.env["SERVERS_INGEST_SECRET"];
    if (!secret) throw new Error("SERVERS_INGEST_SECRET غير مُهيّأ");

    const ROLES = ["main", "db", "web", "backup", "monitor", "healer", "security"];
    const agentKey = /^[a-z0-9_-]{1,24}$/.test(data.agentKey ?? "") ? data.agentKey! : "main";
    const agentRole = ROLES.includes(data.agentRole ?? "") ? data.agentRole! : agentKey === "main" ? "main" : "monitor";

    const token = deriveAgentToken(secret, data.serverId);
    const origin = /^https?:\/\/[^\s/]+$/.test(data.origin) ? data.origin : "https://tvcc.hnpay.live";
    const endpoint = `${origin}/api/public/servers/heartbeat`;

    const script = buildAgentScript(data.serverId, token, endpoint);

    const install = [
      `curl -fsSL -o /usr/local/bin/tvcc-agent.sh '${origin}/api/public/servers/agent?id=${data.serverId}&token=${token}'`,
      `chmod +x /usr/local/bin/tvcc-agent.sh`,
      `TVCC_AGENT_KEY=${agentKey} TVCC_AGENT_ROLE=${agentRole} /usr/local/bin/tvcc-agent.sh install`,
    ].join(" && ");

    return { token, endpoint, script, install, agentKey, agentRole };
  });
