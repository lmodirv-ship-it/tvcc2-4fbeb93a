import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Hosting: plans, subscriptions, tenants, quotas, server grants, replicas. */

async function isAdmin(sb: any, userId: string) {
  const [{ data: a }, { data: o }] = await Promise.all([
    sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
    sb.rpc("has_role", { _user_id: userId, _role: "system_owner" }),
  ]);
  return Boolean(a || o);
}

async function queue(
  sb: any,
  ownerId: string,
  serverId: string,
  action: string,
  args: Record<string, unknown>,
  websiteId?: string | null,
) {
  const { data, error } = await sb
    .from("server_commands")
    .insert({
      owner_id: ownerId,
      server_id: serverId,
      website_id: websiteId ?? null,
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

/* ------------------------------------------------------------- plans */

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client
    .from("hosting_plans")
    .select(
      "id, code, name, name_ar, price_monthly, price_yearly, storage_gb, sites_limit, hn_domains_limit, external_domains_limit, transfer_gb, db_isolation, db_quota_mb, backup_policy, features, sort_order",
    )
    .eq("is_visible", true)
    .order("sort_order");
  return { plans: data ?? [] };
});

/* ------------------------------------------------- subscriber surface */

export const getMyHosting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { data: subs } = await sb
      .from("hosting_subscriptions")
      .select("*, plan:hosting_plans(*)")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });
    const [{ data: quotas }, { data: grants }, { data: domains }, { data: replicas }, { data: tenants }] =
      await Promise.all([
        sb.from("storage_quotas").select("*").eq("owner_id", uid),
        sb.from("subscription_servers").select("*, server:servers(id,name,host,role,status)").eq("owner_id", uid),
        sb.from("hn_domains").select("*").eq("owner_id", uid).order("created_at", { ascending: false }),
        sb.from("file_replicas").select("*").eq("owner_id", uid).order("updated_at", { ascending: false }).limit(50),
        sb.from("hosting_tenants").select("*").eq("owner_id", uid),
      ]);
    return {
      subscriptions: subs ?? [],
      quotas: quotas ?? [],
      grants: grants ?? [],
      domains: domains ?? [],
      replicas: replicas ?? [],
      tenants: tenants ?? [],
    };
  });

export const subscribeToPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planCode: string; websiteId?: string | null; billingCycle?: "monthly" | "yearly" }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { data: plan, error: pe } = await sb
      .from("hosting_plans")
      .select("*")
      .eq("code", data.planCode)
      .maybeSingle();
    if (pe || !plan) throw new Error("الباقة غير موجودة");

    const { GB, tenantKey, schemaNameFor, bucketNameFor, planIsolation } = await import("./hosting.server");

    const { data: sub, error } = await sb
      .from("hosting_subscriptions")
      .insert({
        owner_id: uid,
        plan_id: plan.id,
        website_id: data.websiteId ?? null,
        status: "pending",
        billing_cycle: data.billingCycle ?? "monthly",
        current_period_end: new Date(Date.now() + (data.billingCycle === "yearly" ? 365 : 30) * 86400000).toISOString(),
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const key = tenantKey(uid, plan.code);
    await sb.from("hosting_tenants").insert({
      owner_id: uid,
      subscription_id: sub.id,
      tenant_key: key,
      isolation: planIsolation(plan.code),
      schema_name: schemaNameFor(key),
      db_role: `${schemaNameFor(key)}_role`,
      bucket_name: bucketNameFor(key),
      status: "pending",
    });
    await sb.from("storage_quotas").insert({
      owner_id: uid,
      subscription_id: sub.id,
      website_id: data.websiteId ?? null,
      limit_bytes: plan.storage_gb * GB,
      transfer_limit_bytes: plan.transfer_gb * GB,
    });
    return { subscription: sub };
  });

/* ----------------------------------------------------- admin surface */

export const adminListHosting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    if (!(await isAdmin(sb, context.userId))) throw new Error("غير مصرّح");
    const [{ data: subs }, { data: plans }, { data: servers }, { data: profiles }, { data: grants }, { data: quotas }, { data: domains }] =
      await Promise.all([
        sb.from("hosting_subscriptions").select("*, plan:hosting_plans(*)").order("created_at", { ascending: false }),
        sb.from("hosting_plans").select("*").order("sort_order"),
        sb.from("servers").select("id,name,hostname,public_ip,private_ip,role,status"),
        sb.from("profiles").select("id,email,full_name"),
        sb.from("subscription_servers").select("*, server:servers(id,name,hostname,role)"),
        sb.from("storage_quotas").select("*"),
        sb.from("hn_domains").select("*").order("created_at", { ascending: false }),
      ]);
    return {
      subscriptions: subs ?? [],
      plans: plans ?? [],
      servers: servers ?? [],
      profiles: profiles ?? [],
      grants: grants ?? [],
      quotas: quotas ?? [],
      domains: domains ?? [],
    };
  });

export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "pending" | "active" | "suspended" | "cancelled" }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!(await isAdmin(sb, context.userId))) throw new Error("غير مصرّح");
    const { error } = await sb.from("hosting_subscriptions").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; planId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!(await isAdmin(sb, context.userId))) throw new Error("غير مصرّح");
    const { data: plan } = await sb.from("hosting_plans").select("*").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("الباقة غير موجودة");
    const { GB } = await import("./hosting.server");
    const { error } = await sb.from("hosting_subscriptions").update({ plan_id: data.planId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb
      .from("storage_quotas")
      .update({ limit_bytes: plan.storage_gb * GB, transfer_limit_bytes: plan.transfer_gb * GB })
      .eq("subscription_id", data.id);
    return { ok: true };
  });

/** Grant a real server to a subscription and provision the space on it. */
export const grantServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    subscriptionId: string;
    serverId: string;
    role?: string;
    cpu?: number;
    ramMb?: number;
    diskGb?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!(await isAdmin(sb, context.userId))) throw new Error("غير مصرّح");

    const { data: sub } = await sb
      .from("hosting_subscriptions")
      .select("*, plan:hosting_plans(*), website:websites(id,domain)")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (!sub) throw new Error("الاشتراك غير موجود");

    const { data: tenant } = await sb
      .from("hosting_tenants")
      .select("*")
      .eq("subscription_id", data.subscriptionId)
      .maybeSingle();

    const { error } = await sb.from("subscription_servers").insert({
      owner_id: sub.owner_id,
      subscription_id: sub.id,
      server_id: data.serverId,
      role: (data.role ?? "web") as any,
      cpu_quota: data.cpu ?? 1,
      ram_quota_mb: data.ramMb ?? 1024,
      disk_quota_gb: data.diskGb ?? sub.plan?.storage_gb ?? 5,
      granted_by: context.userId,
    });
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);

    const { provisionArgs, planIsolation } = await import("./hosting.server");
    const domain = sub.website?.domain ?? `${tenant?.tenant_key ?? "tenant"}.hn`;
    const commandId = await queue(
      sb,
      sub.owner_id,
      data.serverId,
      "hosting_provision",
      provisionArgs({
        domain,
        quotaGb: data.diskGb ?? sub.plan?.storage_gb ?? 5,
        tenant: tenant?.tenant_key ?? "tenant",
        bucket: tenant?.bucket_name ?? "tenant-bucket",
        isolation: planIsolation(sub.plan?.code ?? "starter"),
      }),
      sub.website_id,
    );
    await sb.from("hosting_tenants").update({ status: "provisioning" }).eq("subscription_id", sub.id);
    return { ok: true, commandId };
  });

export const revokeServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!(await isAdmin(sb, context.userId))) throw new Error("غير مصرّح");
    const { error } = await sb.from("subscription_servers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Enforce the storage quota on the granted servers. */
export const setQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subscriptionId: string; storageGb: number; transferGb?: number }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!(await isAdmin(sb, context.userId))) throw new Error("غير مصرّح");
    const { GB, siteRoot } = await import("./hosting.server");
    const { data: sub } = await sb
      .from("hosting_subscriptions")
      .select("*, website:websites(domain)")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (!sub) throw new Error("الاشتراك غير موجود");

    await sb
      .from("storage_quotas")
      .update({
        limit_bytes: data.storageGb * GB,
        ...(data.transferGb ? { transfer_limit_bytes: data.transferGb * GB } : {}),
      })
      .eq("subscription_id", data.subscriptionId);

    const { data: grants } = await sb.from("subscription_servers").select("server_id").eq("subscription_id", sub.id);
    for (const g of grants ?? []) {
      await queue(sb, sub.owner_id, g.server_id, "hosting_quota_set", {
        path: siteRoot(sub.website?.domain ?? "site"),
        quota_gb: data.storageGb,
      });
    }
    return { ok: true };
  });

/** Three-copy replication for one important file. */
export const replicateFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subscriptionId: string; filePath: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { data: sub } = await sb.from("hosting_subscriptions").select("*").eq("id", data.subscriptionId).maybeSingle();
    if (!sub) throw new Error("الاشتراك غير موجود");
    if (sub.owner_id !== uid && !(await isAdmin(sb, uid))) throw new Error("غير مصرّح");

    const { data: grants } = await sb
      .from("subscription_servers")
      .select("server_id, role, server:servers(id,role,host)")
      .eq("subscription_id", sub.id);
    const { replicaPlan } = await import("./hosting.server");
    const pool = (grants ?? []).map((g: any) => ({ id: g.server_id, role: g.server?.role ?? g.role }));
    const plan = replicaPlan(pool);
    if (!plan.primary) throw new Error("لا يوجد خادم ممنوح لهذا الاشتراك");

    const { data: row, error } = await sb
      .from("file_replicas")
      .insert({
        owner_id: sub.owner_id,
        subscription_id: sub.id,
        file_path: data.filePath,
        primary_server_id: plan.primary,
        replica_server_id: plan.replica,
        backup_server_id: plan.backup,
        state: "syncing",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    for (const target of [plan.replica, plan.backup].filter(Boolean) as string[]) {
      await queue(sb, sub.owner_id, plan.primary, "file_replicate", {
        path: data.filePath,
        target_server: target,
        replica_id: row.id,
      });
    }
    return { replica: row };
  });
