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
      .select("host, name")
      .eq("owner_id", userId);
    const existingDbKeys = new Set(
      (existingDbs ?? []).map((r) => `${r.name}|${r.host ?? ""}`),
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
          db_type: "supabase",
          host: p.database?.host ?? `db.${p.id}.supabase.co`,
          status: p.status === "ACTIVE_HEALTHY" ? "online" : "warning",
        });
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
/** Bulk import of pasted site list: "Name | domain" or plain domain per line. */
export const bulkImportWebsites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { raw: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const parsed: { name: string; domain: string }[] = [];
    const seen = new Set<string>();
    for (const line of String(data.raw || "").split(/[\r\n,]+/)) {
      const t = line.trim();
      if (!t) continue;
      const [a, b] = t.includes("|") ? t.split("|") : [null, t];
      let domain = (b ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
      if (!domain || !domain.includes(".")) continue;
      if (seen.has(domain)) continue;
      seen.add(domain);
      const name = (a ?? "").trim() || domain.split(".")[0]!.replace(/[-_]/g, " ");
      parsed.push({ name: name.slice(0, 120), domain });
    }

    if (!parsed.length) return { ok: false, error: "لم يتم العثور على نطاقات صالحة", imported: 0, skipped: 0, total: 0, codes: [] as string[] };

    const { data: existing } = await supabase.from("websites").select("domain");
    const have = new Set((existing ?? []).map((r) => r.domain));

    const rows = parsed
      .filter((p) => !have.has(p.domain))
      .map((p) => ({
        owner_id: userId,
        name: p.name,
        domain: p.domain,
        is_active: true,
        status: "pending" as never,
        description: `مستورد من قائمة لوفابل — ${new Date().toISOString().slice(0, 10)}`,
      }));

    const codes: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data: ins, error } = await supabase.from("websites").insert(chunk).select("site_code, domain");
      if (error) errors.push(error.message);
      else for (const r of ins ?? []) codes.push(`${(r as any).site_code} — ${(r as any).domain}`);
    }

    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "websites.bulk_import",
      details: { imported: codes.length, skipped: parsed.length - rows.length, total: parsed.length },
    } as never);

    return {
      ok: errors.length === 0,
      total: parsed.length,
      imported: codes.length,
      skipped: parsed.length - rows.length,
      codes,
      errors: errors.slice(0, 5),
    };
  });
