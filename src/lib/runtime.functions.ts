import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Runtime control, database links and live storage sync for sites hosted on a server. */

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

async function log(sb: any, ownerId: string, row: Record<string, unknown>) {
  await sb.from("storage_events").insert({ owner_id: ownerId, ...row });
}

/* ---------------------------------------------------------------- read */

export const getRuntimeHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [runtimes, siteDbs, storages, clusters, events, websites, databases] = await Promise.all([
      sb.from("site_runtimes").select("*").eq("server_id", data.serverId).order("domain"),
      sb.from("site_databases").select("*").order("created_at", { ascending: false }),
      sb.from("storages").select("*").eq("server_id", data.serverId),
      sb.from("site_cluster_members").select("*").order("domain"),
      sb.from("storage_events").select("*").eq("server_id", data.serverId).order("created_at", { ascending: false }).limit(30),
      sb.from("websites").select("id, name, domain, server_id, status").order("domain"),
      sb.from("databases").select("id, name, db_type, host, db_user, website_id, status"),
    ]);
    const { RUNTIME_KINDS } = await import("./runtime.server");
    return {
      runtimes: runtimes.data ?? [],
      siteDatabases: siteDbs.data ?? [],
      storages: storages.data ?? [],
      clusterMembers: clusters.data ?? [],
      events: events.data ?? [],
      websites: websites.data ?? [],
      databases: databases.data ?? [],
      runtimeKinds: RUNTIME_KINDS,
    };
  });

/* ------------------------------------------------------------- runtime */

export const saveSiteRuntime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string; serverId: string; websiteId?: string | null; domain: string;
    runtimeKind: string; port?: number | null; execStart?: string | null; dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const rt = await import("./runtime.server");
    if (!rt.isSafeDomain(data.domain)) throw new Error("نطاق غير صالح");
    const sb = context.supabase as any;
    const kind = data.runtimeKind as any;
    const exec = data.execStart?.trim() || rt.defaultExecStart(kind, data.domain, data.port);
    const payload = {
      owner_id: context.userId,
      server_id: data.serverId,
      website_id: data.websiteId ?? null,
      domain: data.domain,
      runtime_kind: kind,
      port: data.port ?? null,
      root_path: rt.siteRoot(data.domain),
      unit_name: rt.unitName(data.domain),
      exec_start: exec,
      status: "pending",
    };
    const { data: row, error } = data.id
      ? await sb.from("site_runtimes").update(payload).eq("id", data.id).select("*").maybeSingle()
      : await sb.from("site_runtimes").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);

    await queue(sb, context.userId, data.serverId, "site_dir", { domain: data.domain }, { websiteId: data.websiteId, dryRun: data.dryRun });
    if (kind !== "static") {
      await queue(sb, context.userId, data.serverId, "unit_write", {
        name: rt.unitName(data.domain),
        path: rt.unitPath(data.domain),
        content: rt.buildUnit(data.domain, exec, data.port),
      }, { websiteId: data.websiteId, dryRun: data.dryRun });
    }
    return { ok: true, runtime: row };
  });

export const controlSiteRuntime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; op: "start" | "stop" | "restart" | "logs" | "status"; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rt, error } = await sb.from("site_runtimes").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!rt) throw new Error("التشغيل غير موجود");
    const action = data.op === "status" ? "service_status" : data.op === "logs" ? "site_logs" : `site_${data.op}`;
    const cmdId = await queue(sb, context.userId, rt.server_id, action, { name: rt.unit_name }, { websiteId: rt.website_id, dryRun: data.dryRun });
    if (!data.dryRun && (data.op === "start" || data.op === "restart")) {
      await sb.from("site_runtimes").update({ status: "starting", last_restart_at: new Date().toISOString() }).eq("id", rt.id);
    }
    if (!data.dryRun && data.op === "stop") {
      await sb.from("site_runtimes").update({ status: "stopping" }).eq("id", rt.id);
    }
    return { ok: true, commandId: cmdId };
  });

export const deleteSiteRuntime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("site_runtimes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------ database */

export const connectSiteDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string; websiteId: string; engine?: string; connectionKind?: string;
    host?: string | null; port?: number | null; dbName?: string | null; dbUser?: string | null;
    password?: string | null; envKey?: string | null; createOnServer?: boolean; dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const rt = await import("./runtime.server");
    const sb = context.supabase as any;

    const { data: site } = await sb.from("websites").select("id, domain").eq("id", data.websiteId).maybeSingle();
    if (!site) throw new Error("الموقع غير موجود");

    const engine = data.engine ?? "postgres";
    const kind = data.connectionKind ?? "local";
    const dbName = (data.dbName || rt.dbNameFor(site.domain)).toLowerCase();
    const dbUser = (data.dbUser || dbName).toLowerCase();
    if (!rt.isSafeIdent(dbName) || !rt.isSafeIdent(dbUser)) throw new Error("اسم قاعدة أو مستخدم غير صالح");
    const host = data.host?.trim() || "127.0.0.1";
    const port = data.port ?? rt.defaultDbPort(engine);
    const password = data.password?.trim() || rt.randomPassword();
    const envKey = data.envKey?.trim() || "DATABASE_URL";

    const dsn = rt.buildDsn({ engine, user: dbUser, password, host, port, dbName });

    // store credentials encrypted in the vault (never shown in the UI)
    const { createCipheriv, randomBytes } = await import("crypto");
    const keyRaw = process.env["HN_RLS_SIGNING_KEY"] ?? process.env["SERVERS_INGEST_SECRET"] ?? "tvcc-fallback-key";
    const { createHash } = await import("crypto");
    const key = createHash("sha256").update(keyRaw).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(dsn, "utf8"), cipher.final()]);
    const packed = `${iv.toString("base64")}:${Buffer.concat([cipher.getAuthTag(), enc]).toString("base64")}`;

    const { data: secret } = await sb
      .from("vault_secrets")
      .insert({
        owner_id: context.userId,
        website_id: data.websiteId,
        server_id: data.serverId,
        name: `${envKey}_${dbName}`,
        category: "database",
        value_encrypted: packed,
        description: `اتصال قاعدة بيانات ${dbName} للموقع ${site.domain}`,
      })
      .select("id")
      .maybeSingle();

    const { data: link, error } = await sb
      .from("site_databases")
      .insert({
        owner_id: context.userId,
        website_id: data.websiteId,
        server_id: data.serverId,
        connection_kind: kind,
        db_engine: engine,
        db_name: dbName,
        db_user: dbUser,
        host,
        port,
        env_key: envKey,
        secret_id: secret?.id ?? null,
        status: data.dryRun ? "dry_run" : "connecting",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // inject the connection into the site env vars (masked in UI, secret flag on)
    if (!data.dryRun) {
      await sb.from("website_env_vars").upsert(
        {
          owner_id: context.userId,
          website_id: data.websiteId,
          environment: "production",
          key: envKey,
          value: dsn,
          is_secret: true,
          description: "حُقن تلقائياً عند ربط قاعدة البيانات",
        },
        { onConflict: "website_id,environment,key" },
      );
    }

    if (data.createOnServer !== false && kind !== "cloud") {
      await queue(sb, context.userId, data.serverId, "db_create", { engine, database: dbName }, { websiteId: data.websiteId, dryRun: data.dryRun });
      await queue(sb, context.userId, data.serverId, "db_user_grant", { engine, database: dbName, user: dbUser, password }, { websiteId: data.websiteId, dryRun: data.dryRun });
    }
    await queue(sb, context.userId, data.serverId, "db_ping", { engine, host, port, database: dbName, user: dbUser, password }, { websiteId: data.websiteId, dryRun: data.dryRun });

    return { ok: true, link };
  });

export const testSiteDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: link } = await sb.from("site_databases").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("الرابط غير موجود");
    if (!link.server_id) throw new Error("لا يوجد سيرفر مرتبط بهذا الاتصال");
    const cmdId = await queue(sb, context.userId, link.server_id, "db_ping", {
      engine: link.db_engine, host: link.host, port: link.port, database: link.db_name, user: link.db_user,
    }, { websiteId: link.website_id });
    await sb.from("site_databases").update({ last_checked_at: new Date().toISOString() }).eq("id", link.id);
    return { ok: true, commandId: cmdId };
  });

export const disconnectSiteDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: link } = await sb.from("site_databases").select("*").eq("id", data.id).maybeSingle();
    if (link) {
      await sb.from("website_env_vars").delete().eq("website_id", link.website_id).eq("key", link.env_key);
      if (link.secret_id) await sb.from("vault_secrets").delete().eq("id", link.secret_id);
      await sb.from("site_databases").delete().eq("id", link.id);
    }
    return { ok: true };
  });

/* -------------------------------------------------- storage & live sync */

/** Write the ownership identity file and create the site storage entry. */
export const provisionSiteStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; websiteId: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const rt = await import("./runtime.server");
    const sb = context.supabase as any;
    const { data: site } = await sb.from("websites").select("id, name, domain").eq("id", data.websiteId).maybeSingle();
    if (!site) throw new Error("الموقع غير موجود");
    if (!rt.isSafeDomain(site.domain)) throw new Error("نطاق غير صالح");

    const syncKey = rt.randomPassword();
    const identity = rt.buildIdentity({
      websiteId: site.id, ownerId: context.userId, domain: site.domain, serverId: data.serverId, syncKey,
    });

    let { data: storage } = await sb
      .from("storages")
      .select("*")
      .eq("website_id", site.id)
      .eq("server_id", data.serverId)
      .maybeSingle();

    if (!storage && !data.dryRun) {
      const res = await sb
        .from("storages")
        .insert({
          owner_id: context.userId,
          website_id: site.id,
          server_id: data.serverId,
          name: site.domain,
          storage_type: "server",
          path: rt.siteRoot(site.domain),
          status: "active",
          auto_provisioned: true,
          identity_written: true,
        })
        .select("*")
        .maybeSingle();
      storage = res.data;
    }

    await queue(sb, context.userId, data.serverId, "site_dir", { domain: site.domain }, { websiteId: site.id, dryRun: data.dryRun });
    await queue(sb, context.userId, data.serverId, "write_config", {
      path: rt.identityPath(site.domain), content: identity,
    }, { websiteId: site.id, dryRun: data.dryRun });

    if (!data.dryRun) {
      await log(sb, context.userId, {
        storage_id: storage?.id ?? null, website_id: site.id, server_id: data.serverId,
        event_kind: "provision", path: rt.siteRoot(site.domain), detail: "إنشاء المجلد وملف الملكية",
      });
    }
    return { ok: true, storage, identityPath: rt.identityPath(site.domain) };
  });

/** Turn live (inotify) sync on/off for a site folder. */
export const setLiveSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { storageId: string; enabled: boolean; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: storage } = await sb.from("storages").select("*").eq("id", data.storageId).maybeSingle();
    if (!storage) throw new Error("مساحة التخزين غير موجودة");
    if (!storage.server_id) throw new Error("لا يوجد سيرفر مرتبط");
    const { data: site } = await sb.from("websites").select("domain").eq("id", storage.website_id).maybeSingle();
    const domain = site?.domain ?? storage.name;
    const cmdId = await queue(sb, context.userId, storage.server_id, data.enabled ? "watch_start" : "watch_stop",
      { domain }, { websiteId: storage.website_id, dryRun: data.dryRun });
    if (!data.dryRun) {
      await sb.from("storages").update({ watch_enabled: data.enabled, sync_status: data.enabled ? "watching" : "idle" }).eq("id", storage.id);
      await log(sb, context.userId, {
        storage_id: storage.id, website_id: storage.website_id, server_id: storage.server_id,
        event_kind: data.enabled ? "watch_on" : "watch_off", path: storage.path,
      });
    }
    return { ok: true, commandId: cmdId };
  });

export const refreshStorageUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const id = await queue(context.supabase as any, context.userId, data.serverId, "storage_usage", {});
    return { ok: true, commandId: id };
  });

/** Sync a site folder from this server to a peer server (cluster replica). */
export const syncSiteNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: member } = await sb.from("site_cluster_members").select("*").eq("id", data.memberId).maybeSingle();
    if (!member) throw new Error("العضو غير موجود");
    const { data: siblings } = await sb
      .from("site_cluster_members")
      .select("*")
      .eq("cluster_id", member.cluster_id);
    const primary = (siblings ?? []).find((m: any) => m.role === "primary") ?? member;
    const targets = (siblings ?? []).filter((m: any) => m.id !== primary.id);
    if (targets.length === 0) throw new Error("لا توجد نسخة أخرى للمزامنة معها");

    const ids: string[] = [];
    for (const t of targets) {
      const { data: srv } = await sb.from("servers").select("hostname, private_ip").eq("id", t.server_id).maybeSingle();
      const host = srv?.private_ip || srv?.hostname;
      if (!host) continue;
      const id = await queue(sb, context.userId, primary.server_id, "sync_site",
        { domain: primary.domain, target_host: host }, { dryRun: data.dryRun });
      if (id) ids.push(id);
    }
    if (!data.dryRun) {
      await sb.from("site_cluster_members").update({ sync_status: "syncing", last_sync_at: new Date().toISOString() })
        .eq("cluster_id", member.cluster_id);
    }
    return { ok: true, commands: ids };
  });

export const setClusterSyncMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; syncMode: string; intervalSeconds?: number }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("site_cluster_members")
      .update({ sync_mode: data.syncMode, sync_interval_seconds: data.intervalSeconds ?? 300 })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
