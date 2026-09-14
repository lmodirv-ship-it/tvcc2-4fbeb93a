import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRole, isAdminOrOwner } from "./roles.server";

/** Unified publishing across domains, the local node and the local database. */

type TargetKind = "domain" | "local_node" | "local_db";

async function ownerScope(sb: any, userId: string) {
  return isAdminOrOwner(sb, userId);
}

export const listPublishTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: targets }, { data: runs }, { data: servers }] = await Promise.all([
      sb.from("publish_targets").select("*").order("is_canonical", { ascending: false }).order("created_at"),
      sb.from("publish_runs").select("*").order("created_at", { ascending: false }).limit(60),
      sb.from("servers").select("id,name,hostname,public_ip,private_ip,status"),
    ]);
    return {
      targets: targets ?? [],
      runs: runs ?? [],
      servers: servers ?? [],
      isAdmin: await ownerScope(sb, context.userId),
    };
  });

export const upsertPublishTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string | null;
    label: string;
    kind: TargetKind;
    url: string;
    serverId?: string | null;
    serviceName?: string | null;
    port?: number | null;
    healthUrl?: string | null;
    isActive?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const label = String(data.label || "").trim().slice(0, 120);
    const url = String(data.url || "").trim();
    if (!label) throw new Error("الاسم مطلوب");
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error("العنوان غير صالح");

    const payload = {
      owner_id: context.userId,
      label,
      kind: data.kind,
      url,
      server_id: data.serverId || null,
      service_name: data.serviceName || null,
      port: data.port ?? null,
      health_url: data.healthUrl || null,
      is_active: data.isActive ?? true,
    };

    const q = data.id
      ? sb.from("publish_targets").update(payload).eq("id", data.id).select("*").maybeSingle()
      : sb.from("publish_targets").insert(payload).select("*").maybeSingle();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { target: row };
  });

export const setCanonicalTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.from("publish_targets").update({ is_canonical: false }).eq("owner_id", context.userId);
    const { error } = await sb.from("publish_targets").update({ is_canonical: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("publish_targets").update({ is_active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePublishTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("publish_targets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function queueCommand(sb: any, ownerId: string, serverId: string, action: string, args: Record<string, unknown>) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      action,
      args,
      dry_run: false,
      requested_by: ownerId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

async function publishOne(sb: any, userId: string, target: any, trigger: string) {
  const { data: run } = await sb
    .from("publish_runs")
    .insert({
      owner_id: target.owner_id ?? userId,
      target_id: target.id,
      trigger,
      status: "running",
    })
    .select("id")
    .maybeSingle();
  const runId = run?.id as string | undefined;

  const finish = async (patch: Record<string, unknown>) => {
    if (runId) await sb.from("publish_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
    await sb
      .from("publish_targets")
      .update({
        last_publish_at: new Date().toISOString(),
        last_status: String(patch["status"] ?? "unknown"),
      })
      .eq("id", target.id);
  };

  try {
    if (target.kind === "domain") {
      const url = target.health_url || target.url;
      const started = Date.now();
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      const ms = Date.now() - started;
      const ok = res.ok;
      const body = await res.text().catch(() => "");
      let version: string | null = null;
      try {
        version = JSON.parse(body)?.version ?? null;
      } catch {
        /* html response */
      }
      await finish({
        status: ok ? "success" : "failed",
        output: `HTTP ${res.status} • ${ms}ms${version ? ` • v${version}` : ""}`,
        error: ok ? null : `HTTP ${res.status}`,
      });
      if (version) await sb.from("publish_targets").update({ last_version: version }).eq("id", target.id);
      return { ok, targetId: target.id };
    }

    if (!target.server_id) {
      await finish({ status: "failed", error: "لا يوجد سيرفر مرتبط بهذه الوجهة" });
      return { ok: false, targetId: target.id };
    }

    const action = target.kind === "local_db" ? "db_sync" : "site_publish";
    const args =
      target.kind === "local_db"
        ? {
            source: { engine: "postgres", host: "cloud", db: "postgres", port: 5432 },
            target: {
              engine: "postgres",
              host: new URL(target.url).hostname,
              port: 5432,
              db: "postgres",
              user: "postgres",
            },
            note: `sync to ${target.url}`,
          }
        : {
            source: "",
            path: `/opt/${target.service_name || "tvcc"}`,
            service: target.service_name || "tvcc",
            port: target.port ?? 3005,
            health_url: target.health_url ?? `${target.url}/api/public/publish/status`,
          };

    const commandId = await queueCommand(sb, target.owner_id ?? userId, target.server_id, action, args);
    if (runId) await sb.from("publish_runs").update({ command_id: commandId }).eq("id", runId);
    await finish({ status: "pending", output: `أمر ${action} أُرسل إلى الوكيل` });
    return { ok: true, targetId: target.id, commandId };
  } catch (e) {
    await finish({ status: "failed", error: e instanceof Error ? e.message : "خطأ غير معروف" });
    return { ok: false, targetId: target.id };
  }
}

export const runPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: target } = await sb.from("publish_targets").select("*").eq("id", data.targetId).maybeSingle();
    if (!target) throw new Error("الوجهة غير موجودة");
    return publishOne(sb, context.userId, target, "manual");
  });

export const publishAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: targets } = await sb.from("publish_targets").select("*").eq("is_active", true);
    const results = [];
    for (const t of targets ?? []) {
      results.push(await publishOne(sb, context.userId, t, "manual"));
    }
    return { results };
  });
