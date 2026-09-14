import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

export const DOCKER_ACTIONS = [
  "docker_ps", "docker_images", "docker_logs", "docker_action", "docker_exec",
  "docker_pull", "docker_rm", "docker_networks", "docker_volumes",
  "docker_compose_read", "docker_compose_write", "docker_compose_up",
  "docker_compose_down", "docker_create", "docker_prune", "docker_stats",
] as const;

export type DockerAction = (typeof DOCKER_ACTIONS)[number];

const RISKY: readonly string[] = [
  "docker_rm", "docker_prune", "docker_exec", "docker_compose_down",
  "docker_compose_write", "docker_create", "docker_action",
];

async function assertAdmin(supabase: any, userId: string) {
  const { userCan } = await import("./roles.server");
  const ok = (await isAdminOrOwner(supabase, userId)) || (await userCan(supabase, userId, "docker.manage"));
  if (!ok) throw new Error("صلاحيات غير كافية — إدارة الحاويات تتطلب صلاحية «إدارة الحاويات (Docker)»");
}

async function assertRead(supabase: any, userId: string) {
  const { userCan } = await import("./roles.server");
  if (!(await userCan(supabase, userId, "agent.read"))) throw new Error("صلاحيات غير كافية لعرض الحاويات");
}


async function audit(
  supabase: any,
  userId: string,
  action: string,
  serverId: string,
  details: Record<string, unknown>,
) {
  await supabase.from("audit_log").insert({
    owner_id: userId,
    actor_id: userId,
    action,
    resource: "servers",
    resource_id: serverId,
    after_data: details,
  });
  const { logSecurityEvent } = await import("./security-log.server");
  await logSecurityEvent(supabase, userId, {
    category: "server_command",
    action,
    resource: "docker",
    resourceId: serverId,
    severity: RISKY.includes(action) ? "warning" : "info",
    details,
  });
}

/** السيرفرات التي عليها وكيل، لاختيار سيرفر من واجهة الحاويات. */
export const getDockerServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertRead(supabase, userId);
    const [servers, agents] = await Promise.all([
      supabase
        .from("servers")
        .select("id,name,hostname,status,public_ip,private_ip,agent_version,last_seen_at,role")
        .order("name"),
      supabase.from("agent_instances").select("server_id,agent_key,role,status,last_heartbeat_at"),
    ]);
    return { servers: servers.data ?? [], agents: agents.data ?? [] };
  });

/** آخر نتائج أوامر Docker على سيرفر معيّن. */
export const getDockerCommands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRead(supabase, userId);
    const { data: rows } = await supabase
      .from("server_commands")
      .select("id,action,args,status,output,exit_code,created_at,completed_at,dry_run")
      .eq("server_id", data.serverId)
      .in("action", [...DOCKER_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(60);
    return rows ?? [];
  });

/** إرسال أمر Docker إلى وكيل السيرفر (مع دعم المعاينة الآمنة). */
export const queueDockerAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string;
    action: DockerAction;
    args?: Record<string, unknown>;
    dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!DOCKER_ACTIONS.includes(data.action)) throw new Error("أمر Docker غير مسموح");
    const { data: server } = await supabase
      .from("servers")
      .select("id,name")
      .eq("id", data.serverId)
      .single();
    if (!server) throw new Error("السيرفر غير موجود");

    const { data: cmd, error } = await supabase
      .from("server_commands")
      .insert({
        owner_id: userId,
        requested_by: userId,
        server_id: data.serverId,
        action: data.action,
        args: (data.args ?? {}) as any,
        status: "pending",
        dry_run: Boolean(data.dryRun),
      })
      .select("id,action,status,created_at,dry_run")
      .single();
    if (error) throw new Error(error.message);

    if (RISKY.includes(data.action) && !data.dryRun) {
      await audit(supabase, userId, data.action, data.serverId, { args: (data.args ?? {}) as any, command_id: cmd.id });
    }
    return cmd;
  });

/** ربط منفذ حاوية بنطاق: يكتب vhost في Nginx ثم يصدر شهادة. */
export const bindContainerDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string; domain: string; port: number; ssl?: boolean; email?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const domain = data.domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("النطاق غير صالح");
    const port = Number(data.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("المنفذ غير صالح");

    const vhost = [
      "server {",
      "  listen 80;",
      `  server_name ${domain};`,
      "  location / {",
      `    proxy_pass http://127.0.0.1:${port};`,
      "    proxy_http_version 1.1;",
      "    proxy_set_header Host $host;",
      "    proxy_set_header X-Real-IP $remote_addr;",
      "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "    proxy_set_header X-Forwarded-Proto $scheme;",
      "    proxy_set_header Upgrade $http_upgrade;",
      '    proxy_set_header Connection "upgrade";',
      "    client_max_body_size 100m;",
      "  }",
      "}",
    ].join("\n");

    const write = await supabase
      .from("server_commands")
      .insert({
        owner_id: userId, requested_by: userId, server_id: data.serverId,
        action: "nginx_vhost_write", args: { file: domain, content: vhost }, status: "pending", dry_run: false,
      })
      .select("id,action,status,created_at")
      .single();

    let cert = null;
    if (data.ssl) {
      const res = await supabase
        .from("server_commands")
        .insert({
          owner_id: userId, requested_by: userId, server_id: data.serverId,
          action: "nginx_cert_issue", args: { domain, email: data.email ?? null }, status: "pending", dry_run: false,
        })
        .select("id,action,status,created_at")
        .single();
      cert = res.data;
    }
    await audit(supabase, userId, "container_bind_domain", data.serverId, { domain, port, ssl: Boolean(data.ssl) });
    return { write: write.data, cert };
  });
