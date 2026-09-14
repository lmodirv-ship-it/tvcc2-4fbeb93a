import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** لائحة المواقع مع الحجم والتفاعل ومهام التصدير/الاستيراد. */
export const listSiteTransfers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [{ data: sites }, { data: copies }, { data: tasks }, { data: checks }, { data: links }, { data: agents }, { data: dests }] = await Promise.all([
      sb
        .from("websites")
        .select("id, name, domain, site_code, status, verified, is_active, last_checked_at, updated_at")
        .order("site_code", { ascending: true })
        .limit(1000),
      sb.from("site_backup_copies").select("website_id, copy_kind, size_bytes, status, completed_at").limit(2000),
      sb
        .from("site_transfer_tasks")
        .select("id, website_id, domain, site_code, direction, status, size_bytes, file_path, error_message, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(500),
      sb.from("site_health_checks").select("website_id, checked_at, status").gte("checked_at", since).limit(2000),
      sb.from("server_sites").select("website_id, server_id, status").limit(2000),
      sb.from("agent_instances").select("server_id, status, last_heartbeat_at").limit(500),
      sb.from("backup_destinations").select("id, is_enabled").limit(50),
    ]);

    const okAgentServers = new Set<string>();
    const freshLimit = Date.now() - 10 * 60 * 1000;
    for (const a of (agents ?? []) as any[]) {
      const fresh = a.last_heartbeat_at ? new Date(a.last_heartbeat_at).getTime() > freshLimit : false;
      if (a.status === "online" && fresh) okAgentServers.add(a.server_id);
    }
    const siteHasAgent = new Map<string, boolean>();
    for (const l of (links ?? []) as any[]) {
      if (!l.website_id) continue;
      if (okAgentServers.has(l.server_id)) siteHasAgent.set(l.website_id, true);
      else if (!siteHasAgent.has(l.website_id)) siteHasAgent.set(l.website_id, false);
    }
    const hasDestination = ((dests ?? []) as any[]).some((d) => d.is_enabled);

    const copyBySite = new Map<string, { size: number; first?: string; current?: string; last?: string }>();
    for (const c of (copies ?? []) as any[]) {
      if (!c.website_id) continue;
      const e = copyBySite.get(c.website_id) ?? { size: 0 };
      e.size = Math.max(e.size, Number(c.size_bytes ?? 0));
      if (c.copy_kind === "first") e.first = c.status;
      if (c.copy_kind === "current") e.current = c.status;
      if (c.completed_at && (!e.last || c.completed_at > e.last)) e.last = c.completed_at;
      copyBySite.set(c.website_id, e);
    }

    const checkBySite = new Map<string, { total: number; up: number }>();
    for (const h of (checks ?? []) as any[]) {
      if (!h.website_id) continue;
      const e = checkBySite.get(h.website_id) ?? { total: 0, up: 0 };
      e.total += 1;
      if (h.status === "online" || h.status === "up" || h.status === "success") e.up += 1;
      checkBySite.set(h.website_id, e);
    }

    const taskBySite = new Map<string, any[]>();
    for (const t of (tasks ?? []) as any[]) {
      if (!t.website_id) continue;
      const arr = taskBySite.get(t.website_id) ?? [];
      arr.push(t);
      taskBySite.set(t.website_id, arr);
    }

    const rows = ((sites ?? []) as any[]).map((s) => {
      const c = copyBySite.get(s.id);
      const h = checkBySite.get(s.id);
      const t = taskBySite.get(s.id) ?? [];
      const uptime = h && h.total > 0 ? Math.round((h.up / h.total) * 100) : null;
      return {
        id: s.id,
        site_code: s.site_code ?? "—",
        name: s.name,
        domain: s.domain,
        status: s.status,
        verified: s.verified,
        size_bytes: c?.size ?? 0,
        first_status: c?.first ?? null,
        current_status: c?.current ?? null,
        last_copy_at: c?.last ?? null,
        checks_7d: h?.total ?? 0,
        uptime_7d: uptime,
        last_checked_at: s.last_checked_at,
        tasks_count: t.length,
        last_task: t[0] ?? null,
      };
    });

    return { rows, tasks: tasks ?? [] };
  });

/** إنشاء مهمة تصدير أو استيراد لموقع. */
export const createSiteTransferTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; direction: "export" | "import"; destinationId?: string | null; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: site } = await sb
      .from("websites")
      .select("id, domain, site_code, owner_id")
      .eq("id", data.websiteId)
      .maybeSingle();
    if (!site) throw new Error("الموقع غير موجود");

    const { data: row, error } = await sb
      .from("site_transfer_tasks")
      .insert({
        owner_id: context.userId,
        website_id: site.id,
        destination_id: data.destinationId ?? null,
        domain: site.domain,
        site_code: site.site_code,
        direction: data.direction,
        status: "pending",
        notes: data.notes ?? null,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id };
  });

/** تحديث حالة مهمة. */
export const updateSiteTransferTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; errorMessage?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status, error_message: data.errorMessage ?? null };
    if (data.status === "success" || data.status === "failed") patch["completed_at"] = new Date().toISOString();
    const { error } = await (context.supabase as any)
      .from("site_transfer_tasks")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
