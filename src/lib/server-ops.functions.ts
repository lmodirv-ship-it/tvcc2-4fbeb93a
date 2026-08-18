import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMMAND_WHITELIST } from "./server-commands";



async function writeLog(
  sb: any,
  ownerId: string,
  entry: {
    scope?: string;
    server_id?: string | null;
    website_id?: string | null;
    operation: string;
    title: string;
    input?: unknown;
    result?: unknown;
    status?: string;
    actor?: string;
    notes?: string | null;
  },
) {
  await sb.from("operation_log").insert({
    owner_id: ownerId,
    scope: entry.scope ?? "server",
    server_id: entry.server_id ?? null,
    website_id: entry.website_id ?? null,
    operation: entry.operation,
    title: entry.title,
    input: entry.input ?? {},
    result: entry.result ?? {},
    status: entry.status ?? "success",
    actor: entry.actor ?? "user",
    notes: entry.notes ?? null,
  });
}

/** Ports + configs + command queue + backups for one server. */
export const getServerOps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: ports }, { data: configs }, { data: commands }, { data: backups }] = await Promise.all([
      sb.from("server_ports").select("*").eq("server_id", data.serverId).order("port"),
      sb.from("server_configs").select("*").eq("server_id", data.serverId).order("kind"),
      sb
        .from("server_commands")
        .select("*")
        .eq("server_id", data.serverId)
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("site_backups")
        .select("*")
        .eq("server_id", data.serverId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      ports: ports ?? [],
      configs: configs ?? [],
      commands: commands ?? [],
      backups: backups ?? [],
    };
  });

export const queueServerCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { serverId: string; action: string; args?: Record<string, unknown>; websiteId?: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!(COMMAND_WHITELIST as readonly string[]).includes(data.action)) {
      throw new Error("أمر غير مسموح به");
    }
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("server_commands")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        website_id: data.websiteId ?? null,
        action: data.action,
        args: data.args ?? {},
        requested_by: context.userId,
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await writeLog(sb, context.userId, {
      server_id: data.serverId,
      website_id: data.websiteId ?? null,
      operation: data.action,
      title: `طلب تنفيذ: ${data.action}`,
      input: data.args ?? {},
      status: "pending",
    });
    return row;
  });

export const deleteServerCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("server_commands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Queue a config write (agent applies then re-reads the file). */
export const saveServerConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; kind: string; path: string; content: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("server_commands").insert({
      owner_id: context.userId,
      server_id: data.serverId,
      action: "write_config",
      args: { kind: data.kind, path: data.path, content: data.content },
      requested_by: context.userId,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    await writeLog(sb, context.userId, {
      server_id: data.serverId,
      operation: "write_config",
      title: `تعديل إعداد: ${data.path}`,
      input: { kind: data.kind, path: data.path, bytes: data.content.length },
      status: "pending",
    });
    return { ok: true };
  });

/* ---------------- backups ---------------- */

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("site_backups")
      .select("*, websites(name, domain)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { websiteId: string; serverId?: string | null; backupType?: string; label?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const type = ["full", "files", "database"].includes(data.backupType ?? "") ? data.backupType! : "full";

    const { data: site } = await sb
      .from("websites")
      .select("id, name, domain, server_id")
      .eq("id", data.websiteId)
      .maybeSingle();
    if (!site) throw new Error("الموقع غير موجود");

    const serverId = data.serverId ?? site.server_id ?? null;
    const { data: row, error } = await sb
      .from("site_backups")
      .insert({
        owner_id: context.userId,
        website_id: data.websiteId,
        server_id: serverId,
        backup_type: type,
        label: data.label ?? `${site.domain} — ${new Date().toISOString().slice(0, 16)}`,
        status: serverId ? "pending" : "queued_no_server",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (serverId) {
      await sb.from("server_commands").insert({
        owner_id: context.userId,
        server_id: serverId,
        website_id: data.websiteId,
        action: type === "database" ? "db_dump" : "site_backup",
        args: { domain: site.domain, backup_id: row?.id, backup_type: type },
        requested_by: context.userId,
        status: "pending",
      });
    }

    await writeLog(sb, context.userId, {
      scope: "website",
      server_id: serverId,
      website_id: data.websiteId,
      operation: "site_backup",
      title: `نسخة احتياطية (${type}) — ${site.domain}`,
      input: { backup_type: type },
      status: serverId ? "pending" : "warning",
      notes: serverId ? null : "لا يوجد سيرفر مرتبط بالموقع — النسخة مسجّلة فقط",
    });

    return row;
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("site_backups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: bk } = await sb.from("site_backups").select("*").eq("id", data.id).maybeSingle();
    if (!bk) throw new Error("النسخة غير موجودة");
    if (!bk.server_id) throw new Error("لا يوجد سيرفر مرتبط بهذه النسخة");

    await sb.from("server_commands").insert({
      owner_id: context.userId,
      server_id: bk.server_id,
      website_id: bk.website_id,
      action: bk.backup_type === "database" ? "db_import" : "site_restore",
      args: { backup_id: bk.id, storage_path: bk.storage_path },
      requested_by: context.userId,
      status: "pending",
    });

    await writeLog(sb, context.userId, {
      scope: "website",
      server_id: bk.server_id,
      website_id: bk.website_id,
      operation: "site_restore",
      title: `استعادة نسخة — ${bk.label ?? bk.id}`,
      input: { backup_id: bk.id },
      status: "pending",
    });
    return { ok: true };
  });

/* ---------------- operations notebook ---------------- */

export const listOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId?: string | null; websiteId?: string | null; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("operation_log")
      .select("*, servers(name), websites(domain)")
      .order("created_at", { ascending: false })
      .limit(Math.min(data?.limit ?? 300, 1000));
    if (data?.serverId) q = q.eq("server_id", data.serverId);
    if (data?.websiteId) q = q.eq("website_id", data.websiteId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const logOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      operation: string;
      title: string;
      scope?: string;
      serverId?: string | null;
      websiteId?: string | null;
      input?: Record<string, unknown>;
      result?: Record<string, unknown>;
      status?: string;
      notes?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await writeLog(context.supabase as any, context.userId, {
      scope: data.scope ?? "server",
      server_id: data.serverId ?? null,
      website_id: data.websiteId ?? null,
      operation: data.operation,
      title: data.title,
      input: data.input ?? {},
      result: data.result ?? {},
      status: data.status ?? "success",
      notes: data.notes ?? null,
    });
    return { ok: true };
  });

export const deleteOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("operation_log").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- export / import ---------------- */

export const exportSiteData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: site }, { data: envVars }, { data: settings }, { data: services }, { data: backups }] =
      await Promise.all([
        sb.from("websites").select("*").eq("id", data.websiteId).maybeSingle(),
        sb.from("website_env_vars").select("*").eq("website_id", data.websiteId),
        sb.from("website_settings").select("*").eq("website_id", data.websiteId),
        sb.from("site_services").select("*").eq("website_id", data.websiteId),
        sb.from("site_backups").select("*").eq("website_id", data.websiteId),
      ]);
    if (!site) throw new Error("الموقع غير موجود");

    await writeLog(sb, context.userId, {
      scope: "website",
      website_id: data.websiteId,
      operation: "export_site",
      title: `تصدير بيانات الموقع — ${site.domain}`,
      result: { env_vars: envVars?.length ?? 0, settings: settings?.length ?? 0 },
    });

    return {
      exported_at: new Date().toISOString(),
      version: 1,
      site,
      env_vars: envVars ?? [],
      settings: settings ?? [],
      services: services ?? [],
      backups: backups ?? [],
    };
  });

export const importSiteData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload: any }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const p = data.payload ?? {};
    if (!p?.site?.domain) throw new Error("ملف الاستيراد غير صالح");

    const { data: existing } = await sb
      .from("websites")
      .select("id")
      .eq("domain", p.site.domain)
      .maybeSingle();

    let websiteId = existing?.id as string | undefined;
    if (!websiteId) {
      const { data: created, error } = await sb
        .from("websites")
        .insert({
          owner_id: context.userId,
          name: p.site.name ?? p.site.domain,
          domain: p.site.domain,
          description: p.site.description ?? null,
          verify_code: p.site.verify_code ?? crypto.randomUUID().slice(0, 12),
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      websiteId = created?.id;
    }

    let envCount = 0;
    for (const v of (p.env_vars ?? []) as any[]) {
      if (!v?.key) continue;
      await sb.from("website_env_vars").upsert(
        {
          owner_id: context.userId,
          website_id: websiteId,
          environment: v.environment ?? "production",
          key: v.key,
          value: v.value ?? "",
          is_secret: !!v.is_secret,
          description: v.description ?? null,
        },
        { onConflict: "website_id,environment,key" },
      );
      envCount++;
    }

    await writeLog(sb, context.userId, {
      scope: "website",
      website_id: websiteId ?? null,
      operation: "import_site",
      title: `استيراد بيانات الموقع — ${p.site.domain}`,
      result: { env_vars: envCount },
    });

    return { ok: true, websiteId, envCount };
  });

/** Signed one-liner that installs a copy of the platform on the linked server. */
export const getPlatformDeployCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; origin: string; domain?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: server } = await sb.from("servers").select("*").eq("id", data.serverId).maybeSingle();
    if (!server) throw new Error("السيرفر غير موجود");

    const origin = /^https?:\/\/[^\s/]+$/.test(data.origin) ? data.origin : "https://tvcc.hnpay.live";
    const domain = data.domain?.trim() || server.hostname;

    const script = `#!/usr/bin/env bash
set -euo pipefail
# TVCC — ترحيل نسخة من المنصة إلى هذا السيرفر
APP_DIR=/opt/tvcc-platform
DOMAIN="${domain}"
ORIGIN="${origin}"

command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)
command -v pm2 >/dev/null || npm i -g pm2
mkdir -p "$APP_DIR" && cd "$APP_DIR"

curl -fsSL "$ORIGIN/api/public/platform/bundle" -o platform.tar.gz || true
[ -s platform.tar.gz ] && tar xzf platform.tar.gz

npm ci --omit=dev 2>/dev/null || npm install --omit=dev
pm2 delete tvcc-platform 2>/dev/null || true
pm2 start ".output/server/index.mjs" --name tvcc-platform --env production
pm2 save
echo "TVCC platform running for $DOMAIN"`;

    await writeLog(sb, context.userId, {
      server_id: data.serverId,
      operation: "platform_deploy",
      title: `توليد أمر ترحيل المنصة إلى ${server.name}`,
      input: { domain },
    });

    return {
      script,
      install: `curl -fsSL '${origin}/api/public/platform/deploy.sh' | bash -s -- '${domain}'`,
      domain,
    };
  });
