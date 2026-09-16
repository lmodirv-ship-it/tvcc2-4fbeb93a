import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* مركز الأدوات المفتوحة — قراءة السجل وتنفيذ العمليات عبر وكيل TVCC الموقّع */

async function requireManager(context: any) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "system_owner");
  if (!ok) throw new Error("تنفيذ الأدوات متاح للمالك والمدير فقط");
  return true;
}

export const listTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [toolsRes, pagesRes, installsRes] = await Promise.all([
      sb.from("platform_tools").select("*").order("code"),
      sb.from("platform_tool_pages").select("*"),
      sb.from("platform_tool_installs").select("*"),
    ]);
    const pages = pagesRes.data ?? [];
    const installs = installsRes.data ?? [];
    return {
      tools: (toolsRes.data ?? []).map((t: any) => ({
        ...t,
        pages: pages.filter((p: any) => p.tool_id === t.id),
        installs: installs.filter((i: any) => i.tool_id === t.id),
        installedCount: installs.filter((i: any) => i.tool_id === t.id && i.installed).length,
      })),
    };
  });

export const getToolsForPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pagePath: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: links } = await sb
      .from("platform_tool_pages")
      .select("*, tool:platform_tools(*)")
      .eq("page_path", data.pagePath);
    const ids = (links ?? []).map((l: any) => l.tool_id);
    const { data: installs } = ids.length
      ? await sb.from("platform_tool_installs").select("*").in("tool_id", ids)
      : { data: [] as any[] };
    return (links ?? []).map((l: any) => ({
      ...l,
      installedCount: (installs ?? []).filter((i: any) => i.tool_id === l.tool_id && i.installed).length,
    }));
  });

export const getTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let { data: tool } = await sb.from("platform_tools").select("*").eq("slug", data.slug).maybeSingle();
    if (!tool) {
      const alt = await sb.from("platform_tools").select("*").or(`id.eq.${data.slug},code.eq.${data.slug}`).maybeSingle();
      tool = alt.data;
    }
    if (!tool) return { tool: null, pages: [], installs: [], links: [], servers: [], commands: [] };
    const [pagesRes, installsRes, linksRes, serversRes, cmdRes] = await Promise.all([
      sb.from("platform_tool_pages").select("*").eq("tool_id", tool.id),
      sb.from("platform_tool_installs").select("*").eq("tool_id", tool.id),
      sb.from("platform_tool_links").select("*, related:platform_tools!platform_tool_links_related_tool_id_fkey(slug,name,code)").eq("tool_id", tool.id),
      sb.from("servers").select("id,name,hostname,ip_address,status,agent_version").order("name"),
      sb.from("server_commands").select("id,server_id,action,args,status,exit_code,output,created_at,finished_at")
        .eq("action", "tool_action").order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      tool,
      pages: pagesRes.data ?? [],
      installs: installsRes.data ?? [],
      links: linksRes.data ?? [],
      servers: serversRes.data ?? [],
      commands: (cmdRes.data ?? []).filter((c: any) => c.args?.slug === tool.slug),
    };
  });

export const runToolAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { toolId: string; serverId: string; op: "install" | "start" | "stop" | "restart" | "status" | "uninstall" }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const sb = context.supabase as any;
    const { data: tool } = await sb.from("platform_tools").select("*").eq("id", data.toolId).maybeSingle();
    if (!tool) throw new Error("الأداة غير موجودة");

    const args = {
      slug: tool.slug,
      op: data.op,
      detect_cmd: tool.detect_cmd ?? "",
      install_cmd: tool.install_cmd ?? "",
      start_cmd: tool.start_cmd ?? "",
      stop_cmd: tool.stop_cmd ?? "",
      status_cmd: tool.status_cmd ?? "",
      uninstall_cmd: tool.uninstall_cmd ?? "",
    };

    const { data: cmd, error } = await sb
      .from("server_commands")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        action: "tool_action",
        args,
        requested_by: context.userId,
        status: "pending",
      })
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const status = data.op === "uninstall" ? "unknown" : data.op === "stop" ? "stopping" : "pending";
    await sb.from("platform_tool_installs").upsert(
      {
        tool_id: tool.id,
        server_id: data.serverId,
        status,
        installed: data.op === "uninstall" ? false : undefined,
        port: tool.default_port,
        last_action: data.op,
        last_command_id: cmd?.id,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "tool_id,server_id" },
    );

    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "server",
      server_id: data.serverId,
      operation: "tool_action",
      title: `${tool.name} — ${data.op}`,
      input: args,
      result: { command_id: cmd?.id },
      status: "pending",
      actor: "user",
    });

    return { commandId: cmd?.id, terminalCommand: terminalFor(tool, data.op) };
  });

function terminalFor(tool: any, op: string): string {
  const map: Record<string, string | null> = {
    install: tool.install_cmd,
    start: tool.start_cmd,
    stop: tool.stop_cmd,
    restart: tool.start_cmd,
    status: tool.status_cmd,
    uninstall: tool.uninstall_cmd,
  };
  const cmd = map[op];
  if (!cmd) return "";
  if (op === "install" && tool.detect_cmd) {
    return `if ! (${tool.detect_cmd}); then sudo ${cmd}; fi${tool.start_cmd ? ` && sudo ${tool.start_cmd}` : ""}`;
  }
  return `sudo ${cmd}`;
}

/** تحديث حالة التثبيت من نتيجة أمر الوكيل (يُستدعى عند فتح صفحة الأداة). */
export const refreshToolInstalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { toolId: string }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const sb = context.supabase as any;
    const { data: installs } = await sb.from("platform_tool_installs").select("*").eq("tool_id", data.toolId);
    let updated = 0;
    for (const row of installs ?? []) {
      if (!row.last_command_id) continue;
      const { data: cmd } = await sb
        .from("server_commands")
        .select("status,exit_code,output,finished_at")
        .eq("id", row.last_command_id)
        .maybeSingle();
      if (!cmd || cmd.status === "pending" || cmd.status === "running") continue;
      const out = (cmd.output ?? "").toString();
      const failed = cmd.status === "failed" || (cmd.exit_code ?? 0) !== 0;
      const uninstalled = row.last_action === "uninstall" && !failed;
      const installed = uninstalled ? false : !failed && !/installed=no/.test(out);
      const running = /active|running|^installed=yes/m.test(out) && !failed;
      await sb
        .from("platform_tool_installs")
        .update({
          installed,
          status: uninstalled ? "not_installed" : failed ? "error" : running ? "running" : installed ? "installed" : "not_installed",
          last_output: out.slice(-4000),
          last_checked_at: cmd.finished_at ?? new Date().toISOString(),
        })
        .eq("id", row.id);
      updated++;
    }
    return { updated };
  });
