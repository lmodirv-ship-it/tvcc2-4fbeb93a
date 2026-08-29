import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Everything the backup page needs: servers usable as destination + registered databases. */
export const getBackupHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [servers, databases, websites, storages] = await Promise.all([
      sb.from("servers").select("id, name, hostname, status, server_role").order("name"),
      sb.from("databases").select("*").order("created_at", { ascending: false }),
      sb.from("websites").select("id, name, domain, server_id").order("domain").limit(1000),
      sb.from("storages").select("id, name, server_id, path, used_gb").order("name"),
    ]);
    return {
      servers: servers.data ?? [],
      databases: databases.data ?? [],
      websites: websites.data ?? [],
      storages: storages.data ?? [],
    };
  });

const BACKUP_TYPES = ["full", "files", "database"];

/**
 * Back up many sites (default: all) into one destination server + path.
 * Each site gets a site_backups row (flagged as the newest one) and a
 * server_command queued for the source server's agent to push the archive.
 */
export const runFleetBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      targetServerId: string;
      destPath?: string;
      backupType?: string;
      websiteIds?: string[];
      onlyLinked?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const type = BACKUP_TYPES.includes(data.backupType ?? "") ? data.backupType! : "full";
    const destPath = (data.destPath || "/var/backups/tvcc").replace(/\/+$/, "");

    const { data: target } = await sb
      .from("servers")
      .select("id, name, hostname")
      .eq("id", data.targetServerId)
      .maybeSingle();
    if (!target) throw new Error("سيرفر الوجهة غير موجود");

    let q = sb.from("websites").select("id, domain, server_id");
    if (data.websiteIds?.length) q = q.in("id", data.websiteIds);
    const { data: sites, error } = await q.limit(1000);
    if (error) throw new Error(error.message);

    const list = (sites ?? []).filter((s: any) => (data.onlyLinked === false ? true : true));
    const results: { websiteId: string; domain: string; ok: boolean; note: string }[] = [];
    const stamp = new Date().toISOString().slice(0, 16);

    for (const site of list) {
      const sourceServer = site.server_id ?? data.targetServerId;
      const path = `${destPath}/${site.domain}/${type}`;
      const { data: row, error: insErr } = await sb
        .from("site_backups")
        .insert({
          owner_id: context.userId,
          website_id: site.id,
          server_id: sourceServer,
          target_server_id: data.targetServerId,
          dest_path: path,
          backup_type: type,
          label: `${site.domain} — ${stamp} → ${target.name}`,
          status: "pending",
          is_latest: true,
        })
        .select("id")
        .maybeSingle();

      if (insErr || !row) {
        results.push({ websiteId: site.id, domain: site.domain, ok: false, note: insErr?.message ?? "فشل التسجيل" });
        continue;
      }

      // Only the newest backup per site+type keeps the "latest" flag.
      await sb
        .from("site_backups")
        .update({ is_latest: false })
        .eq("website_id", site.id)
        .eq("backup_type", type)
        .neq("id", row.id);

      await sb.from("server_commands").insert({
        owner_id: context.userId,
        server_id: sourceServer,
        website_id: site.id,
        action: type === "database" ? "db_dump" : "site_backup",
        args: {
          domain: site.domain,
          backup_id: row.id,
          backup_type: type,
          dest_path: path,
          target_server_id: data.targetServerId,
          target_host: target.hostname,
        },
        requested_by: context.userId,
        status: "pending",
      });

      results.push({ websiteId: site.id, domain: site.domain, ok: true, note: path });
    }

    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "server",
      server_id: data.targetServerId,
      operation: "fleet_backup",
      title: `نسخ احتياطي جماعي (${type}) → ${target.name}`,
      input: { dest_path: destPath, sites: results.length },
      result: { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length },
      status: results.every((r) => r.ok) ? "success" : "warning",
      actor: "user",
    });

    return { ok: true, total: results.length, results };
  });

/* ---------------- local ⇄ cloud database registry ---------------- */

export const saveDatabaseEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      dbKind: string; // local | cloud
      dbType: string; // postgres | mysql | mongodb | redis | supabase
      host?: string;
      port?: number;
      dbName?: string;
      dbUser?: string;
      serverId?: string;
      connectionUrl?: string;
      envKey?: string;
      websiteId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = {
      owner_id: context.userId,
      name: data.name,
      db_kind: data.dbKind === "local" ? "local" : "cloud",
      db_type: data.dbType,
      host: data.host ?? null,
      port: data.port ?? null,
      db_name: data.dbName ?? null,
      db_user: data.dbUser ?? null,
      server_id: data.serverId ?? null,
      connection_url: data.connectionUrl ?? null,
      env_key: data.envKey ?? "DATABASE_URL",
      website_id: data.websiteId ?? null,
      status: "active",
    };
    if (data.id) {
      const { error } = await sb.from("databases").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb.from("databases").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id };
  });

export const deleteDatabaseEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("databases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pair a local database with a cloud one (mirror / primary-replica) for dual storage. */
export const pairDatabases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { primaryId: string; replicaId: string; syncMode: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.primaryId === data.replicaId) throw new Error("اختر قاعدتين مختلفتين");
    const mode = ["mirror", "primary_replica", "none"].includes(data.syncMode) ? data.syncMode : "mirror";
    const { error } = await sb
      .from("databases")
      .update({ linked_database_id: data.replicaId, sync_mode: mode })
      .eq("id", data.primaryId);
    if (error) throw new Error(error.message);
    await sb.from("databases").update({ linked_database_id: data.primaryId, sync_mode: mode }).eq("id", data.replicaId);
    return { ok: true };
  });

/** Queue an agent job that dumps the primary and loads it into the linked database. */
export const syncDatabasePair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: primary } = await sb.from("databases").select("*").eq("id", data.id).maybeSingle();
    if (!primary) throw new Error("القاعدة غير موجودة");
    if (!primary.linked_database_id) throw new Error("لا توجد قاعدة مرتبطة — اربطها أولاً");
    const { data: replica } = await sb
      .from("databases")
      .select("*")
      .eq("id", primary.linked_database_id)
      .maybeSingle();
    const serverId = primary.server_id ?? replica?.server_id;
    if (!serverId) throw new Error("لا يوجد سيرفر ينفّذ المزامنة — اربط القاعدة بسيرفر");

    const { error } = await sb.from("server_commands").insert({
      owner_id: context.userId,
      server_id: serverId,
      action: "db_sync",
      args: {
        source: { engine: primary.db_type, host: primary.host, port: primary.port, db: primary.db_name, user: primary.db_user },
        target: { engine: replica?.db_type, host: replica?.host, port: replica?.port, db: replica?.db_name, user: replica?.db_user },
        mode: primary.sync_mode,
      },
      requested_by: context.userId,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    await sb.from("databases").update({ last_sync_at: new Date().toISOString() }).eq("id", primary.id);
    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "server",
      server_id: serverId,
      operation: "db_sync",
      title: `مزامنة ${primary.name} ⇄ ${replica?.name ?? "—"}`,
      input: { mode: primary.sync_mode },
      status: "pending",
      actor: "user",
    });
    return { ok: true };
  });

/** Reachability probe for a registered database (through the agent when possible). */
export const testDatabaseEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: db } = await sb.from("databases").select("*").eq("id", data.id).maybeSingle();
    if (!db) throw new Error("القاعدة غير موجودة");

    if (db.connection_url && /^https?:\/\//.test(db.connection_url)) {
      const started = Date.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7000);
        const res = await fetch(db.connection_url, { signal: ctrl.signal });
        clearTimeout(t);
        const ms = Date.now() - started;
        await sb.from("databases").update({ status: res.ok ? "active" : "degraded", last_error: null }).eq("id", db.id);
        return { status: res.ok ? "active" : "degraded", message: `HTTP ${res.status} خلال ${ms}ms` };
      } catch (e: any) {
        await sb.from("databases").update({ status: "error", last_error: e?.message ?? "" }).eq("id", db.id);
        return { status: "error", message: `تعذّر الوصول: ${e?.message ?? "خطأ شبكة"}` };
      }
    }

    if (db.server_id) {
      await sb.from("server_commands").insert({
        owner_id: context.userId,
        server_id: db.server_id,
        action: "db_ping",
        args: { engine: db.db_type, host: db.host, port: db.port, db: db.db_name, user: db.db_user },
        requested_by: context.userId,
        status: "pending",
      });
      return { status: "checking", message: "تم إرسال فحص db_ping إلى وكيل السيرفر." };
    }
    return { status: "unknown", message: "أضف رابط اتصال HTTP أو اربط القاعدة بسيرفر ليتم الفحص." };
  });
