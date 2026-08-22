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

/* ------------------------------------------------ bulk apply + testing */

/**
 * Apply the same linking recipe (service + database + env vars) to many sites
 * at once. Returns a per-site result so the UI can show exactly what happened.
 */
export const bulkApplyConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      websiteIds: string[];
      serviceId?: string;
      database?: {
        databaseId?: string;
        serverId?: string;
        connectionKind: string;
        dbEngine: string;
        dbName?: string;
        dbUser?: string;
        host?: string;
        port?: number;
        envKey?: string;
      };
      envVars?: { key: string; value: string; isSecret?: boolean }[];
      environment?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const env = data.environment ?? "production";
    const results: { websiteId: string; ok: boolean; steps: string[]; error?: string }[] = [];

    let service: any = null;
    if (data.serviceId) {
      const { data: s } = await sb.from("site_services").select("*").eq("id", data.serviceId).maybeSingle();
      service = s;
    }

    for (const websiteId of data.websiteIds) {
      const steps: string[] = [];
      try {
        if (service) {
          if (service.website_id === websiteId) {
            steps.push("تخطّي الخدمة (نفس الموقع المزوّد)");
          } else {
            const { error } = await sb.from("service_dependencies").upsert(
              {
                owner_id: context.userId,
                consumer_website_id: websiteId,
                provider_website_id: service.website_id,
                service_id: service.id,
                status: "connected",
              },
              { onConflict: "consumer_website_id,service_id" },
            );
            if (error) throw new Error(error.message);
            const prefix = `TVCC_${String(service.service_type || "SERVICE").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
            if (service.endpoint_url) {
              await sb.from("website_env_vars").upsert(
                {
                  owner_id: context.userId, website_id: websiteId, environment: env,
                  key: `${prefix}_URL`, value: service.endpoint_url, is_secret: false,
                  description: `ربط جماعي بخدمة ${service.name}`,
                },
                { onConflict: "website_id,environment,key" },
              );
            }
            steps.push(`ربط بخدمة ${service.name}`);
          }
        }

        if (data.database) {
          const d = data.database;
          const envKey = d.envKey || "DATABASE_URL";
          const { error } = await sb.from("site_databases").insert({
            owner_id: context.userId,
            website_id: websiteId,
            database_id: d.databaseId ?? null,
            server_id: d.serverId ?? null,
            connection_kind: d.connectionKind,
            db_engine: d.dbEngine,
            db_name: d.dbName ?? null,
            db_user: d.dbUser ?? null,
            host: d.host ?? null,
            port: d.port ?? null,
            role: "primary",
            env_key: envKey,
            status: "pending",
          });
          if (error) throw new Error(error.message);
          if (d.host && d.dbName) {
            const scheme = d.dbEngine === "mysql" ? "mysql" : d.dbEngine === "mongodb" ? "mongodb" : "postgresql";
            await sb.from("website_env_vars").upsert(
              {
                owner_id: context.userId, website_id: websiteId, environment: env, key: envKey,
                value: `${scheme}://${d.dbUser ?? "app"}@${d.host}:${d.port ?? 5432}/${d.dbName}`,
                is_secret: true, description: "ربط جماعي بقاعدة بيانات",
              },
              { onConflict: "website_id,environment,key" },
            );
          }
          steps.push(`ربط قاعدة ${d.dbEngine}`);
        }

        for (const v of data.envVars ?? []) {
          if (!v.key) continue;
          const { error } = await sb.from("website_env_vars").upsert(
            {
              owner_id: context.userId, website_id: websiteId, environment: env,
              key: v.key, value: v.value, is_secret: v.isSecret ?? false,
              description: "متغير من الربط الجماعي",
            },
            { onConflict: "website_id,environment,key" },
          );
          if (error) throw new Error(error.message);
          steps.push(`متغير ${v.key}`);
        }

        await sb.from("operation_log").insert({
          owner_id: context.userId, scope: "website", website_id: websiteId,
          operation: "bulk_connect", title: "تطبيق ربط جماعي",
          input: { service_id: data.serviceId ?? null, database: data.database ?? null },
          result: { steps }, status: "success", actor: "user",
        });
        results.push({ websiteId, ok: true, steps });
      } catch (e: any) {
        const message = e?.message ?? "خطأ غير معروف";
        await sb.from("operation_log").insert({
          owner_id: context.userId, scope: "website", website_id: websiteId,
          operation: "bulk_connect", title: "فشل ربط جماعي",
          input: {}, result: { error: message }, status: "failed", actor: "user",
        });
        results.push({ websiteId, ok: false, steps, error: message });
      }
    }

    return { ok: results.every((r) => r.ok), results };
  });

/** Test a single link: service endpoint, database link, or a site's env vars. */
export const testConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "service" | "database" | "env"; id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const started = Date.now();
    let status = "unknown";
    let message = "";
    let latency: number | null = null;

    try {
      if (data.kind === "service") {
        const { data: svc } = await sb.from("site_services").select("*").eq("id", data.id).maybeSingle();
        if (!svc) throw new Error("الخدمة غير موجودة");
        if (!svc.endpoint_url) {
          status = "unknown";
          message = "لا يوجد عنوان (endpoint) لهذه الخدمة — أضف العنوان ثم أعد الاختبار.";
        } else {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 7000);
          try {
            const res = await fetch(svc.endpoint_url, { method: "GET", signal: ctrl.signal });
            latency = Date.now() - started;
            status = res.ok ? "active" : "degraded";
            message = `HTTP ${res.status} خلال ${latency}ms`;
          } catch (err: any) {
            latency = Date.now() - started;
            status = "error";
            message = err?.name === "AbortError"
              ? "انتهت المهلة (7 ثوانٍ) — العنوان غير قابل للوصول من المنصة."
              : `تعذّر الاتصال: ${err?.message ?? "خطأ شبكة"}`;
          } finally {
            clearTimeout(timer);
          }
          await sb.from("site_services").update({ status }).eq("id", data.id);
        }
      } else if (data.kind === "database") {
        const { data: link } = await sb.from("site_databases").select("*").eq("id", data.id).maybeSingle();
        if (!link) throw new Error("الرابط غير موجود");
        if (link.server_id) {
          const { error } = await sb.from("server_commands").insert({
            owner_id: context.userId,
            server_id: link.server_id,
            website_id: link.website_id,
            action: "db_ping",
            args: { engine: link.db_engine, host: link.host, port: link.port, db: link.db_name, user: link.db_user },
            dry_run: false,
            requested_by: context.userId,
            status: "pending",
          });
          if (error) throw new Error(error.message);
          status = "checking";
          message = "تم إرسال فحص db_ping إلى الوكيل — ستظهر النتيجة خلال ثوانٍ في سجل العمليات.";
        } else if (link.host && link.port) {
          status = "unknown";
          message = "لا يوجد سيرفر مرتبط بهذا الرابط — اختر سيرفراً ليفحصه الوكيل من داخل الشبكة.";
        } else {
          status = "error";
          message = "بيانات الاتصال ناقصة (المضيف أو المنفذ).";
        }
        await sb.from("site_databases").update({
          status, last_checked_at: new Date().toISOString(), latency_ms: latency,
        }).eq("id", data.id);
      } else {
        const { data: rows, error } = await sb
          .from("website_env_vars")
          .select("key, value, environment")
          .eq("website_id", data.id);
        if (error) throw new Error(error.message);
        const empty = (rows ?? []).filter((r: any) => !r.value);
        status = (rows ?? []).length === 0 ? "unknown" : empty.length ? "degraded" : "active";
        message = (rows ?? []).length === 0
          ? "لا توجد متغيرات بيئة لهذا الموقع."
          : empty.length
            ? `متغيرات فارغة: ${empty.map((r: any) => r.key).join(", ")}`
            : `${rows.length} متغير سليم.`;
      }
    } catch (e: any) {
      status = "error";
      message = e?.message ?? "خطأ غير معروف";
    }

    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: data.kind === "env" ? "website" : "service",
      website_id: data.kind === "env" ? data.id : null,
      operation: `test_${data.kind}`,
      title: `اختبار ربط (${data.kind})`,
      input: { id: data.id },
      result: { status, message, latency_ms: latency },
      status: status === "error" ? "failed" : "success",
      actor: "user",
    });

    return { status, message, latencyMs: latency };
  });

/** Recent connection-test / linking events for the error log panel. */
export const listConnectionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("operation_log")
      .select("id, operation, title, status, result, created_at, website_id")
      .in("operation", ["test_service", "test_database", "test_env", "bulk_connect", "connect_service", "link_database"])
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
