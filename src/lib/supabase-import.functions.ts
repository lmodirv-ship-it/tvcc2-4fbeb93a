import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SbProject = {
  id: string;
  name: string;
  region?: string;
  status?: string;
  created_at?: string;
  database?: { host?: string };
};

export const importSupabaseProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = process.env.SB_MGMT_TOKEN;
    if (!token) {
      return { ok: false, error: "SB_MGMT_TOKEN not configured", imported: 0, skipped: 0, total: 0 };
    }

    const res = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `Supabase API ${res.status}: ${await res.text().catch(() => "")}`, imported: 0, skipped: 0, total: 0 };
    }
    const projects = (await res.json()) as SbProject[];

    const { supabase, userId } = context;

    // Existing sites for this user
    const { data: existing } = await supabase
      .from("websites")
      .select("domain, site_id")
      .eq("owner_id", userId);
    const existingDomains = new Set((existing ?? []).map((r) => r.domain));
    const existingSiteIds = new Set((existing ?? []).map((r) => r.site_id).filter(Boolean));

    // Existing databases for this user
    const { data: existingDbs } = await supabase
      .from("databases")
      .select("connection_string, name")
      .eq("owner_id", userId);
    const existingDbKeys = new Set(
      (existingDbs ?? []).map((r) => `${r.name}|${r.connection_string ?? ""}`),
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of projects) {
      const domain = `${p.id}.supabase.co`;
      const alreadySite = existingSiteIds.has(p.id) || existingDomains.has(domain);

      if (!alreadySite) {
        const { error } = await supabase.from("websites").insert({
          owner_id: userId,
          name: p.name || p.id,
          domain,
          site_id: p.id,
          description: `Supabase project (${p.region ?? "?"}) imported ${new Date().toISOString().slice(0, 10)}`,
          is_active: true,
          status: (p.status === "ACTIVE_HEALTHY" ? "online" : "warning") as never,
          api_config_url: `https://${p.id}.supabase.co`,
        });
        if (error) errors.push(`site ${p.id}: ${error.message}`);
        else imported += 1;
      } else {
        skipped += 1;
      }

      const dbKey = `${p.name}|`;
      const dbHostKey = `${p.name}|${p.database?.host ?? ""}`;
      if (!existingDbKeys.has(dbHostKey) && !existingDbKeys.has(dbKey)) {
        const { error: dbErr } = await supabase.from("databases").insert({
          owner_id: userId,
          name: p.name || p.id,
          provider: "supabase",
          connection_string: p.database?.host ?? `db.${p.id}.supabase.co`,
          status: p.status === "ACTIVE_HEALTHY" ? "online" : "warning",
          notes: `Auto-imported from Supabase account (project ref: ${p.id})`,
        } as never);
        if (dbErr) errors.push(`db ${p.id}: ${dbErr.message}`);
      }
    }

    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "supabase.import",
      details: { imported, skipped, total: projects.length, errors: errors.slice(0, 5) },
    } as never);

    return {
      ok: true,
      total: projects.length,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    };
  });