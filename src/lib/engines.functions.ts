import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultContext, engineById, type EngineContext } from "./engines";

/** محركات المنصة: إرسال سكربتات/مهام إلى وكلاء السيرفرات وتحديث العلاقات. */

async function assertAdmin(supabase: any, userId: string) {
  const { isAdminOrOwner } = await import("./roles.server");
  const ok = await isAdminOrOwner(supabase, userId);
  if (!ok) throw new Error("صلاحيات غير كافية — التشغيل للمالك والمدير فقط");
}

export const listEngineTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [servers, agents, websites, models] = await Promise.all([
      sb.from("servers").select("id, name, hostname, status, last_seen_at").order("name"),
      sb.from("agent_instances").select("server_id, agent_version, status, role, last_poll_at"),
      sb.from("websites").select("id, name, domain, status, server_id").order("name").limit(500),
      sb.from("ai_models").select("id, name, model_id, server_id, is_active").limit(300),
    ]);
    return {
      servers: servers.data ?? [],
      agents: agents.data ?? [],
      websites: websites.data ?? [],
      models: models.data ?? [],
    };
  });

export const getEngineRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { serverId: string }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows } = await sb
      .from("server_commands")
      .select("id, action, status, exit_code, output, dry_run, duration_ms, created_at, finished_at")
      .eq("server_id", data.serverId)
      .order("created_at", { ascending: false })
      .limit(40);
    return { commands: rows ?? [] };
  });

/** يشغّل محرّكاً واحداً على سيرفر: يُدرج خطواته في طابور الوكيل ويحدّث العلاقات. */
export const runEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    serverId: string;
    engineId: string;
    websiteId?: string | null;
    ctx: Partial<EngineContext>;
    dryRun?: boolean;
  }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const engine = engineById(data.engineId);
    if (!engine) throw new Error("محرّك غير معروف");

    const { COMMAND_WHITELIST } = await import("./server-commands");
    const ctx = defaultContext(data.ctx);
    const steps = engine.steps(ctx);
    const bad = steps.find((s) => !(COMMAND_WHITELIST as readonly string[]).includes(s.action));
    if (bad) throw new Error(`أمر غير مسموح: ${bad.action}`);

    const rows = steps.map((s) => ({
      owner_id: context.userId,
      requested_by: context.userId,
      server_id: data.serverId,
      website_id: data.websiteId ?? null,
      action: s.action,
      args: s.args,
      dry_run: data.dryRun ?? false,
      status: "pending",
    }));
    const { data: inserted, error } = await sb.from("server_commands").insert(rows).select("id");
    if (error) throw new Error(error.message);

    if (!data.dryRun) await linkRelations(sb, context.userId, data, ctx, engine.id);

    await sb.from("audit_log").insert({
      owner_id: context.userId,
      actor_id: context.userId,
      action: `engine.${engine.id}`,
      resource: "server_commands",
      resource_id: data.serverId,
      severity: "info",
      after_data: { engine: engine.id, steps: steps.map((s) => s.action), dry_run: data.dryRun ?? false },
    });

    return { ok: true, queued: inserted?.length ?? 0, actions: steps.map((s) => s.action) };
  });

/** تشغيل نفس المحرّك على عدة مواقع بالترتيب. */
export const runEngineBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    engineId: string;
    dryRun?: boolean;
    targets: Array<{ serverId: string; websiteId?: string | null; ctx: Partial<EngineContext> }>;
  }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const engine = engineById(data.engineId);
    if (!engine) throw new Error("محرّك غير معروف");
    const { COMMAND_WHITELIST } = await import("./server-commands");

    let queued = 0;
    const failed: string[] = [];
    for (const t of data.targets.slice(0, 100)) {
      try {
        const ctx = defaultContext(t.ctx);
        const steps = engine.steps(ctx).filter((s) => (COMMAND_WHITELIST as readonly string[]).includes(s.action));
        const { error } = await sb.from("server_commands").insert(
          steps.map((s) => ({
            owner_id: context.userId,
            requested_by: context.userId,
            server_id: t.serverId,
            website_id: t.websiteId ?? null,
            action: s.action,
            args: s.args,
            dry_run: data.dryRun ?? false,
            status: "pending",
          })),
        );
        if (error) throw new Error(error.message);
        queued += steps.length;
        if (!data.dryRun) await linkRelations(sb, context.userId, { serverId: t.serverId, websiteId: t.websiteId }, ctx, engine.id);
      } catch (e: any) {
        failed.push(`${t.ctx.domain ?? t.serverId}: ${e?.message ?? "خطأ"}`);
      }
    }
    return { ok: true, queued, failed };
  });

/** تحديث العلاقات — إضافة أو تحديث فقط، بدون أي حذف. */
async function linkRelations(
  sb: any,
  userId: string,
  target: { serverId: string; websiteId?: string | null },
  ctx: EngineContext,
  engineId: string,
) {
  const { serverId, websiteId } = target;

  if (websiteId) {
    await sb.from("websites").update({ server_id: serverId }).eq("id", websiteId).is("server_id", null);
  }

  if (["site_up", "git_redeploy", "build_serve", "bind_site"].includes(engineId) && ctx.domain) {
    const { data: existingSite } = await sb
      .from("server_sites")
      .select("id")
      .eq("server_id", serverId)
      .eq("domain", ctx.domain)
      .maybeSingle();
    const sitePayload = {
      owner_id: userId,
      server_id: serverId,
      website_id: websiteId ?? null,
      name: ctx.siteName || ctx.domain,
      domain: ctx.domain,
      port: ctx.port,
      status: "pending",
      service_kind: "web",
      last_seen_at: new Date().toISOString(),
    };
    if (existingSite) await sb.from("server_sites").update(sitePayload).eq("id", existingSite.id);
    else await sb.from("server_sites").insert(sitePayload);

    const { data: rt } = await sb
      .from("site_runtimes")
      .select("id")
      .eq("server_id", serverId)
      .eq("domain", ctx.domain)
      .maybeSingle();
    const rtPayload = {
      owner_id: userId,
      server_id: serverId,
      website_id: websiteId ?? null,
      domain: ctx.domain,
      port: ctx.port,
      root_path: ctx.rootPath,
      unit_name: ctx.unit,
      runtime_kind: "node",
      auto_start: true,
      status: "starting",
      last_restart_at: new Date().toISOString(),
    };
    if (rt) await sb.from("site_runtimes").update(rtPayload).eq("id", rt.id);
    else await sb.from("site_runtimes").insert(rtPayload);
  }

  if (["bind_site", "ai_bind_site"].includes(engineId) && ctx.domain) {
    const sourcePort = engineId === "ai_bind_site" ? 11434 : 80;
    const targetPort = engineId === "ai_bind_site" ? 11434 : ctx.port;
    const { data: link } = await sb
      .from("port_links")
      .select("id")
      .eq("source_server_id", serverId)
      .eq("domain", ctx.domain)
      .eq("target_port", targetPort)
      .maybeSingle();
    if (!link) {
      await sb.from("port_links").insert({
        owner_id: userId,
        source_server_id: serverId,
        website_id: websiteId ?? null,
        name: engineId === "ai_bind_site" ? `AI — ${ctx.domain}` : `Web — ${ctx.domain}`,
        domain: ctx.domain,
        source_port: sourcePort,
        target_port: targetPort,
        target_host: "127.0.0.1",
        link_kind: engineId === "ai_bind_site" ? "ai" : "web",
        bridge_kind: "nginx",
        status: "pending",
      });
    }
  }

  if (engineId === "ai_bind_site" && websiteId) {
    const { data: svc } = await sb
      .from("site_services")
      .select("id")
      .eq("website_id", websiteId)
      .eq("name", "ai")
      .maybeSingle();
    if (!svc) {
      await sb.from("site_services").insert({
        owner_id: userId,
        website_id: websiteId,
        name: "ai",
        service_type: "ai",
        description: `نموذج محلي ${ctx.model} على ${ctx.domain}`,
        endpoint_url: `https://${ctx.domain}/ai/`,
        health_path: "/ai/api/tags",
        link_method: "http",
        auth_type: "none",
        is_public: false,
      });
    }
  }
}
