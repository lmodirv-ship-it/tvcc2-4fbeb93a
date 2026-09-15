/** تنفيذ محركات المنصة من الخلفية (الجدولة الدورية) — إضافة فقط بدون أي حذف. */
import { ENGINES, defaultContext, type EngineContext } from "./engines";
import { COMMAND_WHITELIST } from "./server-commands";

export type ScheduleRow = {
  id: string;
  owner_id: string;
  engine_id: string;
  server_id: string | null;
  website_id: string | null;
  ctx: Partial<EngineContext> | null;
  interval_minutes: number;
  dry_run: boolean;
};

/** يُدرج خطوات المحرّك في طابور أوامر الوكيل ويعيد عددها. */
export async function queueEngineSteps(
  sb: any,
  params: {
    ownerId: string;
    serverId: string;
    websiteId?: string | null;
    engineId: string;
    ctx: Partial<EngineContext>;
    dryRun?: boolean;
  },
): Promise<number> {
  const engine = ENGINES.find((e) => e.id === params.engineId);
  if (!engine) throw new Error("محرّك غير معروف");
  const ctx = defaultContext(params.ctx ?? {});
  const steps = engine
    .steps(ctx)
    .filter((s) => (COMMAND_WHITELIST as readonly string[]).includes(s.action));
  if (!steps.length) return 0;

  const { error } = await sb.from("server_commands").insert(
    steps.map((s) => ({
      owner_id: params.ownerId,
      requested_by: params.ownerId,
      server_id: params.serverId,
      website_id: params.websiteId ?? null,
      action: s.action,
      args: s.args,
      dry_run: params.dryRun ?? false,
      status: "pending",
    })),
  );
  if (error) throw new Error(error.message);
  return steps.length;
}

/** ينفّذ كل الجدولات المستحقّة ويحدّث موعد التشغيل القادم. */
export async function runDueSchedules(sb: any, limit = 50) {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from("engine_schedules")
    .select("id, owner_id, engine_id, server_id, website_id, ctx, interval_minutes, dry_run")
    .eq("is_active", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; queued: number; error?: string }> = [];
  for (const row of (due ?? []) as ScheduleRow[]) {
    const minutes = Math.max(1, row.interval_minutes || 60);
    const next = new Date(Date.now() + minutes * 60_000).toISOString();
    try {
      if (!row.server_id) throw new Error("لا يوجد سيرفر مرتبط بالجدولة");
      const queued = await queueEngineSteps(sb, {
        ownerId: row.owner_id,
        serverId: row.server_id,
        websiteId: row.website_id,
        engineId: row.engine_id,
        ctx: row.ctx ?? {},
        dryRun: row.dry_run,
      });
      await sb
        .from("engine_schedules")
        .update({
          last_run_at: nowIso,
          next_run_at: next,
          last_status: "queued",
          last_error: null,
          run_count: undefined,
        })
        .eq("id", row.id);
      await sb.rpc("noop").catch(() => {});
      results.push({ id: row.id, ok: true, queued });
    } catch (e: any) {
      await sb
        .from("engine_schedules")
        .update({
          last_run_at: nowIso,
          next_run_at: next,
          last_status: "failed",
          last_error: String(e?.message ?? e).slice(0, 500),
        })
        .eq("id", row.id);
      results.push({ id: row.id, ok: false, queued: 0, error: String(e?.message ?? e) });
    }
  }
  return results;
}
