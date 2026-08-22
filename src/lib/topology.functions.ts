import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STALE_MS = 3 * 60 * 1000;

async function safe(promise: any) {
  try {
    const res = await promise;
    return (res?.data ?? []) as Array<Record<string, any>>;
  } catch {
    return [] as Array<Record<string, any>>;
  }
}

/**
 * خريطة العلاقات الموحّدة: سيرفر ↔ موقع ↔ منفذ ↔ قاعدة ↔ تخزين ↔ تحويل
 * قراءة فقط — لا تعدّل أي بيانات موجودة.
 */
export const getTopology = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;

    const [servers, websites, metrics, ports, portLinks, siteDbs, storages, runtimes, redirects, clusterMembers] =
      await Promise.all([
        safe(sb.from("servers").select("*").order("created_at", { ascending: false })),
        safe(sb.from("websites").select("id, name, domain, status, is_active, server_id")),
        safe(
          sb
            .from("server_metrics")
            .select("server_id, cpu_usage, memory_usage, disk_usage, collected_at")
            .order("collected_at", { ascending: false })
            .limit(400),
        ),
        safe(sb.from("server_ports").select("*")),
        safe(sb.from("port_links").select("*")),
        safe(sb.from("site_databases").select("*")),
        safe(sb.from("storages").select("*")),
        safe(sb.from("site_runtimes").select("*")),
        safe(sb.from("domain_redirects").select("*")),
        safe(sb.from("site_cluster_members").select("*")),
      ]);

    const latestMetric: Record<string, any> = {};
    for (const m of metrics) if (!latestMetric[m.server_id]) latestMetric[m.server_id] = m;

    const now = Date.now();
    const nodes = servers.map((s) => {
      const lastSeen = s.last_seen_at ? new Date(s.last_seen_at).getTime() : 0;
      const ageMs = lastSeen ? now - lastSeen : null;
      const stale = !lastSeen || now - lastSeen > STALE_MS;
      const sites = websites.filter((w) => w.server_id === s.id);
      return {
        id: s.id,
        name: s.name ?? s.hostname ?? "server",
        hostname: s.hostname ?? null,
        ip: s.ip_address ?? s.public_ip ?? null,
        provider: s.provider ?? null,
        status: stale && s.status !== "pending" ? "offline" : (s.status ?? "unknown"),
        agent_version: s.agent_version ?? null,
        last_seen_at: s.last_seen_at ?? null,
        heartbeat_age_ms: ageMs,
        agent_healthy: !stale,
        metrics: latestMetric[s.id] ?? null,
        sites: sites.map((w) => ({
          id: w.id,
          name: w.name,
          domain: w.domain,
          status: w.status,
          is_active: w.is_active,
          runtime: runtimes.find((r) => r.website_id === w.id) ?? null,
          databases: siteDbs.filter((d) => d.website_id === w.id).length,
          storages: storages.filter((st) => st.website_id === w.id).length,
        })),
        ports: ports.filter((p) => p.server_id === s.id),
      };
    });

    const orphanSites = websites.filter((w) => !w.server_id);

    return {
      nodes,
      orphanSites: orphanSites.map((w) => ({ id: w.id, name: w.name, domain: w.domain, status: w.status })),
      links: {
        portLinks,
        redirects,
        clusterMembers,
      },
      totals: {
        servers: servers.length,
        websites: websites.length,
        attachedSites: websites.length - orphanSites.length,
        orphanSites: orphanSites.length,
        ports: ports.length,
        portLinks: portLinks.length,
        databases: siteDbs.length,
        storages: storages.length,
        runtimes: runtimes.length,
        redirects: redirects.length,
        healthyAgents: nodes.filter((n) => n.agent_healthy).length,
      },
    };
  });
