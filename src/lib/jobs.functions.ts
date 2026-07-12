import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ActionType = "health_check" | "toggle_active" | "verify_dns" | "broadcast_footer";
type ScopeType = "all" | "group" | "custom";

async function pingOnce(domain: string) {
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const candidates = clean.startsWith("www.")
    ? [`https://${clean}`, `https://${clean.slice(4)}`, `http://${clean}`]
    : [`https://${clean}`, `https://www.${clean}`, `http://${clean}`];
  for (const url of candidates) {
    for (const method of ["HEAD", "GET"] as const) {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 8000);
        const res = await fetch(url, { method, signal: ac.signal, redirect: "follow" });
        clearTimeout(t);
        if (res.status < 400) return { status: "online" as const, code: res.status };
        if (res.status < 500) return { status: "warning" as const, code: res.status };
      } catch { /* try next */ }
    }
  }
  return { status: "offline" as const, code: null };
}

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    title: string;
    action_type: ActionType;
    scope_type: ScopeType;
    scope_id?: string | null;
    website_ids?: string[];
    payload?: Record<string, unknown>;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve target websites
    let websiteIds: string[] = [];
    if (data.scope_type === "custom") {
      websiteIds = data.website_ids ?? [];
    } else if (data.scope_type === "group" && data.scope_id) {
      const { data: members } = await supabase
        .from("website_group_members")
        .select("website_id")
        .eq("group_id", data.scope_id);
      websiteIds = (members ?? []).map((m) => m.website_id);
    } else {
      const { data: sites } = await supabase
        .from("websites")
        .select("id")
        .eq("owner_id", userId)
        .eq("is_active", true);
      websiteIds = (sites ?? []).map((s) => s.id);
    }

    if (!websiteIds.length) return { ok: false, error: "لا توجد مواقع مستهدفة", job_id: null };

    const { data: job, error: jobErr } = await supabase
      .from("deployment_jobs")
      .insert({
        owner_id: userId,
        title: data.title,
        action_type: data.action_type,
        scope_type: data.scope_type,
        scope_id: data.scope_id ?? null,
        status: "queued",
        target_count: websiteIds.length,
        success_count: 0,
        error_count: 0,
        payload: data.payload ?? {},
      })
      .select()
      .single();
    if (jobErr || !job) return { ok: false, error: jobErr?.message ?? "فشل إنشاء المهمة", job_id: null };

    const rows = websiteIds.map((wid) => ({
      owner_id: userId,
      job_id: job.id,
      website_id: wid,
      status: "queued",
    }));
    // insert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from("deployment_job_targets").insert(rows.slice(i, i + 500));
    }
    return { ok: true, job_id: job.id, target_count: websiteIds.length };
  });

export const runJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string; retry_failed?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase
      .from("deployment_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!job) return { ok: false, error: "المهمة غير موجودة" };

    await supabase
      .from("deployment_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);

    const targetQuery = supabase
      .from("deployment_job_targets")
      .select("id, website_id, status, websites(id,domain,is_active)")
      .eq("job_id", job.id);
    const { data: targets } = data.retry_failed
      ? await targetQuery.in("status", ["failed", "queued"])
      : await targetQuery.eq("status", "queued");

    let success = 0;
    let failed = 0;

    // Concurrent batches
    const batchSize = 15;
    for (let i = 0; i < (targets ?? []).length; i += batchSize) {
      const batch = (targets ?? []).slice(i, i + batchSize);
      await Promise.all(batch.map(async (t) => {
        const site = (t as unknown as { websites: { id: string; domain: string; is_active: boolean } | null }).websites;
        if (!site) {
          await supabase.from("deployment_job_targets").update({ status: "failed", error_message: "site missing", processed_at: new Date().toISOString() }).eq("id", t.id);
          failed += 1;
          return;
        }
        try {
          if (job.action_type === "health_check") {
            const r = await pingOnce(site.domain);
            await supabase.from("websites").update({ status: r.status, last_checked_at: new Date().toISOString() }).eq("id", site.id);
            await supabase.from("site_health_checks").insert({
              owner_id: userId, website_id: site.id, status: r.status, http_status: r.code, response_time_ms: null,
            });
          } else if (job.action_type === "toggle_active") {
            const enable = (job.payload as { enable?: boolean } | null)?.enable ?? true;
            await supabase.from("websites").update({ is_active: enable }).eq("id", site.id);
          } else if (job.action_type === "verify_dns") {
            const r = await pingOnce(site.domain);
            await supabase.from("websites").update({ verified: r.status !== "offline", last_checked_at: new Date().toISOString() }).eq("id", site.id);
          } else if (job.action_type === "broadcast_footer") {
            const footer = (job.payload as { html?: string } | null)?.html ?? "";
            const urls = [`https://${site.domain}/api/public/directives/ingest`, `https://${site.domain}/api/public/core.ingest`];
            let delivered = false;
            for (const u of urls) {
              try {
                const ac = new AbortController();
                const to = setTimeout(() => ac.abort(), 6000);
                const res = await fetch(u, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "site.footer.set", html: footer }),
                  signal: ac.signal,
                });
                clearTimeout(to);
                if (res.ok) { delivered = true; break; }
              } catch { /* next */ }
            }
            if (!delivered) throw new Error("delivery failed");
          }
          await supabase.from("deployment_job_targets").update({ status: "completed", processed_at: new Date().toISOString(), error_message: null }).eq("id", t.id);
          success += 1;
        } catch (e) {
          await supabase.from("deployment_job_targets").update({ status: "failed", error_message: e instanceof Error ? e.message : String(e), processed_at: new Date().toISOString() }).eq("id", t.id);
          failed += 1;
        }
      }));
    }

    // Aggregate counts across all targets (not only this run)
    const { count: totalSuccess } = await supabase
      .from("deployment_job_targets")
      .select("*", { count: "exact", head: true })
      .eq("job_id", job.id).eq("status", "completed");
    const { count: totalFailed } = await supabase
      .from("deployment_job_targets")
      .select("*", { count: "exact", head: true })
      .eq("job_id", job.id).eq("status", "failed");
    const { count: totalQueued } = await supabase
      .from("deployment_job_targets")
      .select("*", { count: "exact", head: true })
      .eq("job_id", job.id).eq("status", "queued");

    const finalStatus = (totalQueued ?? 0) > 0 ? "running" : ((totalFailed ?? 0) > 0 ? "failed" : "completed");
    await supabase.from("deployment_jobs").update({
      status: finalStatus,
      success_count: totalSuccess ?? 0,
      error_count: totalFailed ?? 0,
      completed_at: finalStatus === "running" ? null : new Date().toISOString(),
    }).eq("id", job.id);

    await supabase.from("activity_log").insert({
      user_id: userId, action: `job.${job.action_type}`,
      details: { job_id: job.id, success, failed, action: job.action_type },
    });

    return { ok: true, success, failed, status: finalStatus };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase.from("deployment_job_targets").delete().eq("job_id", data.job_id);
    const { error } = await context.supabase.from("deployment_jobs").delete().eq("id", data.job_id).eq("owner_id", context.userId);
    return { ok: !error, error: error?.message };
  });