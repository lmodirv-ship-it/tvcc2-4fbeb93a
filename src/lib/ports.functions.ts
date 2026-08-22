import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ports hub: port state, manual ports, port↔port bridges, service templates, AI-on-port. */

async function queue(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  opts: { websiteId?: string | null; dryRun?: boolean } = {},
) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      website_id: opts.websiteId ?? null,
      action,
      args,
      dry_run: opts.dryRun ?? false,
      requested_by: ownerId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

/* ------------------------------------------------------------ port list */

export const getPortsHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: ports }, { data: links }, { data: services }, { data: models }] = await Promise.all([
      sb.from("server_ports").select("*").eq("server_id", data.serverId).order("port"),
      sb.from("port_links").select("*").or(`source_server_id.eq.${data.serverId},target_server_id.eq.${data.serverId}`),
      sb.from("site_services").select("*"),
      sb.from("ai_models").select("id, name, model_id, port, server_id, is_active").eq("server_id", data.serverId),
    ]);
    const { SERVICE_TEMPLATES } = await import("./ports.server");
    return {
      ports: ports ?? [],
      links: links ?? [],
      services: (services ?? []).filter((s: any) => (s.metadata as any)?.server_id === data.serverId),
      models: models ?? [],
      templates: SERVICE_TEMPLATES.map((t) => ({ id: t.id, label: t.label, port: t.port, kind: t.kind })),
    };
  });

export const addManualPort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string; port: number; protocol?: string; serviceKind?: string; note?: string; isPublic?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { isSafePort } = await import("./ports.server");
    if (!isSafePort(data.port)) throw new Error("رقم منفذ غير صالح");
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("server_ports")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        port: data.port,
        protocol: data.protocol ?? "tcp",
        address: "0.0.0.0",
        service_kind: data.serviceKind ?? null,
        note: data.note ?? null,
        is_public: data.isPublic ?? false,
        managed: true,
        state: "open",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { portRowId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("server_ports").delete().eq("id", data.portRowId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Open / close a port in the firewall and remember the intended state. */
export const setPortFirewall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string; port: number; protocol?: string; open: boolean; portRowId?: string; dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { isSafePort } = await import("./ports.server");
    if (!isSafePort(data.port)) throw new Error("رقم منفذ غير صالح");
    const sb = context.supabase as any;
    const arg = `${data.port}/${data.protocol ?? "tcp"}`;
    const id = await queue(sb, context.userId, data.serverId, data.open ? "firewall_allow" : "firewall_deny", { port: arg }, { dryRun: data.dryRun });
    if (data.portRowId && !data.dryRun) {
      await sb.from("server_ports").update({ state: data.open ? "open" : "blocked", is_public: data.open }).eq("id", data.portRowId);
    }
    return { ok: true, commandId: id };
  });

/** Ask the agent to test whether a port answers (locally, and from a peer server). */
export const checkPort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; port: number; host?: string }) => input)
  .handler(async ({ data, context }) => {
    const { isSafePort, isSafeHost } = await import("./ports.server");
    if (!isSafePort(data.port)) throw new Error("رقم منفذ غير صالح");
    const host = data.host ?? "127.0.0.1";
    if (!isSafeHost(host)) throw new Error("عنوان غير صالح");
    const id = await queue(context.supabase as any, context.userId, data.serverId, "port_check", { host, port: data.port });
    return { ok: true, commandId: id };
  });

export const restartPortService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; name: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!/^[a-zA-Z0-9@._-]{1,64}$/.test(data.name)) throw new Error("اسم خدمة غير صالح");
    const id = await queue(context.supabase as any, context.userId, data.serverId, "service_restart", { name: data.name }, { dryRun: data.dryRun });
    return { ok: true, commandId: id };
  });

/* ------------------------------------------------------- port ↔ port link */

export const savePortLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string; name?: string; sourceServerId: string; sourcePort: number;
    targetServerId?: string | null; targetHost?: string | null; targetPort: number; bridgeKind?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { isSafePort, isSafeHost } = await import("./ports.server");
    if (!isSafePort(data.sourcePort) || !isSafePort(data.targetPort)) throw new Error("رقم منفذ غير صالح");
    const sb = context.supabase as any;

    let host = data.targetHost ?? null;
    if (!host && data.targetServerId) {
      const { data: srv } = await sb.from("servers").select("public_ip, private_ip, hostname").eq("id", data.targetServerId).maybeSingle();
      host = srv?.public_ip || srv?.private_ip || srv?.hostname || null;
    }
    if (!host || !isSafeHost(host)) throw new Error("عنوان الوجهة غير صالح");

    const payload = {
      owner_id: context.userId,
      name: data.name ?? `:${data.sourcePort} → ${host}:${data.targetPort}`,
      source_server_id: data.sourceServerId,
      source_port: data.sourcePort,
      target_server_id: data.targetServerId ?? null,
      target_host: host,
      target_port: data.targetPort,
      bridge_kind: data.bridgeKind ?? "tcp_forward",
      status: "pending",
    };
    const q = data.id
      ? sb.from("port_links").update(payload).eq("id", data.id).select("*").maybeSingle()
      : sb.from("port_links").insert(payload).select("*").maybeSingle();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePortLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("port_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Materialise the bridge on the source server (socat unit or nginx proxy). */
export const applyPortLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: link } = await sb.from("port_links").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("الرابط غير موجود");

    await queue(sb, context.userId, link.source_server_id, "port_forward", {
      name: `tvcc-bridge-${link.source_port}`,
      local_port: link.source_port,
      target_host: link.target_host,
      target_port: link.target_port,
      kind: link.bridge_kind,
    }, { dryRun: data.dryRun });

    if (!data.dryRun) await sb.from("port_links").update({ status: "applying" }).eq("id", data.id);
    return { ok: true };
  });

export const checkPortLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: link } = await sb.from("port_links").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("الرابط غير موجود");
    await queue(sb, context.userId, link.source_server_id, "port_check", { host: link.target_host, port: link.target_port });
    await sb.from("port_links").update({ last_checked_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

/* ------------------------------------------------------ service templates */

export const runServiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; templateId: string; websiteId?: string | null; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { SERVICE_TEMPLATES } = await import("./ports.server");
    const tpl = SERVICE_TEMPLATES.find((t) => t.id === data.templateId);
    if (!tpl) throw new Error("قالب غير معروف");
    const sb = context.supabase as any;

    await queue(sb, context.userId, data.serverId, "platform_deploy", { script: tpl.install }, { websiteId: data.websiteId ?? null, dryRun: data.dryRun });
    await queue(sb, context.userId, data.serverId, "firewall_allow", { port: `${tpl.port}/tcp` }, { dryRun: data.dryRun });

    if (!data.dryRun) {
      const { data: existing } = await sb
        .from("server_ports").select("id").eq("server_id", data.serverId).eq("port", tpl.port).maybeSingle();
      if (!existing) {
        await sb.from("server_ports").insert({
          owner_id: context.userId, server_id: data.serverId, port: tpl.port, protocol: "tcp",
          address: "0.0.0.0", service_kind: tpl.kind, managed: true, state: "open", note: tpl.label,
        });
      } else {
        await sb.from("server_ports").update({ service_kind: tpl.kind, managed: true, note: tpl.label }).eq("id", existing.id);
      }
      if (data.websiteId) {
        const { data: srv } = await sb.from("servers").select("hostname, public_ip").eq("id", data.serverId).maybeSingle();
        const host = srv?.public_ip || srv?.hostname || "127.0.0.1";
        await sb.from("site_services").insert({
          owner_id: context.userId, website_id: data.websiteId, service_type: tpl.kind,
          name: `${tpl.label} :${tpl.port}`, endpoint_url: `http://${host}:${tpl.port}`,
          status: "active", is_public: false, metadata: { server_id: data.serverId, port: tpl.port, template: tpl.id },
        });
      }
    }
    return { ok: true, port: tpl.port, script: tpl.install };
  });

/** Proxy a sub-path of a domain to a local port (alternative to full-vhost proxy). */
export const createPathProxy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string; port: number; domain: string; path: string; websocket?: boolean;
    websiteId?: string | null; issueSsl?: boolean; dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { buildPathProxyConf } = await import("./ports.server");
    const { proxyConfPath, isSafeDomain } = await import("./mesh.server");
    if (!isSafeDomain(data.domain)) throw new Error("نطاق غير صالح");
    if (!/^\/?[a-zA-Z0-9/_-]{1,64}$/.test(data.path)) throw new Error("مسار غير صالح");
    const sb = context.supabase as any;

    const content = buildPathProxyConf(data.domain, data.port, data.path, data.websocket ?? true);
    const path = proxyConfPath(data.domain);
    await queue(sb, context.userId, data.serverId, "write_config", { path, content }, { websiteId: data.websiteId ?? null, dryRun: data.dryRun });
    await queue(sb, context.userId, data.serverId, "nginx_reload", {}, { websiteId: data.websiteId ?? null, dryRun: data.dryRun });
    if (data.issueSsl) {
      await queue(sb, context.userId, data.serverId, "issue_ssl", { domain: data.domain }, { websiteId: data.websiteId ?? null, dryRun: data.dryRun });
    }
    return { ok: true, path, content };
  });

/* --------------------------------------------------------- AI on a port */

/** Scan known AI ports on a server and register providers + models found there. */
export const discoverAiPorts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { AI_PORT_MAP } = await import("./ports.server");
    const sb = context.supabase as any;
    const { data: ports } = await sb.from("server_ports").select("*").eq("server_id", data.serverId);
    const found = ((ports ?? []) as any[]).filter((p) => AI_PORT_MAP[p.port]);

    const { data: server } = await sb.from("servers").select("name, hostname, public_ip").eq("id", data.serverId).maybeSingle();
    const created: string[] = [];

    for (const p of found) {
      const meta = AI_PORT_MAP[p.port]!;
      const baseUrl = `http://127.0.0.1:${p.port}`;
      const { data: existing } = await sb
        .from("ai_providers").select("id").eq("server_id", data.serverId).eq("base_url", baseUrl).maybeSingle();
      if (existing) continue;
      const { data: row } = await sb.from("ai_providers").insert({
        owner_id: context.userId,
        name: `${meta.label} — ${server?.name ?? "server"}`,
        kind: meta.provider,
        location: "server",
        base_url: baseUrl,
        server_id: data.serverId,
        is_active: true,
      }).select("id").maybeSingle();
      if (row) created.push(`${meta.label}:${p.port}`);
      await sb.from("server_ports").update({ service_kind: "ai", managed: true, note: meta.label }).eq("id", p.id);
    }

    // ask the agent for the live model list on each discovered runtime
    for (const p of found) {
      await queue(sb, context.userId, data.serverId, "ai_models_list", { port: p.port, kind: AI_PORT_MAP[p.port]!.kind });
    }

    return { ok: true, discovered: found.map((p) => p.port), created };
  });

/** Start / stop / pull / remove a local model through the agent. */
export const controlLocalModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string; op: "start" | "stop" | "pull" | "remove" | "ps"; model?: string; port?: number; dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    if (data.model && !/^[a-zA-Z0-9._:/-]{1,80}$/.test(data.model)) throw new Error("اسم نموذج غير صالح");
    const map = {
      start: "ollama_start",
      stop: "ollama_stop",
      pull: "ollama_pull",
      remove: "ollama_rm",
      ps: "ollama_ps",
    } as const;
    const id = await queue(context.supabase as any, context.userId, data.serverId, map[data.op], {
      model: data.model ?? "",
      port: data.port ?? 11434,
    }, { dryRun: data.dryRun });
    return { ok: true, commandId: id };
  });

/** Bind an AI model row to the port that serves it. */
export const bindModelToPort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { modelId: string; portRowId: string | null; port: number | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("ai_models")
      .update({ server_port_id: data.portRowId, port: data.port })
      .eq("id", data.modelId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Expose a model runtime on a domain (ai.<domain>) via the port proxy. */
export const publishModelOnDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; port: number; domain: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { buildProxyConf, proxyConfPath, isSafeDomain } = await import("./mesh.server");
    const host = `ai.${data.domain}`;
    if (!isSafeDomain(host)) throw new Error("نطاق غير صالح");
    const sb = context.supabase as any;
    const content = buildProxyConf(host, data.port);
    const path = proxyConfPath(host);
    await queue(sb, context.userId, data.serverId, "write_config", { path, content }, { dryRun: data.dryRun });
    await queue(sb, context.userId, data.serverId, "nginx_reload", {}, { dryRun: data.dryRun });
    await queue(sb, context.userId, data.serverId, "issue_ssl", { domain: host }, { dryRun: data.dryRun });
    return { ok: true, host, content };
  });
