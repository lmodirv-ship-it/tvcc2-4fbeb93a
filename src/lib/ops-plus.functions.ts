import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * البنود 5→10: Failover، مثبّت الوكيل، نشر Git، مراقبة التوفّر،
 * المهام المجدولة، الويبهوك، وتتبّع التكاليف.
 * كل دالة تعمل على جداول جديدة فقط — لا تمسّ الجداول القائمة.
 */

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
  return (data?.id as string) ?? null;
}

/* ------------------------------------------------------------ 5) Failover */

export const getFailoverHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [policies, events, servers, websites] = await Promise.all([
      sb.from("failover_policies").select("*").order("created_at", { ascending: false }),
      sb.from("failover_events").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("servers").select("id, name, hostname, status, public_ip, private_ip"),
      sb.from("websites").select("id, name, domain, server_id").order("domain"),
    ]);
    return {
      policies: policies.data ?? [],
      events: events.data ?? [],
      servers: servers.data ?? [],
      websites: websites.data ?? [],
    };
  });

export const saveFailoverPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, any>) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      owner_id: context.userId,
      name: String(data["name"] ?? "سياسة"),
      website_id: data["website_id"] || null,
      primary_server_id: data["primary_server_id"] || null,
      backup_server_id: data["backup_server_id"] || null,
      health_url: data["health_url"] || null,
      check_interval_sec: Number(data["check_interval_sec"] ?? 60),
      failure_threshold: Number(data["failure_threshold"] ?? 3),
      auto_failback: data["auto_failback"] !== false,
      is_active: data["is_active"] !== false,
    };
    const q = data["id"]
      ? sb.from("failover_policies").update(row).eq("id", data["id"]).select("*").maybeSingle()
      : sb.from("failover_policies").insert(row).select("*").maybeSingle();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteFailoverPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("failover_policies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** فحص صحة الهدف وتنفيذ التحويل عند تجاوز عتبة الأعطال. */
export const runFailoverCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { policyId: string; force?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: p } = await sb.from("failover_policies").select("*").eq("id", data.policyId).maybeSingle();
    if (!p) throw new Error("السياسة غير موجودة");

    let healthy = false;
    let detail = "لا يوجد رابط فحص";
    if (p.health_url) {
      const started = Date.now();
      try {
        const res = await fetch(p.health_url, { method: "GET", signal: AbortSignal.timeout(10000) });
        healthy = res.ok;
        detail = `HTTP ${res.status} · ${Date.now() - started}ms`;
      } catch (e: any) {
        healthy = false;
        detail = e?.message ?? "تعذّر الاتصال";
      }
    }

    const failures = healthy ? 0 : (p.consecutive_failures ?? 0) + 1;
    const shouldSwitch = data.force || (!healthy && failures >= (p.failure_threshold ?? 3) && p.current_state === "primary");
    const shouldBack = healthy && p.current_state === "backup" && p.auto_failback;

    let state = p.current_state;
    let commandId: string | null = null;
    const domain = p.health_url ? new URL(p.health_url).hostname : null;

    if (shouldSwitch && p.backup_server_id) {
      const { data: target } = await sb.from("servers").select("public_ip, private_ip, hostname").eq("id", p.backup_server_id).maybeSingle();
      commandId = await queue(sb, context.userId, p.primary_server_id ?? p.backup_server_id, "failover_switch", {
        domain,
        target: target?.public_ip ?? target?.private_ip ?? target?.hostname ?? "",
      }, { websiteId: p.website_id });
      state = "backup";
      await sb.from("failover_events").insert({
        owner_id: context.userId, policy_id: p.id, event_type: "failover",
        from_server_id: p.primary_server_id, to_server_id: p.backup_server_id,
        reason: detail, details: { commandId },
      });
    } else if (shouldBack && p.primary_server_id) {
      const { data: target } = await sb.from("servers").select("public_ip, private_ip, hostname").eq("id", p.primary_server_id).maybeSingle();
      commandId = await queue(sb, context.userId, p.primary_server_id, "failover_switch", {
        domain,
        target: target?.public_ip ?? target?.private_ip ?? target?.hostname ?? "",
      }, { websiteId: p.website_id });
      state = "primary";
      await sb.from("failover_events").insert({
        owner_id: context.userId, policy_id: p.id, event_type: "failback",
        from_server_id: p.backup_server_id, to_server_id: p.primary_server_id,
        reason: detail, details: { commandId },
      });
    }

    await sb.from("failover_policies").update({
      consecutive_failures: failures,
      current_state: state,
      last_checked_at: new Date().toISOString(),
    }).eq("id", p.id);

    return { healthy, detail, failures, state, commandId };
  });

/* ------------------------------------------------- 6) مثبّت الوكيل بأمر واحد */

export const createAgentInstaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; label?: string; osTarget?: string; baseUrl: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: server } = await sb.from("servers").select("id, name").eq("id", data.serverId).maybeSingle();
    if (!server) throw new Error("السيرفر غير موجود");
    const secret = process.env["SERVERS_INGEST_SECRET"];
    if (!secret) throw new Error("إعداد الوكيل غير مكتمل على الخادم");
    const { deriveAgentToken } = await import("./agent-token");
    const token = deriveAgentToken(secret, server.id);
    const base = data.baseUrl.replace(/\/$/, "");
    const cmd = `curl -fsSL "${base}/api/public/servers/agent?id=${server.id}&token=${token}" | sudo bash`;
    const { data: saved, error } = await sb.from("agent_installers").insert({
      owner_id: context.userId,
      server_id: server.id,
      label: data.label ?? server.name,
      os_target: data.osTarget ?? "linux",
      install_command: cmd,
      status: "ready",
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return saved;
  });

export const listAgentInstallers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("agent_installers").select("*").order("created_at", { ascending: false }).limit(30);
    return data ?? [];
  });

/* --------------------------------------------------------- 7) نشر من Git */

export const getDeployHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [repos, deployments, servers, websites] = await Promise.all([
      sb.from("git_repositories").select("*").order("created_at", { ascending: false }),
      sb.from("git_deployments").select("*").order("created_at", { ascending: false }).limit(40),
      sb.from("servers").select("id, name, hostname"),
      sb.from("websites").select("id, name, domain").order("domain"),
    ]);
    return {
      repos: repos.data ?? [],
      deployments: deployments.data ?? [],
      servers: servers.data ?? [],
      websites: websites.data ?? [],
    };
  });

export const saveGitRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, any>) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      owner_id: context.userId,
      website_id: data["website_id"] || null,
      server_id: data["server_id"] || null,
      provider: data["provider"] || "github",
      repo_url: String(data["repo_url"] ?? ""),
      branch: data["branch"] || "main",
      build_command: data["build_command"] || null,
      output_dir: data["output_dir"] || null,
      deploy_path: data["deploy_path"] || null,
      auto_deploy: !!data["auto_deploy"],
      webhook_secret: data["webhook_secret"] || crypto.randomUUID().replace(/-/g, ""),
    };
    if (!row.repo_url) throw new Error("رابط المستودع مطلوب");
    const q = data["id"]
      ? sb.from("git_repositories").update(row).eq("id", data["id"]).select("*").maybeSingle()
      : sb.from("git_repositories").insert(row).select("*").maybeSingle();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteGitRepository = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("git_repositories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runGitDeploy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { repositoryId: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: repo } = await sb.from("git_repositories").select("*").eq("id", data.repositoryId).maybeSingle();
    if (!repo) throw new Error("المستودع غير موجود");
    if (!repo.server_id) throw new Error("اختر سيرفر النشر أولاً");

    const commandId = await queue(sb, context.userId, repo.server_id, "git_deploy", {
      repo: repo.repo_url,
      branch: repo.branch,
      path: repo.deploy_path ?? `/var/www/${repo.branch}`,
      build: repo.build_command ?? "",
    }, { websiteId: repo.website_id, dryRun: !!data.dryRun });

    const { data: dep, error } = await sb.from("git_deployments").insert({
      owner_id: context.userId,
      repository_id: repo.id,
      website_id: repo.website_id,
      server_id: repo.server_id,
      trigger_source: data.dryRun ? "dry-run" : "manual",
      status: data.dryRun ? "dry-run" : "queued",
      command_id: commandId,
      started_at: new Date().toISOString(),
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return { deployment: dep, commandId };
  });

/* ------------------------------------------------------- 8) مراقبة التوفّر */

export const getUptimeHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [monitors, checks, websites] = await Promise.all([
      sb.from("uptime_monitors").select("*").order("created_at", { ascending: false }),
      sb.from("uptime_checks").select("*").order("checked_at", { ascending: false }).limit(200),
      sb.from("websites").select("id, name, domain").order("domain"),
    ]);
    return { monitors: monitors.data ?? [], checks: checks.data ?? [], websites: websites.data ?? [] };
  });

export const saveUptimeMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, any>) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      owner_id: context.userId,
      website_id: data["website_id"] || null,
      name: String(data["name"] ?? "مراقب"),
      url: String(data["url"] ?? ""),
      method: data["method"] || "GET",
      expected_status: Number(data["expected_status"] ?? 200),
      interval_sec: Number(data["interval_sec"] ?? 300),
      timeout_ms: Number(data["timeout_ms"] ?? 10000),
      is_active: data["is_active"] !== false,
    };
    if (!row.url) throw new Error("العنوان مطلوب");
    const q = data["id"]
      ? sb.from("uptime_monitors").update(row).eq("id", data["id"]).select("*").maybeSingle()
      : sb.from("uptime_monitors").insert(row).select("*").maybeSingle();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteUptimeMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("uptime_monitors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runUptimeChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { monitorId?: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb.from("uptime_monitors").select("*").eq("is_active", true);
    if (data.monitorId) q = q.eq("id", data.monitorId);
    const { data: monitors } = await q;

    const results = [];
    for (const m of monitors ?? []) {
      const started = Date.now();
      let status = "down";
      let httpStatus: number | null = null;
      let err: string | null = null;
      try {
        const res = await fetch(m.url, { method: m.method || "GET", signal: AbortSignal.timeout(m.timeout_ms || 10000) });
        httpStatus = res.status;
        status = res.status === (m.expected_status || 200) ? "up" : res.ok ? "degraded" : "down";
      } catch (e: any) {
        err = e?.message ?? "تعذّر الاتصال";
      }
      const latency = Date.now() - started;
      await sb.from("uptime_checks").insert({
        owner_id: context.userId, monitor_id: m.id, status,
        http_status: httpStatus, latency_ms: latency, error_message: err,
      });
      await sb.from("uptime_monitors").update({
        last_status: status, last_latency_ms: latency, last_checked_at: new Date().toISOString(),
      }).eq("id", m.id);
      results.push({ id: m.id, name: m.name, status, httpStatus, latency, error: err });
    }
    return { checked: results.length, results };
  });

/* ----------------------------------------------------- 9) المهام المجدولة */

export const getAutomationHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [tasks, runs, hooks, deliveries, servers, websites] = await Promise.all([
      sb.from("scheduled_tasks").select("*").order("created_at", { ascending: false }),
      sb.from("task_runs").select("*").order("started_at", { ascending: false }).limit(50),
      sb.from("webhook_endpoints").select("*").order("created_at", { ascending: false }),
      sb.from("webhook_deliveries").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("servers").select("id, name, hostname"),
      sb.from("websites").select("id, name, domain").order("domain"),
    ]);
    return {
      tasks: tasks.data ?? [], runs: runs.data ?? [],
      hooks: hooks.data ?? [], deliveries: deliveries.data ?? [],
      servers: servers.data ?? [], websites: websites.data ?? [],
    };
  });

export const saveScheduledTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, any>) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const interval = Number(data["interval_minutes"] ?? 60);
    const row = {
      owner_id: context.userId,
      name: String(data["name"] ?? "مهمة"),
      task_type: String(data["task_type"] ?? "uptime_check"),
      server_id: data["server_id"] || null,
      website_id: data["website_id"] || null,
      schedule_kind: data["schedule_kind"] || "interval",
      interval_minutes: interval,
      cron_expression: data["cron_expression"] || null,
      payload: data["payload"] ?? {},
      is_active: data["is_active"] !== false,
      next_run_at: new Date(Date.now() + interval * 60000).toISOString(),
    };
    const q = data["id"]
      ? sb.from("scheduled_tasks").update(row).eq("id", data["id"]).select("*").maybeSingle()
      : sb.from("scheduled_tasks").insert(row).select("*").maybeSingle();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteScheduledTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("scheduled_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runScheduledTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: task } = await sb.from("scheduled_tasks").select("*").eq("id", data.id).maybeSingle();
    if (!task) throw new Error("المهمة غير موجودة");

    const { data: run } = await sb.from("task_runs")
      .insert({ owner_id: context.userId, task_id: task.id, status: "running" })
      .select("*").maybeSingle();

    let output = "";
    let status = "success";
    let errorMessage: string | null = null;
    try {
      if (task.task_type === "server_command" && task.server_id) {
        const cid = await queue(sb, context.userId, task.server_id, String(task.payload?.action ?? "disk_usage"), task.payload?.args ?? {}, { websiteId: task.website_id });
        output = `تم جدولة الأمر (${cid})`;
      } else if (task.task_type === "uptime_check") {
        const { data: monitors } = await sb.from("uptime_monitors").select("id, url, method, timeout_ms, expected_status").eq("is_active", true);
        let up = 0;
        for (const m of monitors ?? []) {
          try {
            const res = await fetch(m.url, { method: m.method || "GET", signal: AbortSignal.timeout(m.timeout_ms || 10000) });
            const st = res.status === (m.expected_status || 200) ? "up" : "down";
            if (st === "up") up += 1;
            await sb.from("uptime_checks").insert({ owner_id: context.userId, monitor_id: m.id, status: st, http_status: res.status });
            await sb.from("uptime_monitors").update({ last_status: st, last_checked_at: new Date().toISOString() }).eq("id", m.id);
          } catch {
            await sb.from("uptime_checks").insert({ owner_id: context.userId, monitor_id: m.id, status: "down", error_message: "timeout" });
          }
        }
        output = `فُحص ${monitors?.length ?? 0} مراقب · متاح ${up}`;
      } else if (task.task_type === "failover_check") {
        const { data: policies } = await sb.from("failover_policies").select("id").eq("is_active", true);
        output = `سياسات مفعّلة: ${policies?.length ?? 0}`;
      } else {
        output = `نوع المهمة "${task.task_type}" مسجّل بدون منفّذ مباشر`;
      }
    } catch (e: any) {
      status = "failed";
      errorMessage = e?.message ?? "خطأ غير معروف";
    }

    await sb.from("task_runs").update({
      status, output, error_message: errorMessage, finished_at: new Date().toISOString(),
    }).eq("id", run?.id);

    await sb.from("scheduled_tasks").update({
      last_run_at: new Date().toISOString(),
      last_status: status,
      next_run_at: new Date(Date.now() + (task.interval_minutes ?? 60) * 60000).toISOString(),
    }).eq("id", task.id);

    return { status, output, errorMessage };
  });

/* -------------------------------------------------------- 10) الويبهوك */

export const saveWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, any>) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      owner_id: context.userId,
      name: String(data["name"] ?? "ويبهوك"),
      direction: data["direction"] || "outgoing",
      url: String(data["url"] ?? ""),
      secret: data["secret"] || crypto.randomUUID().replace(/-/g, ""),
      events: Array.isArray(data["events"]) ? data["events"] : [],
      is_active: data["is_active"] !== false,
    };
    if (!row.url) throw new Error("العنوان مطلوب");
    const q = data["id"]
      ? sb.from("webhook_endpoints").update(row).eq("id", data["id"]).select("*").maybeSingle()
      : sb.from("webhook_endpoints").insert(row).select("*").maybeSingle();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("webhook_endpoints").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: hook } = await sb.from("webhook_endpoints").select("*").eq("id", data.id).maybeSingle();
    if (!hook) throw new Error("الويبهوك غير موجود");

    const payload = { event: "test", source: "tvcc", at: new Date().toISOString() };
    let status = "sent";
    let code: number | null = null;
    let err: string | null = null;
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-tvcc-signature": hook.secret ?? "" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      code = res.status;
      if (!res.ok) status = "failed";
    } catch (e: any) {
      status = "failed";
      err = e?.message ?? "تعذّر الإرسال";
    }
    await sb.from("webhook_deliveries").insert({
      owner_id: context.userId, endpoint_id: hook.id, event: "test",
      payload, status, response_code: code, error_message: err,
    });
    await sb.from("webhook_endpoints").update({ last_delivery_at: new Date().toISOString() }).eq("id", hook.id);
    return { status, code, error: err };
  });

/* --------------------------------------------------- 11) التكاليف والاستهلاك */

export const getUsageCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data } = await sb.from("usage_costs").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = data ?? [];
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const v = Number(r.total_cost ?? 0);
      total += v;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + v;
    }
    return { rows, byCategory, total };
  });

export const saveUsageCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, any>) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const quantity = Number(data["quantity"] ?? 0);
    const unitCost = Number(data["unit_cost"] ?? 0);
    const { data: saved, error } = await sb.from("usage_costs").insert({
      owner_id: context.userId,
      category: String(data["category"] ?? "other"),
      provider: data["provider"] || null,
      server_id: data["server_id"] || null,
      website_id: data["website_id"] || null,
      quantity,
      unit: data["unit"] || "unit",
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
      currency: data["currency"] || "USD",
      notes: data["notes"] || null,
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteUsageCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("usage_costs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
