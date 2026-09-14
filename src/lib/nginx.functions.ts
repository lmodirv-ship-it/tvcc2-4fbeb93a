import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

export const NGINX_ACTIONS = [
  "nginx_vhost_list", "nginx_vhost_read", "nginx_vhost_write", "nginx_vhost_enable",
  "nginx_vhost_disable", "nginx_vhost_delete", "nginx_cert_list", "nginx_cert_issue",
  "nginx_cert_renew", "nginx_access_log", "nginx_error_log", "nginx_stats",
  "nginx_test", "nginx_reload",
] as const;

export type NginxAction = (typeof NGINX_ACTIONS)[number];

const RISKY: readonly string[] = [
  "nginx_vhost_write", "nginx_vhost_delete", "nginx_vhost_disable", "nginx_cert_issue",
];

async function assertAdmin(supabase: any, userId: string) {
  const ok = await isAdminOrOwner(supabase, userId);
  if (!ok) throw new Error("إدارة الواجهة والتوجيه متاحة للمالك والمدير فقط");
}

async function audit(supabase: any, userId: string, action: string, serverId: string, details: Record<string, unknown>) {
  await supabase.from("audit_log").insert({
    owner_id: userId, actor_id: userId, action, resource: "servers", resource_id: serverId, after_data: details,
  });
  const { logSecurityEvent } = await import("./security-log.server");
  await logSecurityEvent(supabase, userId, {
    category: "server_command",
    action,
    resource: "nginx",
    resourceId: serverId,
    severity: action === "nginx_vhost_delete" ? "critical" : RISKY.includes(action) ? "warning" : "info",
    details,
  });
}

/** السيرفرات المتاحة + الوكلاء لواجهة التوجيه. */
export const getNginxServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [servers, agents, certs] = await Promise.all([
      supabase
        .from("servers")
        .select("id,name,hostname,status,public_ip,private_ip,agent_version,last_seen_at,role")
        .order("name"),
      supabase.from("agent_instances").select("server_id,agent_key,role,status,last_heartbeat_at"),
      supabase.from("ssl_certificates").select("*").order("expires_at", { ascending: true }).limit(200),
    ]);
    return { servers: servers.data ?? [], agents: agents.data ?? [], certificates: certs.data ?? [] };
  });

/** آخر نتائج أوامر Nginx على السيرفر. */
export const getNginxCommands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: rows } = await supabase
      .from("server_commands")
      .select("id,action,args,status,output,exit_code,created_at,completed_at,dry_run")
      .eq("server_id", data.serverId)
      .in("action", [...NGINX_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(60);
    return rows ?? [];
  });

/** إرسال أمر Nginx إلى الوكيل. الكتابة دائماً تمر بفحص nginx -t وتراجع تلقائي على السيرفر. */
export const queueNginxAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serverId: string;
    action: NginxAction;
    args?: Record<string, unknown>;
    dryRun?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!NGINX_ACTIONS.includes(data.action)) throw new Error("أمر Nginx غير مسموح");

    const args = { ...(data.args ?? {}) };
    const file = typeof args["file"] === "string" ? (args["file"] as string) : null;
    if (file && !/^[A-Za-z0-9._-]+$/.test(file)) throw new Error("اسم الملف غير صالح");
    const domain = typeof args["domain"] === "string" ? (args["domain"] as string) : null;
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error("النطاق غير صالح");

    const { data: server } = await supabase.from("servers").select("id,name").eq("id", data.serverId).single();
    if (!server) throw new Error("السيرفر غير موجود");

    const { data: cmd, error } = await supabase
      .from("server_commands")
      .insert({
        owner_id: userId,
        requested_by: userId,
        server_id: data.serverId,
        action: data.action,
        args: args as any,
        status: "pending",
        dry_run: Boolean(data.dryRun),
      })
      .select("id,action,status,created_at,dry_run")
      .single();
    if (error) throw new Error(error.message);

    if (RISKY.includes(data.action) && !data.dryRun) {
      await audit(supabase, userId, data.action, data.serverId, { ...args, command_id: cmd.id });
    }
    return cmd;
  });

/** توليد ملف vhost جاهز من نموذج بسيط (بدون تنفيذ). */
export function buildVhost(opts: {
  domain: string;
  port: number;
  ssl?: boolean;
  websocket?: boolean;
  maxBodyMb?: number;
  staticRoot?: string | null;
}): string {
  const lines: string[] = ["server {", "  listen 80;"];
  if (opts.ssl) lines.push("  listen 443 ssl;");
  lines.push(`  server_name ${opts.domain};`);
  lines.push(`  client_max_body_size ${opts.maxBodyMb ?? 50}m;`);
  if (opts.ssl) {
    lines.push(`  ssl_certificate /etc/letsencrypt/live/${opts.domain}/fullchain.pem;`);
    lines.push(`  ssl_certificate_key /etc/letsencrypt/live/${opts.domain}/privkey.pem;`);
  }
  lines.push("  access_log /var/log/nginx/access.log;");
  lines.push("  error_log /var/log/nginx/error.log;");
  if (opts.staticRoot) {
    lines.push(`  root ${opts.staticRoot};`);
    lines.push("  index index.html;");
    lines.push("  location / { try_files $uri $uri/ /index.html; }");
  } else {
    lines.push("  location / {");
    lines.push(`    proxy_pass http://127.0.0.1:${opts.port};`);
    lines.push("    proxy_http_version 1.1;");
    lines.push("    proxy_set_header Host $host;");
    lines.push("    proxy_set_header X-Real-IP $remote_addr;");
    lines.push("    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;");
    lines.push("    proxy_set_header X-Forwarded-Proto $scheme;");
    if (opts.websocket) {
      lines.push("    proxy_set_header Upgrade $http_upgrade;");
      lines.push('    proxy_set_header Connection "upgrade";');
    }
    lines.push("  }");
  }
  lines.push("}");
  return lines.join("\n");
}
