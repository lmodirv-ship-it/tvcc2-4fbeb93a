import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function enqueue(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  dryRun = false,
) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      action,
      args,
      dry_run: dryRun,
      requested_by: ownerId,
      status: "pending",
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** الأنفاق + نسخ التخزين + السيرفرات المتاحة. */
export const getBridgeOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: tunnels }, { data: syncs }, { data: servers }, { data: websites }] = await Promise.all([
      sb.from("server_tunnels").select("*").order("created_at", { ascending: false }),
      sb.from("site_storage_syncs").select("*").order("updated_at", { ascending: false }),
      sb.from("servers").select("id, name, hostname, public_ip, private_ip, role, status, last_heartbeat_at, agent_version").order("name"),
      sb.from("websites").select("id, name, domain").order("domain").limit(500),
    ]);
    return { tunnels: tunnels ?? [], syncs: syncs ?? [], servers: servers ?? [], websites: websites ?? [] };
  });

/** إنشاء نفق من سيرفر محلي إلى بوابة VPS عامة. */
export const createTunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      localServerId: string;
      gatewayServerId: string;
      localPort: number;
      gatewayPort: number;
      publicDomain?: string | null;
      kind?: string;
      dryRun?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: gw } = await sb
      .from("servers")
      .select("id, hostname, public_ip, name")
      .eq("id", data.gatewayServerId)
      .maybeSingle();
    if (!gw) throw new Error("سيرفر البوابة غير موجود");
    const gatewayHost = gw.public_ip || gw.hostname;
    if (!gatewayHost) throw new Error("سيرفر البوابة بلا عنوان عام");

    const { data: tunnel, error } = await sb
      .from("server_tunnels")
      .insert({
        owner_id: context.userId,
        name: data.name,
        kind: data.kind ?? "reverse_ssh",
        local_server_id: data.localServerId,
        gateway_server_id: data.gatewayServerId,
        local_port: data.localPort,
        gateway_port: data.gatewayPort,
        public_domain: data.publicDomain ?? null,
        status: data.dryRun ? "dry_run" : "pending",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const cmd = await enqueue(
      sb,
      context.userId,
      data.localServerId,
      "tunnel_setup",
      {
        name: data.name,
        local_port: data.localPort,
        gateway_host: gatewayHost,
        gateway_user: "tvcc",
        gateway_port: data.gatewayPort,
      },
      data.dryRun ?? false,
    );
    return { tunnel, command: cmd };
  });

/** نشر النفق على البوابة: vhost + SSL + مفتاح الوصول. */
export const publishTunnelDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tunnelId: string; domain: string; ssl?: boolean; pubkey?: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: tunnel } = await sb.from("server_tunnels").select("*").eq("id", data.tunnelId).maybeSingle();
    if (!tunnel) throw new Error("النفق غير موجود");
    const cmd = await enqueue(
      sb,
      context.userId,
      tunnel.gateway_server_id,
      "gateway_publish",
      {
        domain: data.domain.toLowerCase(),
        gateway_port: tunnel.gateway_port,
        ssl: data.ssl ? "true" : "false",
        pubkey: data.pubkey ?? "",
      },
      data.dryRun ?? false,
    );
    await sb
      .from("server_tunnels")
      .update({ public_domain: data.domain.toLowerCase(), status: data.dryRun ? "dry_run" : "publishing" })
      .eq("id", data.tunnelId);
    return cmd;
  });

/** فحص حالة النفق. */
export const checkTunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tunnelId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: tunnel } = await sb.from("server_tunnels").select("*").eq("id", data.tunnelId).maybeSingle();
    if (!tunnel) throw new Error("النفق غير موجود");
    await sb.from("server_tunnels").update({ last_check_at: new Date().toISOString() }).eq("id", data.tunnelId);
    return enqueue(sb, context.userId, tunnel.local_server_id, "tunnel_status", { name: tunnel.name });
  });

/** إزالة النفق. */
export const dropTunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tunnelId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: tunnel } = await sb.from("server_tunnels").select("*").eq("id", data.tunnelId).maybeSingle();
    if (tunnel) {
      await enqueue(sb, context.userId, tunnel.local_server_id, "tunnel_drop", { name: tunnel.name });
      await sb.from("server_tunnels").delete().eq("id", data.tunnelId);
    }
    return { ok: true };
  });

/** تسجيل موقع في سيرفر التخزين مع مزامنة أولى. */
export const registerStorageSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      websiteId: string;
      domain: string;
      storageServerId: string;
      sourceServerId?: string | null;
      sourcePath?: string;
      autoSync?: boolean;
      intervalMinutes?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const domain = data.domain.toLowerCase();
    const storagePath = `/srv/tvcc-storage/${domain}`;
    const sourcePath = data.sourcePath || `/var/www/${domain}`;
    const { data: row, error } = await sb
      .from("site_storage_syncs")
      .upsert(
        {
          owner_id: context.userId,
          website_id: data.websiteId,
          domain,
          storage_server_id: data.storageServerId,
          source_server_id: data.sourceServerId ?? null,
          source_path: sourcePath,
          storage_path: storagePath,
          auto_sync: data.autoSync ?? true,
          interval_minutes: data.intervalMinutes ?? 30,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "website_id,storage_server_id" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/** تشغيل مزامنة موقع نحو سيرفر التخزين. */
export const runStorageSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { syncId: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: sync } = await sb.from("site_storage_syncs").select("*").eq("id", data.syncId).maybeSingle();
    if (!sync) throw new Error("سجل المزامنة غير موجود");
    const runOn = sync.source_server_id || sync.storage_server_id;
    let targetHost: string | null = null;
    if (sync.source_server_id && sync.source_server_id !== sync.storage_server_id) {
      const { data: st } = await sb
        .from("servers")
        .select("public_ip, private_ip, hostname")
        .eq("id", sync.storage_server_id)
        .maybeSingle();
      targetHost = st?.private_ip || st?.public_ip || st?.hostname || null;
    }
    const cmd = await enqueue(
      sb,
      context.userId,
      runOn,
      "storage_sync",
      {
        domain: sync.domain,
        source_path: sync.source_path,
        storage_path: sync.storage_path,
        target_host: targetHost ? `root@${targetHost}` : "",
      },
      data.dryRun ?? false,
    );
    await sb
      .from("site_storage_syncs")
      .update({ status: data.dryRun ? "dry_run" : "syncing", last_synced_at: new Date().toISOString() })
      .eq("id", data.syncId);
    return cmd;
  });

/** حذف نسخة التخزين وسجلها. */
export const removeStorageSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { syncId: string; prune?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: sync } = await sb.from("site_storage_syncs").select("*").eq("id", data.syncId).maybeSingle();
    if (sync) {
      if (data.prune) {
        await enqueue(sb, context.userId, sync.storage_server_id, "storage_prune", { storage_path: sync.storage_path });
      }
      await sb.from("site_storage_syncs").delete().eq("id", data.syncId);
    }
    return { ok: true };
  });

/** ترقية وكيل السيرفر إلى أحدث إصدار. */
export const upgradeAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: srv } = await sb.from("servers").select("id, agent_token").eq("id", data.serverId).maybeSingle();
    if (!srv) throw new Error("السيرفر غير موجود");
    return enqueue(sb, context.userId, data.serverId, "agent_update", {
      origin: data.origin.replace(/\/$/, ""),
      server_id: data.serverId,
      token: srv.agent_token ?? "",
    });
  });
