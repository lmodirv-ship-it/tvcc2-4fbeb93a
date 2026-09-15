import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** تصنيف المجموعة ← نوع الخدمة الافتراضي الذي يقدّمه الموقع */
const CATEGORY_SERVICE: Record<string, { type: string; label: string }> = {
  payments: { type: "payments", label: "بوابة مدفوعات" },
  infra: { type: "core", label: "بنية تحتية" },
  ai: { type: "ai", label: "خدمة ذكاء اصطناعي" },
  media: { type: "video", label: "بث ووسائط" },
  dev: { type: "builder", label: "أدوات تطوير" },
  commerce: { type: "ecommerce", label: "متجر وخدمات بيع" },
  delivery: { type: "automation", label: "توصيل وتتبّع" },
  realestate: { type: "realestate", label: "خدمة عقارية" },
  business: { type: "docs", label: "خدمة أعمال" },
};

const DEFAULT_SERVICE = { type: "utility", label: "خدمة عامة" };

/** الخدمات الأساسية التي تُربط تلقائياً بكل مواقع المجموعة */
const CORE_TYPES = ["payments", "database", "storage", "ai", "security", "core", "api"];

async function safe<T>(p: any): Promise<T[]> {
  try {
    const r = await p;
    return (r?.data ?? []) as T[];
  } catch {
    return [];
  }
}

export type ServiceMatrixRow = {
  id: string;
  site_code: string | null;
  name: string;
  domain: string;
  status: string | null;
  is_active: boolean | null;
  group: string | null;
  group_key: string | null;
  services: { id: string; name: string; service_type: string; status: string; endpoint_url: string | null }[];
  consumers: number;
  consumes: number;
};

/** جدول الخدمات المتبادلة: كل موقع، مجموعته، الخدمة التي يقدّمها، ومن يستفيد منها. */
export const getServiceMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [websites, services, deps, groups, members] = await Promise.all([
      safe<any>(sb.from("websites").select("id,name,domain,site_code,status,is_active").order("site_code")),
      safe<any>(sb.from("site_services").select("id,website_id,name,service_type,status,endpoint_url,is_public")),
      safe<any>(sb.from("service_dependencies").select("id,consumer_website_id,provider_website_id,service_id,status")),
      safe<any>(sb.from("site_groups").select("id,name,group_kind,group_key")),
      safe<any>(sb.from("website_group_members").select("group_id,website_id")),
    ]);

    const catGroups = new Map(groups.filter((g) => g.group_kind === "category").map((g) => [g.id, g]));
    const groupBySite = new Map<string, any>();
    for (const m of members) {
      const g = catGroups.get(m.group_id);
      if (g && !groupBySite.has(m.website_id)) groupBySite.set(m.website_id, g);
    }

    const svcBySite = new Map<string, any[]>();
    for (const s of services) {
      const list = svcBySite.get(s.website_id) ?? [];
      list.push(s);
      svcBySite.set(s.website_id, list);
    }

    const consumersByProvider = new Map<string, number>();
    const consumesBySite = new Map<string, number>();
    for (const d of deps) {
      consumersByProvider.set(d.provider_website_id, (consumersByProvider.get(d.provider_website_id) ?? 0) + 1);
      consumesBySite.set(d.consumer_website_id, (consumesBySite.get(d.consumer_website_id) ?? 0) + 1);
    }

    const rows: ServiceMatrixRow[] = websites.map((w) => {
      const g = groupBySite.get(w.id) ?? null;
      return {
        id: w.id,
        site_code: w.site_code ?? null,
        name: w.name ?? "—",
        domain: w.domain ?? "—",
        status: w.status ?? null,
        is_active: w.is_active ?? null,
        group: g?.name ?? null,
        group_key: g?.group_key ?? null,
        services: (svcBySite.get(w.id) ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          service_type: s.service_type,
          status: s.status,
          endpoint_url: s.endpoint_url ?? null,
        })),
        consumers: consumersByProvider.get(w.id) ?? 0,
        consumes: consumesBySite.get(w.id) ?? 0,
      };
    });

    return {
      rows,
      totals: {
        sites: rows.length,
        providers: rows.filter((r) => r.services.length > 0).length,
        missing: rows.filter((r) => r.services.length === 0).length,
        services: services.length,
        deps: deps.length,
      },
    };
  });

/**
 * نشر نظام الخدمات: يضمن خدمة واحدة على الأقل لكل موقع (حسب تصنيف مجموعته)،
 * ثم يربط كل المواقع بالخدمات الأساسية. إضافة فقط — لا حذف ولا تعديل لما هو موجود.
 */
export const publishServiceMesh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const owner = context.userId;

    const [websites, services, groups, members] = await Promise.all([
      safe<any>(sb.from("websites").select("id,name,domain,site_code")),
      safe<any>(sb.from("site_services").select("id,website_id,name,service_type,is_public")),
      safe<any>(sb.from("site_groups").select("id,name,group_kind,group_key")),
      safe<any>(sb.from("website_group_members").select("group_id,website_id")),
    ]);

    const catGroups = new Map(groups.filter((g) => g.group_kind === "category").map((g) => [g.id, g]));
    const groupBySite = new Map<string, any>();
    for (const m of members) {
      const g = catGroups.get(m.group_id);
      if (g && !groupBySite.has(m.website_id)) groupBySite.set(m.website_id, g);
    }

    const hasService = new Set(services.map((s) => s.website_id));
    const toInsert = websites
      .filter((w) => !hasService.has(w.id))
      .map((w) => {
        const key = groupBySite.get(w.id)?.group_key ?? "";
        const def = CATEGORY_SERVICE[key] ?? DEFAULT_SERVICE;
        return {
          owner_id: owner,
          website_id: w.id,
          service_type: def.type,
          name: `${def.label} — ${w.name ?? w.domain}`,
          description: `خدمة ${def.label} يقدّمها ${w.domain} لباقي مواقع مجموعة HN`,
          endpoint_url: w.domain ? `https://${w.domain}` : null,
          status: "active",
          is_public: true,
        };
      });

    let created = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error, data } = await sb
        .from("site_services")
        .upsert(chunk, { onConflict: "website_id,service_type,name", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      created += (data ?? []).length;
    }

    // ربط كل المواقع بالخدمات الأساسية
    const allServices = await safe<any>(
      sb.from("site_services").select("id,website_id,service_type,is_public,status"),
    );
    const coreServices = allServices.filter(
      (s) => CORE_TYPES.includes(String(s.service_type)) && s.status !== "disabled",
    );

    const links: any[] = [];
    for (const s of coreServices) {
      for (const w of websites) {
        if (w.id === s.website_id) continue;
        links.push({
          owner_id: owner,
          consumer_website_id: w.id,
          provider_website_id: s.website_id,
          service_id: s.id,
          status: "active",
          notes: "auto: service mesh",
        });
      }
    }

    let linked = 0;
    for (let i = 0; i < links.length; i += 500) {
      const chunk = links.slice(i, i + 500);
      const { error, data } = await sb
        .from("service_dependencies")
        .upsert(chunk, { onConflict: "consumer_website_id,service_id", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      linked += (data ?? []).length;
    }

    return { created, linked, coreServices: coreServices.length, sites: websites.length };
  });
