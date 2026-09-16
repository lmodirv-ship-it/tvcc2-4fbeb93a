import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminOrOwner } from "./roles.server";

async function assertAdmin(supabase: any, userId: string) {
  const ok = await isAdminOrOwner(supabase, userId);
  if (!ok) throw new Error("هذه العملية متاحة للمالك والمدير فقط");
}

function platformUrl() {
  return process.env["TVCC_PUBLIC_URL"] || "https://tvcc.hnpay.live";
}

export const listSiteAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const [{ data: websites }, { data: agents }] = await Promise.all([
      supabase.from("websites").select("id,name,domain,site_code,status,is_active,server_id").order("site_code"),
      supabase.from("site_agents").select("*"),
    ]);

    const byWebsite = new Map<string, any>((agents ?? []).map((a: any) => [a.website_id, a]));
    const now = Date.now();

    const rows = (websites ?? []).map((w: any) => {
      const a = byWebsite.get(w.id);
      const last = a?.last_beacon_at ? Date.parse(a.last_beacon_at) : 0;
      return {
        website_id: w.id,
        name: w.name,
        domain: w.domain,
        site_code: w.site_code,
        server_id: w.server_id,
        installed: !!a,
        connected: !!last && now - last < 5 * 60 * 1000,
        version: a?.version ?? null,
        beacons: a?.beacons ?? 0,
        last_beacon_at: a?.last_beacon_at ?? null,
      };
    });

    return {
      rows,
      totals: {
        sites: rows.length,
        installed: rows.filter((r: any) => r.installed).length,
        connected: rows.filter((r: any) => r.connected).length,
      },
    };
  });

/** تسجيل كل المواقع الحالية تلقائياً — إضافة فقط، بدون حذف أو تعديل لما هو مسجّل. */
export const provisionAllSiteAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const secret = process.env["SITE_AGENT_SECRET"];
    if (!secret) throw new Error("مفتاح برامج المواقع غير مهيأ");
    const { deriveSiteKey, hashSiteKey } = await import("./site-agent.server");

    const [{ data: websites }, { data: agents }] = await Promise.all([
      supabase.from("websites").select("id,server_id"),
      supabase.from("site_agents").select("website_id"),
    ]);

    const known = new Set((agents ?? []).map((a: any) => a.website_id));
    const toInsert = (websites ?? [])
      .filter((w: any) => !known.has(w.id))
      .map((w: any) => ({
        owner_id: userId,
        website_id: w.id,
        server_id: w.server_id ?? null,
        key_hash: hashSiteKey(deriveSiteKey(secret, w.id)),
        status: "pending",
        version: null,
      }));

    let created = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { data, error } = await supabase.from("site_agents").insert(chunk).select("id");
      if (error) throw new Error(error.message);
      created += (data ?? []).length;
    }

    return { created, total: (websites ?? []).length };
  });

export const getSiteAgentProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { websiteId: string; kind: "php" | "node" | "badge" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const secret = process.env["SITE_AGENT_SECRET"];
    if (!secret) throw new Error("مفتاح برامج المواقع غير مهيأ");

    const { data: website } = await supabase
      .from("websites")
      .select("id,name,domain,site_code")
      .eq("id", data.websiteId)
      .maybeSingle();
    if (!website) throw new Error("الموقع غير موجود");

    const { deriveSiteKey, hashSiteKey } = await import("./site-agent.server");
    const { buildBadgeSnippet, buildSiteAgentNode, buildSiteAgentPhp } = await import("./site-agent-script.server");

    const siteKey = deriveSiteKey(secret, website.id);
    const siteCode = website.site_code || website.domain;
    const opts = { platformUrl: platformUrl(), siteCode, siteKey };

    // تسجيل الموقع تلقائياً عند أول تحميل للبرنامج (إضافة فقط)
    const { data: existing } = await supabase
      .from("site_agents")
      .select("id")
      .eq("website_id", website.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("site_agents").insert({
        owner_id: userId,
        website_id: website.id,
        key_hash: hashSiteKey(siteKey),
        status: "pending",
      });
    }

    if (data.kind === "php") return { filename: "tvcc-site.php", content: buildSiteAgentPhp(opts) };
    if (data.kind === "node") return { filename: "tvcc-site.js", content: buildSiteAgentNode(opts) };
    return { filename: "tvcc-badge.html", content: buildBadgeSnippet(opts) };
  });
