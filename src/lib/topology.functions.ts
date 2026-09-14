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

export type SiteCoverageRow = {
  id: string;
  site_code: string;
  name: string;
  domain: string;
  status: string;
  server: string | null;
  database: string | null;
  agent: boolean;
  ssl: boolean;
  storage: boolean;
  backup: boolean;
  alerts: boolean;
  missing: number;
};

/**
 * تغطية كل موقع: قاعدة ← سيرفر ← وكيل ← نطاق/شهادة ← تخزين ← نسخ ← تنبيهات.
 * قراءة فقط تشمل جميع المواقع دفعةً واحدة.
 */
export const getSiteCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [websites, servers, siteDbs, databases, agents, certs, storages, backups, alerts] = await Promise.all([
      safe(sb.from("websites").select("id,name,domain,site_code,status,server_id").order("site_code")),
      safe(sb.from("servers").select("id,name,status,last_seen_at,agent_version")),
      safe(sb.from("site_databases").select("website_id,database_id,schema_name,provisioning_status")),
      safe(sb.from("databases").select("id,name,db_kind")),
      safe(sb.from("agent_instances").select("server_id,status,last_seen_at")),
      safe(sb.from("ssl_certificates").select("website_id,domain,status,expires_at")),
      safe(sb.from("storages").select("website_id,status")),
      safe(sb.from("site_backups").select("website_id,status,created_at")),
      safe(sb.from("alert_rules").select("website_id,is_active")),
    ]);

    const serverById = new Map(servers.map((s) => [s.id, s]));
    const dbById = new Map(databases.map((d) => [d.id, d]));
    const agentServers = new Set(agents.map((a) => a.server_id));
    const certSites = new Set(certs.filter((c) => c.website_id).map((c) => c.website_id));
    const certDomains = new Set(certs.map((c) => String(c.domain ?? "").toLowerCase()));
    const storageSites = new Set(storages.map((s) => s.website_id));
    const backupSites = new Set(backups.map((b) => b.website_id));
    const alertSites = new Set(alerts.filter((a) => a.is_active !== false).map((a) => a.website_id));

    const rows: SiteCoverageRow[] = websites.map((w) => {
      const link = siteDbs.find((d) => d.website_id === w.id);
      const db = link ? dbById.get(link.database_id) : null;
      const server = w.server_id ? serverById.get(w.server_id) : null;
      const row = {
        id: w.id,
        site_code: w.site_code ?? "—",
        name: w.name ?? "—",
        domain: w.domain ?? "—",
        status: w.status ?? "—",
        server: server?.name ?? null,
        database: db?.name ?? null,
        agent: Boolean(w.server_id && agentServers.has(w.server_id)),
        ssl: certSites.has(w.id) || certDomains.has(String(w.domain ?? "").toLowerCase()),
        storage: storageSites.has(w.id),
        backup: backupSites.has(w.id),
        alerts: alertSites.has(w.id),
        missing: 0,
      };
      row.missing = [row.server, row.database].filter((v) => !v).length
        + [row.agent, row.ssl, row.storage, row.backup, row.alerts].filter((v) => !v).length;
      return row;
    });

    return {
      rows,
      totals: {
        sites: rows.length,
        complete: rows.filter((r) => r.missing === 0).length,
        incomplete: rows.filter((r) => r.missing > 0).length,
        noDatabase: rows.filter((r) => !r.database).length,
        noServer: rows.filter((r) => !r.server).length,
        noBackup: rows.filter((r) => !r.backup).length,
      },
    };
  });
