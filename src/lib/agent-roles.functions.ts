import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Agent roles, capabilities, jobs and the live command feed for one server. */

export const BUILTIN_AGENT_ROLES = [
  {
    key: "observer",
    name: "مراقب (قراءة فقط)",
    description: "قراءة الحالة والسجلات دون أي تغيير",
    actions: [
      "scan_ports", "read_configs", "service_status", "service_logs", "disk_usage",
      "storage_usage", "port_check", "link_check", "fs_list", "fs_tree", "fs_read",
      "fs_search", "ai_models_list", "ollama_ps", "site_logs", "db_ping", "agent_diag",
      "tunnel_status", "vpn_status",
    ],
  },
  {
    key: "operator",
    name: "مشغّل (تشغيل وإيقاف)",
    description: "كل صلاحيات المراقب + تشغيل/إيقاف الخدمات والمواقع والجدار الناري",
    actions: [
      "service_restart", "nginx_test", "nginx_reload", "firewall_list", "firewall_allow",
      "firewall_deny", "firewall_apply", "site_start", "site_stop", "site_restart",
      "ollama_start", "ollama_stop", "ollama_pull", "ollama_rm", "port_forward",
      "port_bind_domain", "port_unbind_domain", "job_cancel",
    ],
  },
  {
    key: "deployer",
    name: "ناشر (بناء ونشر)",
    description: "كل صلاحيات المشغّل + النشر والبناء والنسخ الاحتياطي والمزامنة",
    actions: [
      "deploy_upload", "build_run", "serve_start", "serve_stop", "git_deploy", "unit_write",
      "site_dir", "write_config", "nginx_write_vhost", "issue_ssl", "ssl_issue_manual",
      "site_backup", "site_restore", "db_dump", "db_import", "db_sync", "storage_sync",
      "sync_site", "fs_write", "fs_mkdir", "fs_move", "agent_self_update",
    ],
  },
  { key: "full", name: "كامل الصلاحيات", description: "كل الأوامر المسموح بها في المنصة", actions: ["*"] },
] as const;

async function ensureBuiltins(sb: any, ownerId: string) {
  const { data: existing } = await sb.from("agent_roles").select("key").eq("owner_id", ownerId);
  const have = new Set(((existing ?? []) as Array<{ key: string }>).map((r) => r.key));
  const missing = BUILTIN_AGENT_ROLES.filter((r) => !have.has(r.key)).map((r) => ({
    owner_id: ownerId,
    key: r.key,
    name: r.name,
    description: r.description,
    actions: [...r.actions],
    is_builtin: true,
  }));
  if (missing.length) await sb.from("agent_roles").insert(missing);
}

/** Everything the agent tab needs: instance, roles, capabilities, jobs, recent commands. */
export const getAgentOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await ensureBuiltins(sb, context.userId);

    const [{ data: instance }, { data: roles }, { data: bindings }, { data: caps }, { data: jobs }, { data: commands }] =
      await Promise.all([
        sb.from("agent_instances").select("*").eq("server_id", data.serverId).maybeSingle(),
        sb.from("agent_roles").select("*").order("key"),
        sb.from("agent_role_bindings").select("*").eq("server_id", data.serverId),
        sb.from("agent_capabilities").select("*").eq("server_id", data.serverId).order("action"),
        sb.from("agent_jobs").select("*").eq("server_id", data.serverId).order("created_at", { ascending: false }).limit(20),
        sb
          .from("server_commands")
          .select("id, action, args, status, exit_code, output, progress, duration_ms, dry_run, created_at, started_at, finished_at")
          .eq("server_id", data.serverId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    return {
      instance: instance ?? null,
      roles: roles ?? [],
      bindings: bindings ?? [],
      capabilities: caps ?? [],
      jobs: jobs ?? [],
      commands: commands ?? [],
    };
  });

/** Live feed only — cheap and polled often by the console at the bottom of the page. */
export const getCommandFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [{ data: commands }, { data: instance }] = await Promise.all([
      sb
        .from("server_commands")
        .select("id, action, args, status, exit_code, output, progress, duration_ms, dry_run, created_at, started_at, finished_at")
        .eq("server_id", data.serverId)
        .order("created_at", { ascending: false })
        .limit(50),
      sb.from("agent_instances").select("agent_version, last_poll_at, status").eq("server_id", data.serverId).maybeSingle(),
    ]);
    return { commands: commands ?? [], instance: instance ?? null };
  });

/** Bind a role to a server and materialize it into per-action capabilities. */
export const applyAgentRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; roleId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { COMMAND_WHITELIST } = await import("./server-commands");
    const { data: role } = await sb.from("agent_roles").select("*").eq("id", data.roleId).maybeSingle();
    if (!role) throw new Error("الدور غير موجود");

    await sb.from("agent_role_bindings").upsert(
      {
        owner_id: context.userId,
        server_id: data.serverId,
        role_id: role.id,
        granted_by: context.userId,
      },
      { onConflict: "server_id,role_id" },
    );

    const roleActions: string[] = role.actions ?? [];
    const cumulative = new Set<string>();
    if (roleActions.includes("*")) {
      COMMAND_WHITELIST.forEach((a) => cumulative.add(a));
    } else {
      // roles are cumulative: observer < operator < deployer
      const order = ["observer", "operator", "deployer"];
      const upTo = order.indexOf(role.key);
      for (const r of BUILTIN_AGENT_ROLES) {
        const idx = order.indexOf(r.key);
        if (idx >= 0 && upTo >= 0 && idx <= upTo) r.actions.forEach((a) => cumulative.add(a));
      }
      roleActions.forEach((a) => cumulative.add(a));
    }

    const rows = COMMAND_WHITELIST.map((action) => ({
      owner_id: context.userId,
      server_id: data.serverId,
      action,
      allowed: cumulative.has(action),
      requires_confirm: ["fs_delete", "db_import", "site_restore", "restore_all", "agent_self_update"].includes(action),
      max_per_hour: 120,
    }));
    const { error } = await sb.from("agent_capabilities").upsert(rows, { onConflict: "server_id,action" });
    if (error) throw new Error(error.message);
    return { ok: true, allowed: rows.filter((r) => r.allowed).length };
  });

export const setAgentCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; action: string; allowed: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("agent_capabilities").upsert(
      {
        owner_id: context.userId,
        server_id: data.serverId,
        action: data.action,
        allowed: data.allowed,
      },
      { onConflict: "server_id,action" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Queue one command, enforcing the capability map before it reaches the agent. */
export const dispatchAgentCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; action: string; args?: Record<string, unknown>; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { COMMAND_WHITELIST } = await import("./server-commands");
    if (!(COMMAND_WHITELIST as readonly string[]).includes(data.action)) throw new Error("أمر غير مسموح");

    const { data: cap } = await sb
      .from("agent_capabilities")
      .select("allowed, max_per_hour")
      .eq("server_id", data.serverId)
      .eq("action", data.action)
      .maybeSingle();
    if (cap && cap.allowed === false) throw new Error("هذا الأمر ممنوع على هذا السيرفر حسب الدور الممنوح");

    if (cap?.max_per_hour) {
      const since = new Date(Date.now() - 3_600_000).toISOString();
      const { count } = await sb
        .from("server_commands")
        .select("id", { count: "exact", head: true })
        .eq("server_id", data.serverId)
        .eq("action", data.action)
        .gte("created_at", since);
      if ((count ?? 0) >= cap.max_per_hour) throw new Error("تم بلوغ الحد الأقصى لتنفيذ هذا الأمر خلال ساعة");
    }

    const { data: row, error } = await sb
      .from("server_commands")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        action: data.action,
        args: data.args ?? {},
        dry_run: data.dryRun ?? false,
        requested_by: context.userId,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, commandId: row?.id as string };
  });

export const cancelAgentCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("server_commands")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.id)
      .in("status", ["pending", "running"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** A job = an ordered list of commands executed by the agent. */
export const createAgentJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string;
    title: string;
    kind?: string;
    steps: Array<{ action: string; args?: Record<string, unknown> }>;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { COMMAND_WHITELIST } = await import("./server-commands");
    if (!data.steps?.length) throw new Error("المهمة بلا خطوات");

    const { data: job, error } = await sb
      .from("agent_jobs")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        title: data.title,
        kind: data.kind ?? "custom",
        status: "running",
        requested_by: context.userId,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    let no = 1;
    for (const step of data.steps) {
      if (!(COMMAND_WHITELIST as readonly string[]).includes(step.action)) continue;
      const { data: cmd } = await sb
        .from("server_commands")
        .insert({
          owner_id: context.userId,
          server_id: data.serverId,
          action: step.action,
          args: step.args ?? {},
          dry_run: false,
          requested_by: context.userId,
          status: "pending",
          job_id: job.id,
        })
        .select("id")
        .maybeSingle();
      await sb.from("agent_job_steps").insert({
        owner_id: context.userId,
        job_id: job.id,
        step_no: no++,
        action: step.action,
        args: step.args ?? {},
        command_id: cmd?.id ?? null,
        status: "pending",
      });
    }
    return { ok: true, jobId: job.id as string };
  });
