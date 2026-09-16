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

    const [
      websites,
      servers,
      agents,
      siteAgents,
      schedules,
      sources,
      syncTables,
      batches,
      services,
      deps,
      checks,
      groupMembers,
      groups,
      keys,
    ] = await Promise.all([
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
        safe<any>(
          sb
            .from("site_health_checks")
            .select("website_id,status,http_status,response_time_ms,ssl_valid,checked_at")
            .order("checked_at", { ascending: false })
            .limit(1000),
        ),
        safe<any>(sb.from("website_group_members").select("website_id,group_id")),
        safe<any>(sb.from("site_groups").select("id,name")),
        safe<any>(sb.from("monitoring_keys").select("website_id,server_id,key_type,fingerprint,version,rotated_at")),
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
      sites: (() => {
        const serverById = new Map(servers.map((s) => [s.id, s]));
        const groupName = new Map(groups.map((g) => [g.id, g.name]));
        const groupBySite = new Map<string, string>();
        for (const m of groupMembers) {
          if (!groupBySite.has(m.website_id)) groupBySite.set(m.website_id, groupName.get(m.group_id) ?? "");
        }
        const checkBySite = new Map<string, any>();
        for (const c of checks) if (!checkBySite.has(c.website_id)) checkBySite.set(c.website_id, c);
        const svcBySite = new Map<string, any[]>();
        for (const s of services) svcBySite.set(s.website_id, [...(svcBySite.get(s.website_id) ?? []), s]);
        const schedBySite = new Map<string, any[]>();
        for (const s of schedules) {
          if (!s.website_id) continue;
          schedBySite.set(s.website_id, [...(schedBySite.get(s.website_id) ?? []), s]);
        }
        const keyBySite = new Map(keys.filter((k) => k.website_id).map((k) => [k.website_id, k]));

        return websites.map((w) => {
          const a = siteAgentByWebsite.get(w.id);
          const srv = w.server_id ? serverById.get(w.server_id) : null;
          const c = checkBySite.get(w.id);
          const svc = svcBySite.get(w.id) ?? [];
          const sch = schedBySite.get(w.id) ?? [];
          const key = keyBySite.get(w.id);
          return {
            id: w.id,
            name: w.name,
            domain: w.domain,
            site_code: w.site_code,
            status: w.status,
            server_id: w.server_id,
            server_name: srv?.name ?? srv?.hostname ?? null,
            server_online: srv ? srv.status === "online" || fresh(srv.last_seen_at) : false,
            server_last_seen: srv?.last_seen_at ?? null,
            group: groupBySite.get(w.id) ?? null,
            services: svc.map((s: any) => s.service_type),
            activeServices: svc.filter((s: any) => s.status === "active").length,
            schedules: sch.length,
            lastScheduleStatus: sch[0]?.last_status ?? null,
            http_status: c?.http_status ?? null,
            response_time_ms: c?.response_time_ms ?? null,
            ssl_valid: c?.ssl_valid ?? null,
            checked_at: c?.checked_at ?? null,
            key_fingerprint: key?.fingerprint ? `${key.fingerprint.slice(0, 8)}…${key.fingerprint.slice(-6)}` : null,
            key_version: key?.version ?? null,
            program: !!a,
            connected: fresh(a?.last_beacon_at),
            version: a?.version ?? null,
            beacons: a?.beacons ?? 0,
            last_beacon_at: a?.last_beacon_at ?? null,
          };
        });
      })(),

      schedules,
      sources: sources.map((s) => ({ ...s, online: fresh(s.last_beacon_at) })),
      syncTables,
      batches,
    };
  });

import { isAdminOrOwner } from "./roles.server";

async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdminOrOwner(supabase, userId))) throw new Error("هذه العملية متاحة للمالك والمدير فقط");
}

/**
 * تسجيل كيانات وعلاقات المراقبة في جداول قاعدة المنصة + لقطة يومية.
 * إضافة/تحديث فقط — لا حذف لأي صف.
 */
export const registerMonitoringGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase: sb, userId } = context as any;
    await assertAdmin(sb, userId);
    const now = Date.now();
    const fresh = (ts: any) => !!ts && now - Date.parse(ts) < WINDOW;

    const [websites, servers, siteAgents, services, schedules, syncTables] = await Promise.all([
      safe<any>(sb.from("websites").select("id,name,site_code,status,server_id")),
      safe<any>(sb.from("servers").select("id,name,hostname,status,last_seen_at")),
      safe<any>(sb.from("site_agents").select("website_id,last_beacon_at,beacons")),
      safe<any>(sb.from("site_services").select("id,website_id,status")),
      safe<any>(sb.from("engine_schedules").select("id,website_id,server_id,is_active")),
      safe<any>(sb.from("db_sync_tables").select("local_rows,mirror_rows")),
    ]);

    const beacon = new Map(siteAgents.map((a) => [a.website_id, a]));

    const entities = [
      ...websites.map((w) => ({
        owner_id: userId,
        entity_type: "site",
        code: w.site_code,
        label: w.name,
        website_id: w.id,
        server_id: w.server_id ?? null,
        status: fresh(beacon.get(w.id)?.last_beacon_at) ? "online" : (w.status ?? "unknown"),
        last_beacon_at: beacon.get(w.id)?.last_beacon_at ?? null,
      })),
      ...servers.map((s) => ({
        owner_id: userId,
        entity_type: "server",
        code: null,
        label: s.name ?? s.hostname,
        website_id: null,
        server_id: s.id,
        status: s.status === "online" || fresh(s.last_seen_at) ? "online" : "offline",
        last_beacon_at: s.last_seen_at ?? null,
      })),
    ];

    const existingEntities = await safe<any>(sb.from("monitoring_entities").select("id,website_id,server_id"));
    const entSite = new Map(existingEntities.filter((e) => e.website_id).map((e) => [e.website_id, e.id]));
    const entServer = new Map(existingEntities.filter((e) => !e.website_id && e.server_id).map((e) => [e.server_id, e.id]));

    let entitiesSaved = 0;
    const newEntities: any[] = [];
    for (const e of entities) {
      const id = e.website_id ? entSite.get(e.website_id) : entServer.get(e.server_id as string);
      if (id) {
        const { status, last_beacon_at, label, code, server_id } = e;
        await sb.from("monitoring_entities").update({ status, last_beacon_at, label, code, server_id }).eq("id", id);
        entitiesSaved += 1;
      } else {
        newEntities.push(e);
      }
    }
    for (let i = 0; i < newEntities.length; i += 200) {
      const { data, error } = await sb.from("monitoring_entities").insert(newEntities.slice(i, i + 200)).select("id");
      if (!error) entitiesSaved += (data ?? []).length;
    }


    const links: any[] = [];
    for (const w of websites) {
      if (w.server_id) {
        links.push({ owner_id: userId, website_id: w.id, server_id: w.server_id, role: "hosts", status: "active" });
      }
    }
    for (const s of services) {
      links.push({
        owner_id: userId,
        website_id: s.website_id,
        server_id: null,
        service_id: s.id,
        role: "serves",
        status: s.status ?? "active",
      });
    }
    for (const s of schedules) {
      links.push({
        owner_id: userId,
        website_id: s.website_id ?? null,
        server_id: s.server_id ?? null,
        schedule_id: s.id,
        role: "monitors",
        status: s.is_active ? "active" : "paused",
      });
    }

    let linksSaved = 0;
    const seen = new Set<string>();
    const unique = links.filter((l) => {
      const k = `${l.website_id ?? "-"}|${l.server_id ?? "-"}|${l.role}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const existingLinks = await safe<any>(sb.from("monitoring_links").select("website_id,server_id,role"));
    const known = new Set(existingLinks.map((l) => `${l.website_id ?? "-"}|${l.server_id ?? "-"}|${l.role}`));
    const toInsert = unique.filter((l) => !known.has(`${l.website_id ?? "-"}|${l.server_id ?? "-"}|${l.role}`));
    for (let i = 0; i < toInsert.length; i += 200) {
      const { data, error } = await sb.from("monitoring_links").insert(toInsert.slice(i, i + 200)).select("id");
      if (!error) linksSaved += (data ?? []).length;
    }


    const localRows = syncTables.reduce((s, t) => s + Number(t.local_rows ?? 0), 0);
    const mirrorRows = syncTables.reduce((s, t) => s + Number(t.mirror_rows ?? 0), 0);
    await sb.from("monitoring_metrics_daily").upsert(
      {
        owner_id: userId,
        day: new Date().toISOString().slice(0, 10),
        sites: websites.length,
        active_sites: websites.filter((w) => w.status === "online").length,
        connected_sites: websites.filter((w) => fresh(beacon.get(w.id)?.last_beacon_at)).length,
        online_servers: servers.filter((s) => s.status === "online" || fresh(s.last_seen_at)).length,
        beacons: siteAgents.reduce((s, a) => s + Number(a.beacons ?? 0), 0),
        local_rows: localRows,
        mirror_rows: mirrorRows,
      },
      { onConflict: "owner_id,day" },
    );

    return { entities: entitiesSaved, links: linksSaved };
  });

/** سلاسل زمنية للمخططات. */
export const getMonitoringSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = (context as any).supabase;
    const daily = await safe<any>(
      sb.from("monitoring_metrics_daily").select("*").order("day", { ascending: true }).limit(60),
    );
    const schedules = await safe<any>(sb.from("engine_schedules").select("engine_id,last_status,run_count,is_active"));
    const websites = await safe<any>(sb.from("websites").select("status"));

    const byEngine = new Map<string, { engine: string; runs: number; ok: number; failed: number }>();
    for (const s of schedules) {
      const e = byEngine.get(s.engine_id) ?? { engine: s.engine_id, runs: 0, ok: 0, failed: 0 };
      e.runs += Number(s.run_count ?? 0);
      if (s.last_status === "ok" || s.last_status === "done") e.ok += 1;
      else if (s.last_status) e.failed += 1;
      byEngine.set(s.engine_id, e);
    }

    const statusCounts = new Map<string, number>();
    for (const w of websites) statusCounts.set(w.status ?? "unknown", (statusCounts.get(w.status ?? "unknown") ?? 0) + 1);

    return {
      daily,
      engines: [...byEngine.values()],
      statuses: [...statusCounts.entries()].map(([name, value]) => ({ name, value })),
    };
  });
