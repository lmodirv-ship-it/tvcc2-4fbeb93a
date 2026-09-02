import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac } from "crypto";

const syncSchema = z.object({
  attachToTvcc: z.boolean().default(true),
  pushToHnHub: z.boolean().default(true),
});

const TVCC_DOMAIN = "tvcc.hnpay.live";
const HN_HUB_URL = "https://cour.hnapps.store/api/public/hn-service/ingest";

export const syncLovableProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => syncSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const owner = context.userId;

    const { data: rows, error } = await sb
      .from("lovable_sites")
      .select("*, workspace:lovable_workspaces(*)")
      .is("imported_website_id", null)
      .limit(1000);
    if (error) throw new Error(error.message);

    const sites = (rows ?? []) as any[];
    const importedIds: string[] = [];
    const errors: string[] = [];
    const workspaceGroupMap = new Map<string, string>();

    for (const site of sites) {
      try {
        const workspace = site.workspace;
        const domain = String(site.domain ?? "").trim().toLowerCase();
        if (!domain) {
          errors.push(`تخطّي ${site.name ?? site.id}: نطاق فارغ`);
          continue;
        }

        // تحديد ما إذا كان النطاق مكرراً/remix
        const { data: existing } = await sb
          .from("websites")
          .select("id, site_code, domain")
          .eq("domain", domain)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const isRemix = Boolean(existing);
        const remixOf = existing?.site_code ?? existing?.domain ?? null;

        const { data: created, error: insertErr } = await sb
          .from("websites")
          .insert({
            owner_id: owner,
            name: site.name || domain,
            domain,
            is_active: true,
            status: "online",
            owner_email: site.owner_email ?? workspace?.owner_email ?? null,
            workspace_name: workspace?.name ?? null,
            lovable_workspace_id: workspace?.id ?? null,
            is_remix: isRemix,
            remix_of: remixOf,
          })
          .select("id, site_code")
          .single();
        if (insertErr) {
          errors.push(`${domain}: ${insertErr.message}`);
          continue;
        }

        importedIds.push(created.id);

        // ربط الموقع بمجموعة مساحة العمل
        if (workspace) {
          let groupId = workspaceGroupMap.get(workspace.id);
          if (!groupId) {
            const groupName = `Lovable — ${workspace.name}`;
            const { data: g } = await sb
              .from("site_groups")
              .select("id")
              .eq("owner_id", owner)
              .eq("name", groupName)
              .maybeSingle();
            if (g) {
              groupId = g.id;
            } else {
              const { data: g2, error: gErr } = await sb
                .from("site_groups")
                .insert({
                  owner_id: owner,
                  name: groupName,
                  description: `مساحة عمل Lovable: ${workspace.name}`,
                  color: "#3b82f6",
                  icon: "FolderHeart",
                })
                .select("id")
                .single();
              if (gErr) throw gErr;
              groupId = g2.id;
            }
            workspaceGroupMap.set(String(workspace.id), groupId!);
          }
          await sb.from("website_group_members").upsert(
            { owner_id: owner, group_id: groupId, website_id: created.id },
            { onConflict: "group_id,website_id" },
          );
        }

        await sb
          .from("lovable_sites")
          .update({ imported_website_id: created.id, sync_status: "synced" })
          .eq("id", site.id);
      } catch (e: any) {
        errors.push(`${site.domain ?? site.id}: ${e?.message ?? "خطأ غير معروف"}`);
      }
    }

    // تحديث وقت المزامنة لكل مساحة عمل
    const workspaceIds = [...new Set(sites.map((s) => s.workspace?.id).filter(Boolean))];
    if (workspaceIds.length) {
      await sb
        .from("lovable_workspaces")
        .update({ last_sync_at: new Date().toISOString(), sync_status: "synced" })
        .in("id", workspaceIds);
    }

    // ربط المواقع المستوردة بـ TVCC
    let tvccResult: { linked: number; skipped: number; serviceId?: string } = { linked: 0, skipped: 0 };
    if (data.attachToTvcc && importedIds.length > 0) {
      tvccResult = await linkImportedSitesToTvcc(sb, owner, importedIds);
    }

    // إرسال الكتالوج إلى HN Service Hub
    let hubResult: { ok: boolean; message?: string } = { ok: false };
    if (data.pushToHnHub) {
      hubResult = await pushCatalogToHnHub(sb, owner);
    }

    await sb.from("activity_log").insert({
      user_id: owner,
      action: "lovable.sync_projects",
      details: {
        total: sites.length,
        imported: importedIds.length,
        errors: errors.slice(0, 10),
        tvcc: tvccResult,
        hub: hubResult,
      },
    });

    return {
      ok: errors.length === 0 || importedIds.length > 0,
      total: sites.length,
      imported: importedIds.length,
      errors: errors.slice(0, 10),
      tvcc: tvccResult,
      hub: hubResult,
    };
  });

async function linkImportedSitesToTvcc(sb: any, owner: string, importedIds: string[]) {
  let { data: provider } = await sb
    .from("websites")
    .select("id, domain")
    .eq("domain", TVCC_DOMAIN)
    .maybeSingle();

  if (!provider) {
    const { data: created, error } = await sb
      .from("websites")
      .insert({ owner_id: owner, name: "TVCC", domain: TVCC_DOMAIN, is_active: true, status: "online" })
      .select("id, domain")
      .single();
    if (error) return { linked: 0, skipped: 0, error: error.message };
    provider = created;
  }

  let { data: service } = await sb
    .from("site_services")
    .select("id")
    .eq("website_id", provider.id)
    .eq("service_type", "api")
    .eq("name", "TVCC")
    .maybeSingle();

  if (!service) {
    const { data: created, error } = await sb
      .from("site_services")
      .insert({
        owner_id: owner,
        website_id: provider.id,
        name: "TVCC",
        service_type: "api",
        endpoint_url: `https://${TVCC_DOMAIN}`,
        description: "المنصة الأساسية — سجل المواقع والخدمات",
        link_method: "api",
        auth_type: "token",
        health_path: "/api/public/publish/status",
        is_public: true,
        status: "active",
      })
      .select("id")
      .single();
    if (error) return { linked: 0, skipped: 0, error: error.message };
    service = created;
  }

  const { data: existing } = await sb
    .from("service_dependencies")
    .select("consumer_website_id")
    .eq("service_id", service.id);
  const have = new Set((existing ?? []).map((r: any) => r.consumer_website_id));

  const rows = importedIds
    .filter((id) => id !== provider.id && !have.has(id))
    .map((id) => ({
      owner_id: owner,
      service_id: service.id,
      provider_website_id: provider.id,
      consumer_website_id: id,
      link_method: "api",
      status: "active",
      env_prefix: "TVCC",
    }));

  let linked = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb.from("service_dependencies").insert(chunk);
    if (!error) linked += chunk.length;
  }

  return { linked, skipped: have.size, serviceId: service.id };
}

async function pushCatalogToHnHub(sb: any, owner: string) {
  const secret = process.env["HN_HUB_VERIFICATION_SALT"];
  if (!secret) {
    return { ok: false, message: "لم يُضبط HN_HUB_VERIFICATION_SALT" };
  }

  const { data: sites } = await sb
    .from("websites")
    .select("id, name, domain, site_code, status, is_active, owner_email, workspace_name")
    .eq("is_active", true)
    .limit(2000);

  const { data: services } = await sb
    .from("site_services")
    .select("id, name, service_type, endpoint_url, website_id, status")
    .eq("status", "active")
    .limit(2000);

  const payload = {
    source: "tvcc",
    origin: `https://${TVCC_DOMAIN}`,
    sites: sites ?? [],
    services: services ?? [],
    exported_at: new Date().toISOString(),
  };

  const raw = JSON.stringify(payload);
  const signature = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(HN_HUB_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hn-signature": signature,
      },
      body: raw,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, message: "تم إرسال الكتالوج إلى HN Service Hub" };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "تعذّر الإرسال" };
  }
}

export const listLovableWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("lovable_workspaces")
      .select("id, name, external_id, owner_email, sync_status, last_sync_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listLovableSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("lovable_sites")
      .select("*, workspace:lovable_workspaces(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
