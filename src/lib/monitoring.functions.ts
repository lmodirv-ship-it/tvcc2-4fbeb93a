import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function safe<T>(p: any): Promise<T[]> {
  try {
    const r = await p;
    return (r?.data ?? []) as T[];
  } catch {
    return [];
  }
}

const WINDOW = 5 * 60 * 1000;

/** نظرة موحّدة: المواقع، السيرفرات، برامج المواقع، المحرّكات الدائمة، المزامنة، الخدمات. */
export const getMonitoringOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = (context as any).supabase;
    const now = Date.now();

    const [websites, servers, agents, siteAgents, schedules, sources, syncTables, batches, services, deps] =
      await Promise.all([
        safe<any>(sb.from("websites").select("id,name,domain,site_code,status,is_active,server_id")),
        safe<any>(sb.from("servers").select("id,name,hostname,status,last_seen_at,role")),
        safe<any>(sb.from("agent_instances").select("id,server_id,status,last_seen_at,version,agent_role")),
        safe<any>(sb.from("site_agents").select("website_id,status,version,last_beacon_at,beacons")),
        safe<any>(
          sb
            .from("engine_schedules")
            .select(
              "id,engine_id,label,server_id,website_id,interval_minutes,is_active,last_run_at,next_run_at,last_status,run_count",
            )
            .order("next_run_at", { ascending: true })
            .limit(200),
        ),
        safe<any>(sb.from("db_sync_sources").select("id,label,host,port,status,is_active,last_beacon_at,lag_seconds")),
        safe<any>(sb.from("db_sync_tables").select("source_id,table_name,local_rows,mirror_rows,is_enabled,last_sync_at")),
        safe<any>(
          sb
            .from("db_sync_batches")
            .select("id,source_id,table_name,rows_sent,rows_applied,status,created_at")
            .order("created_at", { ascending: false })
            .limit(20),
        ),
        safe<any>(sb.from("site_services").select("id,website_id,service_type,status")),
        safe<any>(sb.from("service_dependencies").select("id,status")),
      ]);

    const fresh = (ts: any) => !!ts && now - Date.parse(ts) < WINDOW;

    const siteAgentByWebsite = new Map(siteAgents.map((a) => [a.website_id, a]));
    const connectedSites = websites.filter((w) => fresh(siteAgentByWebsite.get(w.id)?.last_beacon_at)).length;

    const localRows = syncTables.reduce((s, t) => s + Number(t.local_rows ?? 0), 0);
    const mirrorRows = syncTables.reduce((s, t) => s + Number(t.mirror_rows ?? 0), 0);

    return {
      totals: {
        sites: websites.length,
        activeSites: websites.filter((w) => w.is_active !== false && w.status === "online").length,
        sitesWithProgram: siteAgents.length,
        connectedSites,
        servers: servers.length,
        onlineServers: servers.filter((s) => s.status === "online" || fresh(s.last_seen_at)).length,
        agents: agents.length,
        onlineAgents: agents.filter((a) => fresh(a.last_seen_at)).length,
        schedules: schedules.length,
        activeSchedules: schedules.filter((s) => s.is_active).length,
        sources: sources.length,
        onlineSources: sources.filter((s) => fresh(s.last_beacon_at)).length,
        syncTables: syncTables.length,
        localRows,
        mirrorRows,
        rowGap: localRows - mirrorRows,
        services: services.length,
        deps: deps.length,
      },
      servers: servers.map((s) => ({ ...s, online: s.status === "online" || fresh(s.last_seen_at) })),
      sites: websites.map((w) => {
        const a = siteAgentByWebsite.get(w.id);
        return {
          id: w.id,
          name: w.name,
          domain: w.domain,
          site_code: w.site_code,
          status: w.status,
          server_id: w.server_id,
          program: !!a,
          connected: fresh(a?.last_beacon_at),
          version: a?.version ?? null,
          beacons: a?.beacons ?? 0,
          last_beacon_at: a?.last_beacon_at ?? null,
        };
      }),
      schedules,
      sources: sources.map((s) => ({ ...s, online: fresh(s.last_beacon_at) })),
      syncTables,
      batches,
    };
  });
