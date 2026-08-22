import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Everything the linking hub needs in one round-trip. */
export const getConnectHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [services, deps, websites, databases, siteDatabases, servers] = await Promise.all([
      sb.from("site_services").select("*").order("name"),
      sb.from("service_dependencies").select("*"),
      sb.from("websites").select("id, name, domain").order("name").limit(500),
      sb.from("databases").select("id, name, db_type, host, status").order("name"),
      sb.from("site_databases").select("*").order("created_at", { ascending: false }),
      sb.from("servers").select("id, name, hostname, status").order("name"),
    ]);
    return {
      services: services.data ?? [],
      dependencies: deps.data ?? [],
      websites: websites.data ?? [],
      databases: databases.data ?? [],
      siteDatabases: siteDatabases.data ?? [],
      servers: servers.data ?? [],
    };
  });

/** Register any service (local, cloud, or an HN group service) so sites can consume it. */
export const registerService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      websiteId: string;
      name: string;
      serviceType: string;
      endpointUrl?: string;
      description?: string;
      isPublic?: boolean;
      vaultSecretName?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("site_services")
      .insert({
        owner_id: context.userId,
        website_id: data.websiteId,
        name: data.name,
        service_type: data.serviceType,
        endpoint_url: data.endpointUrl ?? null,
        description: data.description ?? null,
        is_public: data.isPublic ?? false,
        status: "active",
        metadata: data.vaultSecretName ? { vault_secret_name: data.vaultSecretName } : {},
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, service: row };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.from("service_dependencies").delete().eq("service_id", data.serviceId);
    const { error } = await sb.from("site_services").delete().eq("id", data.serviceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Link a website to a database (local on a server, or cloud) and inject its env key. */
export const linkDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      websiteId: string;
      databaseId?: string;
      serverId?: string;
      connectionKind: string; // local | network | cloud
      dbEngine: string;
      dbName?: string;
      dbUser?: string;
      host?: string;
      port?: number;
      role?: string;
      envKey?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const envKey = data.envKey || "DATABASE_URL";
    const { data: row, error } = await sb
      .from("site_databases")
      .insert({
        owner_id: context.userId,
        website_id: data.websiteId,
        database_id: data.databaseId ?? null,
        server_id: data.serverId ?? null,
        connection_kind: data.connectionKind,
        db_engine: data.dbEngine,
        db_name: data.dbName ?? null,
        db_user: data.dbUser ?? null,
        host: data.host ?? null,
        port: data.port ?? null,
        role: data.role ?? "primary",
        env_key: envKey,
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data.host && data.dbName) {
      const scheme = data.dbEngine === "mysql" ? "mysql" : data.dbEngine === "mongodb" ? "mongodb" : "postgresql";
      const url = `${scheme}://${data.dbUser ?? "app"}@${data.host}:${data.port ?? 5432}/${data.dbName}`;
      await sb.from("website_env_vars").upsert(
        {
          owner_id: context.userId,
          website_id: data.websiteId,
          environment: "production",
          key: envKey,
          value: url,
          is_secret: true,
          description: "ربط تلقائي بقاعدة بيانات",
        },
        { onConflict: "website_id,environment,key" },
      );
    }

    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "website",
      website_id: data.websiteId,
      operation: "link_database",
      title: `ربط قاعدة بيانات (${data.connectionKind})`,
      input: { engine: data.dbEngine, host: data.host ?? null },
      result: { env_key: envKey },
      status: "success",
      actor: "user",
    });

    return { ok: true, link: row };
  });

export const unlinkDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("site_databases").delete().eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
