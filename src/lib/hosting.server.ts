/** Hosting helpers: plan limits, tenant identity, provisioning payloads. */

export type Isolation = "shared" | "schema" | "stack" | "dedicated";

export const GB = 1024 * 1024 * 1024;

export function tenantKey(ownerId: string, planCode: string) {
  const short = ownerId.replace(/-/g, "").slice(0, 12);
  return `t_${planCode}_${short}`;
}

export function schemaNameFor(key: string) {
  return key.replace(/[^a-z0-9_]/g, "_").slice(0, 48);
}

export function bucketNameFor(key: string) {
  return `tenant-${key.replace(/[^a-z0-9]/g, "-").slice(0, 48)}`;
}

export function siteRoot(domain: string) {
  const safe = String(domain || "site").toLowerCase().replace(/[^a-z0-9.-]/g, "");
  return `/var/www/${safe}`;
}

/** Args for the agent `hosting_provision` action. */
export function provisionArgs(opts: {
  domain: string;
  quotaGb: number;
  tenant: string;
  bucket: string;
  isolation: Isolation;
}) {
  return {
    path: siteRoot(opts.domain),
    domain: opts.domain,
    quota_gb: opts.quotaGb,
    tenant: opts.tenant,
    bucket: opts.bucket,
    isolation: opts.isolation,
  };
}

/** Three-copy rule: working, replica, backup. */
export function replicaPlan(servers: Array<{ id: string; role: string }>) {
  const pick = (role: string, skip: string[] = []) =>
    servers.find((s) => s.role === role && !skip.includes(s.id))?.id ?? null;
  const primary = pick("web") ?? servers[0]?.id ?? null;
  const replica = pick("storage", primary ? [primary] : []);
  const backup = pick("backup", [primary, replica].filter(Boolean) as string[]);
  return { primary, replica, backup };
}

export function planIsolation(code: string): Isolation {
  if (code === "business") return "stack";
  if (code === "enterprise") return "dedicated";
  if (code === "pro") return "schema";
  return "shared";
}
