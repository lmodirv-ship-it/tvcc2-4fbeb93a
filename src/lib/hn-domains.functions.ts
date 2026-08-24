import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Private .HN registry: reserve, verify, publish, and route domains. */

async function isAdmin(sb: any, userId: string) {
  const [{ data: a }, { data: o }] = await Promise.all([
    sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
    sb.rpc("has_role", { _user_id: userId, _role: "system_owner" }),
  ]);
  return Boolean(a || o);
}

async function queue(sb: any, ownerId: string, serverId: string, action: string, args: Record<string, unknown>) {
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

export const checkHnDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data, context }) => {
    const { validateName, buildFqdn, buildPublicFqdn } = await import("./hn-domains.server");
    const name = validateName(data.name);
    const fqdn = buildFqdn(name);
    const { data: existing } = await (context.supabase as any)
      .from("hn_domains")
      .select("id")
      .eq("fqdn", fqdn)
      .maybeSingle();
    return { name, fqdn, publicFqdn: buildPublicFqdn(name), available: !existing };
  });

export const reserveHnDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; subscriptionId?: string | null; websiteId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { validateName, buildFqdn, buildPublicFqdn } = await import("./hn-domains.server");
    const name = validateName(data.name);
    const fqdn = buildFqdn(name);

    // enforce the plan's .HN allowance
    if (data.subscriptionId) {
      const { data: sub } = await sb
        .from("hosting_subscriptions")
        .select("owner_id, plan:hosting_plans(hn_domains_limit)")
        .eq("id", data.subscriptionId)
        .maybeSingle();
      if (!sub) throw new Error("الاشتراك غير موجود");
      const { count } = await sb
        .from("hn_domains")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", data.subscriptionId);
      const limit = sub.plan?.hn_domains_limit ?? 1;
      if ((count ?? 0) >= limit) throw new Error(`باقتك تسمح بـ ${limit} نطاق .HN فقط`);
    }

    const { data: row, error } = await sb
      .from("hn_domains")
      .insert({
        owner_id: uid,
        subscription_id: data.subscriptionId ?? null,
        website_id: data.websiteId ?? null,
        name,
        fqdn,
        public_fqdn: buildPublicFqdn(name),
        status: "reserved",
      })
      .select("*")
      .maybeSingle();
    if (error) {
      if (String(error.message).includes("duplicate")) throw new Error("هذا الاسم محجوز مسبقاً");
      throw new Error(error.message);
    }
    return { domain: row };
  });

/** Install/refresh dnsmasq zone + Nginx vhost on the DNS and web servers. */
export const publishHnDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    dnsServerId: string;
    webServerId: string;
    port?: number;
    targetIp?: string | null;
    publicRelease?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { data: dom } = await sb.from("hn_domains").select("*").eq("id", data.id).maybeSingle();
    if (!dom) throw new Error("النطاق غير موجود");
    if (dom.owner_id !== uid && !(await isAdmin(sb, uid))) throw new Error("غير مصرّح");

    const { buildDnsZone, buildHnVhost, isSafeDomain } = await import("./hn-domains.server");
    if (!isSafeDomain(dom.fqdn)) throw new Error("اسم نطاق غير آمن");

    const { data: web } = await sb.from("servers").select("id,hostname,private_ip,public_ip").eq("id", data.webServerId).maybeSingle();
    const ip = data.targetIp || web?.private_ip || web?.public_ip || web?.hostname || "127.0.0.1";
    const port = data.port ?? 80;

    const dnsCmd = await queue(sb, dom.owner_id, data.dnsServerId, "hn_dns_install", {
      domain: dom.fqdn,
      ip,
      zone: buildDnsZone(dom.fqdn, ip),
    });
    const webCmd = await queue(sb, dom.owner_id, data.webServerId, "hn_domain_publish", {
      domain: dom.fqdn,
      public_domain: data.publicRelease ? dom.public_fqdn : "",
      port,
      vhost: buildHnVhost({
        fqdn: dom.fqdn,
        port,
        targetIp: ip,
        publicFqdn: data.publicRelease ? dom.public_fqdn : null,
      }),
    });

    await sb
      .from("hn_domains")
      .update({
        status: data.publicRelease ? "published" : "active",
        dns_server_id: data.dnsServerId,
        web_server_id: data.webServerId,
        target_ip: ip,
        target_port: port,
        is_public: Boolean(data.publicRelease),
        published_at: new Date().toISOString(),
      })
      .eq("id", dom.id);

    return { ok: true, dnsCmd, webCmd };
  });

export const unpublishHnDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { data: dom } = await sb.from("hn_domains").select("*").eq("id", data.id).maybeSingle();
    if (!dom) throw new Error("النطاق غير موجود");
    if (dom.owner_id !== uid && !(await isAdmin(sb, uid))) throw new Error("غير مصرّح");
    if (dom.web_server_id) {
      await queue(sb, dom.owner_id, dom.web_server_id, "hn_domain_remove", { domain: dom.fqdn });
    }
    await sb.from("hn_domains").update({ status: "reserved", is_public: false }).eq("id", dom.id);
    return { ok: true };
  });

export const listHnDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const admin = await isAdmin(sb, context.userId);
    let q = sb.from("hn_domains").select("*").order("created_at", { ascending: false });
    if (!admin) q = q.eq("owner_id", context.userId);
    const [{ data: domains }, { data: servers }, { data: subs }] = await Promise.all([
      q,
      sb.from("servers").select("id,name,hostname,public_ip,private_ip,role,status"),
      sb.from("hosting_subscriptions").select("id, status, plan:hosting_plans(code,name_ar,hn_domains_limit)"),
    ]);
    return { domains: domains ?? [], servers: servers ?? [], subscriptions: subs ?? [], isAdmin: admin };
  });
