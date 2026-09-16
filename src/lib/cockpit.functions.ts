import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMMAND_WHITELIST } from "./server-commands";

const COCKPIT_ACTIONS = new Set([
  "users_list", "service_status", "service_restart", "service_logs", "service_action",
  "disk_usage", "firewall_list", "firewall_allow", "firewall_deny", "scan_ports",
  "proc_list", "fs_list", "fs_read", "docker_ps", "pkg_list", "pkg_updates",
  "pkg_upgrade", "shell_exec", "cockpit_install",
]);

async function requireManager(context: any) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const allowed = (roles ?? []).some((row: any) => row.role === "admin" || row.role === "system_owner");
  if (!allowed) throw new Error("هذه الصفحة متاحة للمالك والمدير فقط");
}

export const getCockpitOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const sb = context.supabase as any;
    const id = data.serverId;
    const [serverRes, metricsRes, disksRes, netsRes, servicesRes, containersRes, portsRes, commandsRes, eventsRes, sitesRes] = await Promise.all([
      sb.from("servers").select("*").eq("id", id).maybeSingle(),
      sb.from("server_metrics").select("*").eq("server_id", id).order("collected_at", { ascending: false }).limit(60),
      sb.from("server_disks").select("*").eq("server_id", id),
      sb.from("server_net_interfaces").select("*").eq("server_id", id),
      sb.from("server_services").select("*").eq("server_id", id).order("name"),
      sb.from("server_containers").select("*").eq("server_id", id),
      sb.from("server_ports").select("*").eq("server_id", id).order("port"),
      sb.from("server_commands").select("*").eq("server_id", id).order("created_at", { ascending: false }).limit(100),
      sb.from("server_events").select("*").eq("server_id", id).order("created_at", { ascending: false }).limit(100),
      sb.from("websites").select("id,name,domain,status,server_id").eq("server_id", id).limit(500),
    ]);
    if (!serverRes.data) throw new Error("السيرفر غير موجود");
    const metrics = (metricsRes.data ?? []).slice().reverse();
    return {
      server: serverRes.data,
      metrics,
      latest: metrics.at(-1) ?? null,
      disks: disksRes.data ?? [],
      nets: netsRes.data ?? [],
      services: servicesRes.data ?? [],
      containers: containersRes.data ?? [],
      ports: portsRes.data ?? [],
      commands: commandsRes.data ?? [],
      events: eventsRes.data ?? [],
      sites: sitesRes.data ?? [],
    };
  });

export const queueCockpitCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; action: string; args?: Record<string, unknown>; confirmed?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);
    if (!COCKPIT_ACTIONS.has(data.action) || !(COMMAND_WHITELIST as readonly string[]).includes(data.action)) throw new Error("أمر Cockpit غير مسموح");
    if (["pkg_upgrade", "shell_exec", "cockpit_install"].includes(data.action) && !data.confirmed) throw new Error("يلزم تأكيد هذا الأمر");
    const sb = context.supabase as any;
    const { data: row, error } = await sb.from("server_commands").insert({
      owner_id: context.userId,
      server_id: data.serverId,
      action: data.action,
      args: data.args ?? {},
      requested_by: context.userId,
      status: "pending",
    }).select("id,status").maybeSingle();
    if (error) throw new Error(error.message);
    await sb.from("operation_log").insert({
      owner_id: context.userId,
      scope: "server",
      server_id: data.serverId,
      operation: data.action,
      title: `Cockpit: ${data.action}`,
      input: data.args ?? {},
      result: { command_id: row?.id },
      status: "pending",
      actor: "user",
    });
    return row;
  });
