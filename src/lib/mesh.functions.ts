import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mesh: server links, site clusters, port publishing, one-click service connect, site provisioning. */

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

/* ------------------------------------------------------------------ mesh */

export const getMesh = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: servers }, { data: links }, { data: clusters }, { data: members }] = await Promise.all([
      sb.from("servers").select("id, name, hostname, public_ip, private_ip, network_kind, status, is_tvcc_node, tvcc_version, last_seen_at").order("name"),
      sb.from("server_links").select("*").order("created_at", { ascending: false }),
      sb.from("site_clusters").select("*").order("name"),
      sb.from("site_cluster_members").select("*"),
    ]);

    const byId: Record<string, any> = {};
    for (const s of (servers ?? []) as any[]) byId[s.id] = s;

    return {
      servers: servers ?? [],
      links: ((links ?? []) as any[]).map((l) => ({
        ...l,
        source_name: byId[l.source_server_id]?.name ?? "—",
        target_name: byId[l.target_server_id]?.name ?? "—",
        target_host: byId[l.target_server_id]?.hostname ?? null,
      })),
      clusters: ((clusters ?? []) as any[]).map((c) => ({
        ...c,
        members: ((members ?? []) as any[])
          .filter((m) => m.cluster_id === c.id)
          .map((m) => ({ ...m, server_name: byId[m.server_id]?.name ?? "—" })),
      })),
      stats: {
        total: (servers ?? []).length,
        local: ((servers ?? []) as any[]).filter((s) => s.network_kind === "local").length,
        cloud: ((servers ?? []) as any[]).filter((s) => s.network_kind !== "local").length,
        tvccNodes: ((servers ?? []) as any[]).filter((s) => s.is_tvcc_node).length,
        activeLinks: ((links ?? []) as any[]).filter((l) => l.status === "online").length,
        clusters: (clusters ?? []).length,
      },
    };
  });

export const setServerNetwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; networkKind: string; privateIp?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const kind = data.networkKind === "local" ? "local" : "cloud";
    const { error } = await (context.supabase as any)
      .from("servers")
      .update({ network_kind: kind, private_ip: data.privateIp || null })
      .eq("id", data.serverId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveServerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    sourceServerId: string; targetServerId: string; linkType?: string; channel?: string; targetPort?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    if (data.sourceServerId === data.targetServerId) throw new Error("لا يمكن ربط السيرفر بنفسه");
    const { data: row, error } = await (context.supabase as any)
      .from("server_links")
      .upsert(
        {
          owner_id: context.userId,
          source_server_id: data.sourceServerId,
          target_server_id: data.targetServerId,
          link_type: data.linkType ?? "sync",
          channel: data.channel ?? "public",
          target_port: data.targetPort ?? 22,
          status: "unknown",
        },
        { onConflict: "source_server_id,target_server_id,link_type" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteServerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("server_links").delete().eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ask the source server's agent to probe the target host/port. */
export const checkServerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: link } = await sb.from("server_links").select("*").eq("id", data.linkId).maybeSingle();
    if (!link) throw new Error("الرابط غير موجود");
    const { data: target } = await sb
      .from("servers")
      .select("hostname, public_ip, private_ip")
      .eq("id", link.target_server_id)
      .maybeSingle();
    const host =
      link.channel === "local"
        ? target?.private_ip || target?.hostname
        : target?.public_ip || target?.hostname;
    if (!host) throw new Error("لا يوجد عنوان للسيرفر الهدف");

    const cmdId = await queue(sb, context.userId, link.source_server_id, "link_check", {
      host,
      port: link.target_port ?? 22,
      link_id: link.id,
    });
    await sb.from("server_links").update({ status: "checking", last_checked_at: new Date().toISOString() }).eq("id", link.id);
    return { ok: true, commandId: cmdId };
  });

/* -------------------------------------------------------------- clusters */

export const setClusterPrimary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clusterId: string; serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.from("site_cluster_members").update({ role: "replica" }).eq("cluster_id", data.clusterId);
    await sb
      .from("site_cluster_members")
      .update({ role: "primary" })
      .eq("cluster_id", data.clusterId)
      .eq("server_id", data.serverId);
    const { error } = await sb
      .from("site_clusters")
      .update({ primary_server_id: data.serverId })
      .eq("id", data.clusterId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Push files from the cluster's primary server to every replica. */
export const syncCluster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clusterId: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: cluster } = await sb.from("site_clusters").select("*").eq("id", data.clusterId).maybeSingle();
    if (!cluster) throw new Error("العنقود غير موجود");
    const { data: members } = await sb.from("site_cluster_members").select("*").eq("cluster_id", data.clusterId);
    const list = (members ?? []) as any[];
    const primary = cluster.primary_server_id ?? list.find((m) => m.role === "primary")?.server_id;
    if (!primary) throw new Error("حدّد السيرفر الأساسي أولاً");

    const replicas = list.filter((m) => m.server_id !== primary);
    if (!replicas.length) throw new Error("لا توجد نسخ أخرى للمزامنة");

    const { data: servers } = await sb.from("servers").select("id, hostname, public_ip, private_ip").in("id", replicas.map((r) => r.server_id));
    const hostById: Record<string, string> = {};
    for (const s of (servers ?? []) as any[]) hostById[s.id] = s.public_ip || s.hostname;

    let queued = 0;
    for (const r of replicas) {
      const host = hostById[r.server_id];
      if (!host) continue;
      await queue(sb, context.userId, primary, "sync_site", {
        domain: r.domain || cluster.key,
        target_host: host,
        cluster_id: cluster.id,
      }, { dryRun: data.dryRun });
      queued++;
    }
    return { ok: true, queued };
  });

/* ------------------------------------------------------- ports & services */

/** Publish an open port as a service belonging to one of the user's websites. */
export const publishPortAsService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string; port: number; websiteId: string; serviceType?: string; name?: string; isPublic?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: site } = await sb.from("websites").select("id, domain, name").eq("id", data.websiteId).maybeSingle();
    if (!site) throw new Error("الموقع غير موجود");
    const { data: server } = await sb.from("servers").select("hostname, public_ip").eq("id", data.serverId).maybeSingle();
    const host = server?.public_ip || server?.hostname || "127.0.0.1";

    const { data: row, error } = await sb
      .from("site_services")
      .insert({
        owner_id: context.userId,
        website_id: data.websiteId,
        service_type: data.serviceType ?? "api",
        name: data.name || `${site.name} :${data.port}`,
        description: `منفذ ${data.port} على السيرفر`,
        endpoint_url: `http://${host}:${data.port}`,
        status: "active",
        is_public: data.isPublic ?? false,
        metadata: { server_id: data.serverId, port: data.port },
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/** Generate + apply an Nginx reverse proxy for a domain pointing at a local port. */
export const createProxyForPort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; port: number; domain: string; websiteId?: string | null; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { buildProxyConf, proxyConfPath, isSafeDomain } = await import("./mesh.server");
    if (!isSafeDomain(data.domain)) throw new Error("نطاق غير صالح");
    const sb = context.supabase as any;
    const content = buildProxyConf(data.domain, data.port);
    const path = proxyConfPath(data.domain);

    await queue(sb, context.userId, data.serverId, "write_config", { path, content }, {
      websiteId: data.websiteId ?? null,
      dryRun: data.dryRun,
    });
    await queue(sb, context.userId, data.serverId, "nginx_reload", {}, {
      websiteId: data.websiteId ?? null,
      dryRun: data.dryRun,
    });
    return { ok: true, path, content };
  });

/* ------------------------------------------------ one-click site connect */

/** Every service the user can connect to, plus existing connections. */
export const listConnectables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: services }, { data: deps }, { data: websites }] = await Promise.all([
      sb.from("site_services").select("*").order("name"),
      sb.from("service_dependencies").select("*"),
      sb.from("websites").select("id, name, domain").order("name").limit(500),
    ]);
    return { services: services ?? [], dependencies: deps ?? [], websites: websites ?? [] };
  });

/**
 * Connect one website to another website's service with a single click.
 * The platform writes the relation and injects the connection values into the
 * consumer's environment variables — the user never handles keys by hand.
 */
export const connectService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { consumerWebsiteId: string; serviceId: string; environment?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: service } = await sb.from("site_services").select("*").eq("id", data.serviceId).maybeSingle();
    if (!service) throw new Error("الخدمة غير موجودة");
    if (service.website_id === data.consumerWebsiteId) throw new Error("لا يمكن ربط الموقع بخدمته نفسها");

    const { data: dep, error } = await sb
      .from("service_dependencies")
      .upsert(
        {
          owner_id: context.userId,
          consumer_website_id: data.consumerWebsiteId,
          provider_website_id: service.website_id,
          service_id: service.id,
          status: "connected",
        },
        { onConflict: "consumer_website_id,service_id" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Inject connection values (never the raw secret) into the consumer's env vars.
    const env = data.environment ?? "production";
    const prefix = `TVCC_${String(service.service_type || "SERVICE").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const rows = [
      { key: `${prefix}_URL`, value: service.endpoint_url ?? "", is_secret: false },
      { key: `${prefix}_ID`, value: service.id, is_secret: false },
    ];

    // If the provider stored a vault secret for this service, reference it by name only.
    const secretName = (service.metadata as Record<string, unknown> | null)?.["vault_secret_name"];
    if (typeof secretName === "string" && secretName) {
      rows.push({ key: `${prefix}_SECRET_REF`, value: secretName, is_secret: true });
    }

    for (const r of rows) {
      if (!r.value) continue;
      await sb.from("website_env_vars").upsert(
        {
          owner_id: context.userId,
          website_id: data.consumerWebsiteId,
          environment: env,
          key: r.key,
          value: r.value,
          is_secret: r.is_secret,
          description: `ربط تلقائي بخدمة ${service.name}`,
        },
        { onConflict: "website_id,environment,key" },
      );
    }

    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "website",
      website_id: data.consumerWebsiteId,
      operation: "connect_service",
      title: `ربط بخدمة ${service.name}`,
      input: { service_id: service.id },
      result: { injected: rows.map((r) => r.key) },
      status: "success",
      actor: "user",
    });

    return { ok: true, dependency: dep, injected: rows.map((r) => r.key) };
  });

export const disconnectService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dependencyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("service_dependencies")
      .delete()
      .eq("id", data.dependencyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------ site provisioning */

export const listSiteProvisioning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId?: string; serverId?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb.from("site_provisioning").select("*").order("created_at", { ascending: true });
    if (data.websiteId) q = q.eq("website_id", data.websiteId);
    if (data.serverId) q = q.eq("server_id", data.serverId);
    const { data: rows } = await q;
    return rows ?? [];
  });

async function setStep(
  sb: any,
  ownerId: string,
  websiteId: string,
  serverId: string | null,
  step: string,
  status: string,
  detail?: string | null,
  commandId?: string | null,
) {
  await sb.from("site_provisioning").upsert(
    {
      owner_id: ownerId,
      website_id: websiteId,
      server_id: serverId,
      step,
      status,
      detail: detail ?? null,
      command_id: commandId ?? null,
    },
    { onConflict: "website_id,step" },
  );
}

/**
 * Full auto-provisioning for a website on a server: DNS check, site folder,
 * storage, Nginx vhost, SSL, then registering the site as a connectable service.
 */
export const provisionSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; serverId: string; port?: number; only?: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { buildProxyConf, proxyConfPath, siteRoot, isSafeDomain } = await import("./mesh.server");

    const { data: site } = await sb.from("websites").select("*").eq("id", data.websiteId).maybeSingle();
    if (!site) throw new Error("الموقع غير موجود");
    const domain = String(site.domain || "");
    if (!isSafeDomain(domain)) throw new Error("نطاق الموقع غير صالح");

    const only = data.only;
    const run = (s: string) => !only || only === s;
    const port = data.port ?? 3000;

    // 1) DNS verification
    if (run("dns_verify")) {
      let verified = false;
      let detail = "";
      try {
        const { checkDomainOwnership } = await import("./hn-rls.server");
        const res: any = await checkDomainOwnership(domain);
        verified = Boolean(res?.verified);
        detail = verified ? `تم التحقق (${res?.method ?? "dns"})` : "لم يتم العثور على سجلات التحقق";
      } catch (e) {
        detail = (e as Error).message;
      }
      if (!verified) {
        // Fallback: does the domain resolve at all?
        try {
          const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
          const j: any = await r.json();
          if (Array.isArray(j?.Answer) && j.Answer.length) {
            verified = true;
            detail = `النطاق يشير إلى ${j.Answer[0]?.data}`;
          }
        } catch { /* offline */ }
      }
      await setStep(sb, context.userId, site.id, data.serverId, "dns_verify", verified ? "done" : "failed", detail);
      if (!verified && !only) {
        return { ok: false, stopped: "dns_verify", detail };
      }
    }

    // Bind the site to the server
    await sb.from("websites").update({ server_id: data.serverId }).eq("id", site.id);

    // 2) Site directory
    if (run("site_dir")) {
      const cmdId = await queue(sb, context.userId, data.serverId, "site_dir", { domain }, {
        websiteId: site.id, dryRun: data.dryRun,
      });
      await setStep(sb, context.userId, site.id, data.serverId, "site_dir", "running", siteRoot(domain), cmdId);
    }

    // 3) Storage record
    if (run("storage")) {
      const { data: existing } = await sb
        .from("storages")
        .select("id")
        .eq("website_id", site.id)
        .eq("server_id", data.serverId)
        .maybeSingle();
      if (!existing) {
        await sb.from("storages").insert({
          owner_id: context.userId,
          website_id: site.id,
          server_id: data.serverId,
          name: `${domain} storage`,
          storage_type: "local",
          path: siteRoot(domain),
          bucket: "site-assets",
          status: "active",
          auto_provisioned: true,
        });
      }
      await setStep(sb, context.userId, site.id, data.serverId, "storage", "done", siteRoot(domain));
    }

    // 4) Nginx vhost
    if (run("nginx")) {
      const cmdId = await queue(sb, context.userId, data.serverId, "write_config", {
        path: proxyConfPath(domain),
        content: buildProxyConf(domain, port),
      }, { websiteId: site.id, dryRun: data.dryRun });
      await queue(sb, context.userId, data.serverId, "nginx_reload", {}, { websiteId: site.id, dryRun: data.dryRun });
      await setStep(sb, context.userId, site.id, data.serverId, "nginx", "running", proxyConfPath(domain), cmdId);
    }

    // 5) SSL
    if (run("ssl")) {
      const cmdId = await queue(sb, context.userId, data.serverId, "issue_ssl", { domain }, {
        websiteId: site.id, dryRun: data.dryRun,
      });
      await setStep(sb, context.userId, site.id, data.serverId, "ssl", "running", `certbot ${domain}`, cmdId);
    }

    // 6) Register as a connectable service
    if (run("register_service")) {
      const { data: existing } = await sb
        .from("site_services")
        .select("id")
        .eq("website_id", site.id)
        .eq("service_type", "site")
        .maybeSingle();
      if (!existing) {
        await sb.from("site_services").insert({
          owner_id: context.userId,
          website_id: site.id,
          service_type: "site",
          name: site.name || domain,
          description: "موقع مُجهَّز تلقائياً عبر TVCC",
          endpoint_url: `https://${domain}`,
          status: "active",
          is_public: true,
          metadata: { server_id: data.serverId, port },
        });
      }
      await setStep(sb, context.userId, site.id, data.serverId, "register_service", "done", `https://${domain}`);
    }

    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "website",
      server_id: data.serverId,
      website_id: site.id,
      operation: "provision_site",
      title: `تجهيز ${domain} على السيرفر`,
      input: { port, only: only ?? "all", dry_run: Boolean(data.dryRun) },
      result: {},
      status: "pending",
      actor: "user",
    });

    return { ok: true };
  });

/** Storage rows + measured usage for one server. */
export const getServerStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows } = await sb
      .from("storages")
      .select("*, websites(name, domain)")
      .eq("server_id", data.serverId)
      .order("name");
    return rows ?? [];
  });

export const measureStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    await queue(context.supabase as any, context.userId, data.serverId, "storage_usage", {});
    return { ok: true };
  });
