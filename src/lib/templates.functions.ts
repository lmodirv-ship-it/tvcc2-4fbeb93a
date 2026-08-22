import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STARTER_TEMPLATES = [
  {
    name: "قالب متجر إلكتروني",
    description: "إعدادات موحّدة للمتاجر: عملة، شحن، ضريبة، ووسائل الدفع.",
    template_type: "store",
    default_settings: {
      currency: "MAD",
      tax_rate: 20,
      free_shipping_over: 500,
      payment_methods: ["cod", "card"],
      theme: "aurora",
    },
  },
  {
    name: "قالب موقع أعمال",
    description: "هوية موحّدة لمواقع الشركات: تذييل، تواصل، وSEO أساسي.",
    template_type: "business",
    default_settings: {
      footer_text: "© HN Groupe — جميع الحقوق محفوظة",
      contact_email: "contact@hn-groupe.net",
      seo_title_suffix: " | HN Groupe",
      theme: "midnight",
    },
  },
  {
    name: "قالب مدونة",
    description: "إعدادات النشر: عدد المقالات، التعليقات، ونشر تلقائي.",
    template_type: "blog",
    default_settings: {
      posts_per_page: 12,
      comments_enabled: true,
      auto_publish: false,
      theme: "emerald",
    },
  },
];

export const seedStarterTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("site_templates")
      .select("name")
      .eq("owner_id", userId);
    const have = new Set((existing ?? []).map((t: { name: string }) => t.name));
    const rows = STARTER_TEMPLATES.filter((t) => !have.has(t.name)).map((t) => ({
      ...t,
      owner_id: userId,
    }));
    if (!rows.length) return { ok: true, created: 0 };
    const { error } = await supabase.from("site_templates").insert(rows);
    if (error) return { ok: false, created: 0, error: error.message };
    return { ok: true, created: rows.length };
  });

export const applyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { template_id: string; dry_run?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tpl, error: tplErr } = await supabase
      .from("site_templates")
      .select("*")
      .eq("id", data.template_id)
      .maybeSingle();
    if (tplErr || !tpl) return { ok: false, error: "القالب غير موجود", applied: 0 };

    const { data: links } = await supabase
      .from("website_template_links")
      .select("website_id")
      .eq("template_id", data.template_id);
    const websiteIds = (links ?? []).map((l: { website_id: string }) => l.website_id);
    if (!websiteIds.length) return { ok: false, error: "لا توجد مواقع مرتبطة بهذا القالب", applied: 0 };

    const settings = (tpl.default_settings ?? {}) as Record<string, unknown>;
    const keys = Object.keys(settings);

    if (data.dry_run) {
      return {
        ok: true,
        dry_run: true,
        applied: 0,
        preview: { websites: websiteIds.length, keys },
      };
    }

    // Job record for traceability
    const { data: job } = await supabase
      .from("deployment_jobs")
      .insert({
        owner_id: userId,
        title: `تطبيق قالب: ${tpl.name}`,
        scope_type: "template",
        scope_id: tpl.id,
        action_type: "apply_template",
        status: "running",
        target_count: websiteIds.length,
        payload: { template_id: tpl.id, settings },
      })
      .select("id")
      .single();

    const jobId = job?.id as string | undefined;
    if (jobId) {
      await supabase.from("deployment_job_targets").insert(
        websiteIds.map((wid) => ({
          owner_id: userId,
          job_id: jobId,
          website_id: wid,
          status: "pending",
        })),
      );
    }

    let applied = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const wid of websiteIds) {
      const rows = keys.map((key) => ({
        website_id: wid,
        owner_id: userId,
        setting_key: key,
        value: settings[key] as never,
      }));
      let err: string | null = null;
      if (rows.length) {
        const { error } = await supabase
          .from("website_settings")
          .upsert(rows, { onConflict: "website_id,setting_key" });
        err = error?.message ?? null;
      }
      // record template origin on the site itself
      if (!err) {
        await supabase
          .from("website_settings")
          .upsert(
            [{ website_id: wid, owner_id: userId, setting_key: "applied_template", value: { id: tpl.id, name: tpl.name } as never }],
            { onConflict: "website_id,setting_key" },
          );
      }
      if (err) {
        failed += 1;
        if (errors.length < 3) errors.push(err);
      } else {
        applied += 1;
      }
      if (jobId) {
        await supabase
          .from("deployment_job_targets")
          .update({ status: err ? "failed" : "done", error_message: err, processed_at: new Date().toISOString() })
          .eq("job_id", jobId)
          .eq("website_id", wid);
      }
    }

    if (jobId) {
      await supabase
        .from("deployment_jobs")
        .update({
          status: failed && !applied ? "failed" : "completed",
          success_count: applied,
          error_count: failed,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    await supabase.from("activity_log").insert({
      owner_id: userId,
      action: "apply_template",
      entity_type: "site_template",
      entity_id: tpl.id,
      details: { applied, failed, keys },
    });

    return { ok: applied > 0, applied, failed, keys: keys.length, job_id: jobId ?? null, errors };
  });
