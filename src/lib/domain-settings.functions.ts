import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NginxOptions = {
  domain: string;
  upstream_host: string;
  backend_port: number | null;
  force_https: boolean;
  http2: boolean;
  websockets: boolean;
  redirect_www: boolean;
  security_headers: boolean;
  client_max_body_mb: number;
  proxy_read_timeout: number;
  extra_directives: string | null;
  ssl_mode: string;
  ssl_cert_path: string | null;
  ssl_key_path: string | null;
};

/** يبني ملف إعداد Nginx كاملاً من خيارات النطاق. */
export function buildVhost(o: NginxOptions): string {
  const d = o.domain;
  const upstream = `http://${o.upstream_host || "127.0.0.1"}:${o.backend_port ?? 80}`;
  const ssl = o.ssl_mode !== "off";
  const cert = o.ssl_cert_path || `/etc/letsencrypt/live/${d}/fullchain.pem`;
  const key = o.ssl_key_path || `/etc/letsencrypt/live/${d}/privkey.pem`;
  const names = o.redirect_www ? `${d} www.${d}` : d;

  const headers = o.security_headers
    ? `
  add_header X-Frame-Options SAMEORIGIN always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
    : "";

  const ws = o.websockets
    ? `
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";`
    : "";

  const proxyBlock = `
  location / {
    proxy_pass ${upstream};${ws}
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout ${o.proxy_read_timeout}s;
  }`;

  const common = `
  client_max_body_size ${o.client_max_body_mb}m;${headers}${proxyBlock}
${o.extra_directives ? `  ${o.extra_directives.trim()}\n` : ""}`;

  if (!ssl) {
    return `# managed by TVCC
server {
  listen 80;
  server_name ${names};
${common}}
`;
  }

  const redirect = o.force_https
    ? `server {
  listen 80;
  server_name ${names};
  location /.well-known/acme-challenge/ { root /var/www/html; }
  return 301 https://${d}$request_uri;
}

`
    : "";

  return `# managed by TVCC
${redirect}server {
  listen 443 ssl${o.http2 ? " http2" : ""};
  server_name ${names};

  ssl_certificate ${cert};
  ssl_certificate_key ${key};
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;
${common}}
`;
}

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

async function notify(sb: any, ownerId: string, title: string, body: string, severity = "info") {
  await sb.from("notifications").insert({
    owner_id: ownerId,
    title,
    message: body,
    severity,
    type: "domain",
  }).then(() => null, () => null);
}

/** إعدادات نطاق واحد + قواعد الجدار الناري الخاصة به. */
export const getDomainSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const domain = data.domain.toLowerCase();
    const { data: settings } = await sb
      .from("domain_settings")
      .select("*")
      .eq("domain", domain)
      .maybeSingle();
    const [{ data: servers }, { data: rules }, { data: website }] = await Promise.all([
      sb.from("servers").select("id, name, hostname, public_ip, role, status").order("name"),
      sb
        .from("firewall_rules")
        .select("*")
        .eq("domain", domain)
        .order("created_at", { ascending: false }),
      sb.from("websites").select("id, name, domain").eq("domain", domain).maybeSingle(),
    ]);
    const commands = settings?.server_id
      ? (
          await sb
            .from("server_commands")
            .select("id, action, status, output, dry_run, created_at, finished_at")
            .eq("server_id", settings.server_id)
            .in("action", [
              "nginx_write_vhost",
              "ssl_issue_manual",
              "firewall_apply",
              "port_bind_domain",
              "port_unbind_domain",
            ])
            .order("created_at", { ascending: false })
            .limit(20)
        ).data ?? []
      : [];
    return {
      settings: settings ?? null,
      servers: servers ?? [],
      rules: rules ?? [],
      website: website ?? null,
      commands,
      preview: settings ? buildVhost(settings as NginxOptions) : null,
    };
  });

/** إنشاء أو تحديث إعدادات النطاق. */
export const saveDomainSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string; patch: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const domain = data.domain.toLowerCase();
    const payload = { ...data.patch, domain, owner_id: context.userId, updated_at: new Date().toISOString() };
    const { data: row, error } = await sb
      .from("domain_settings")
      .upsert(payload, { onConflict: "domain" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: row, preview: buildVhost(row as NginxOptions) };
  });

/** تطبيق إعداد Nginx على السيرفر المرتبط (مع دعم المحاكاة). */
export const applyDomainNginx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const domain = data.domain.toLowerCase();
    const { data: settings } = await sb.from("domain_settings").select("*").eq("domain", domain).maybeSingle();
    if (!settings) throw new Error("لا توجد إعدادات محفوظة لهذا النطاق");
    if (!settings.server_id) throw new Error("حدّد السيرفر المستضيف أولاً");
    const vhost = settings.nginx_template?.trim() ? settings.nginx_template : buildVhost(settings as NginxOptions);
    const cmd = await enqueue(sb, context.userId, settings.server_id, "nginx_write_vhost", { domain, vhost }, data.dryRun ?? false);
    await sb
      .from("domain_settings")
      .update({ status: data.dryRun ? "dry_run" : "applying", last_applied_at: new Date().toISOString() })
      .eq("id", settings.id);
    await notify(sb, context.userId, `تطبيق إعداد Nginx: ${domain}`, `تم إرسال الأمر إلى السيرفر${data.dryRun ? " (محاكاة)" : ""}`);
    return cmd;
  });

/** إصدار/تركيب شهادة SSL. */
export const issueDomainSsl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { domain: string; mode: "letsencrypt" | "manual"; certPem?: string; keyPem?: string; dryRun?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const domain = data.domain.toLowerCase();
    const { data: settings } = await sb.from("domain_settings").select("*").eq("domain", domain).maybeSingle();
    if (!settings?.server_id) throw new Error("حدّد السيرفر المستضيف أولاً");
    if (data.mode === "manual" && (!data.certPem || !data.keyPem)) throw new Error("الشهادة والمفتاح مطلوبان");
    const cmd = await enqueue(
      sb,
      context.userId,
      settings.server_id,
      "ssl_issue_manual",
      { domain, mode: data.mode, cert_pem: data.certPem ?? "", key_pem: data.keyPem ?? "" },
      data.dryRun ?? false,
    );
    await sb
      .from("domain_settings")
      .update({
        ssl_mode: data.mode === "letsencrypt" ? "letsencrypt" : "manual",
        ssl_issuer: data.mode === "letsencrypt" ? "Let's Encrypt" : "manual",
        ssl_cert_path: data.mode === "manual" ? `/etc/tvcc/ssl/${domain}/fullchain.pem` : `/etc/letsencrypt/live/${domain}/fullchain.pem`,
        ssl_key_path: data.mode === "manual" ? `/etc/tvcc/ssl/${domain}/privkey.pem` : `/etc/letsencrypt/live/${domain}/privkey.pem`,
      })
      .eq("id", settings.id);
    await notify(sb, context.userId, `شهادة SSL: ${domain}`, `تم طلب ${data.mode === "letsencrypt" ? "إصدار Let's Encrypt" : "تركيب شهادة يدوية"}`);
    return cmd;
  });

/** فتح/إغلاق منفذ عبر الجدار الناري مع إشعار في لوحة السيرفر. */
export const applyFirewallRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      serverId: string;
      port: number;
      action: "allow" | "deny" | "delete";
      protocol?: string;
      sourceCidr?: string;
      domain?: string | null;
      reason?: string | null;
      dryRun?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rule, error } = await sb
      .from("firewall_rules")
      .insert({
        owner_id: context.userId,
        server_id: data.serverId,
        port: data.port,
        action: data.action,
        protocol: data.protocol ?? "tcp",
        source_cidr: data.sourceCidr ?? "any",
        domain: data.domain ?? null,
        reason: data.reason ?? null,
        requested_by: context.userId,
        status: data.dryRun ? "dry_run" : "pending",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const cmd = await enqueue(
      sb,
      context.userId,
      data.serverId,
      "firewall_apply",
      { action: data.action, port: data.port, protocol: data.protocol ?? "tcp", source: data.sourceCidr ?? "any" },
      data.dryRun ?? false,
    );
    await sb.from("server_events").insert({
      owner_id: context.userId,
      server_id: data.serverId,
      kind: "firewall",
      severity: data.action === "deny" ? "warning" : "info",
      message: `${data.action === "allow" ? "فتح" : data.action === "deny" ? "إغلاق" : "حذف قاعدة"} المنفذ ${data.port}/${data.protocol ?? "tcp"}${data.domain ? ` للنطاق ${data.domain}` : ""}`,
    }).then(() => null, () => null);
    await notify(
      sb,
      context.userId,
      `جدار ناري: المنفذ ${data.port}`,
      `${data.action} على ${data.protocol ?? "tcp"} من ${data.sourceCidr ?? "any"}`,
      data.action === "deny" ? "warning" : "info",
    );
    return { rule, command: cmd };
  });

/** حذف قاعدة جدار ناري من السجل. */
export const deleteFirewallRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("firewall_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** قائمة كل النطاقات التي لها إعدادات. */
export const listDomainSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data } = await sb
      .from("domain_settings")
      .select("id, domain, status, ssl_mode, ssl_expires_at, server_id, last_applied_at")
      .order("domain");
    return data ?? [];
  });
