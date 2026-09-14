import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformPage = {
  id: string;
  code: string;
  route_path: string;
  page_key: string;
  section: string;
  icon: string | null;
  name_ar: string;
  name_fr: string | null;
  name_en: string | null;
  description_ar: string | null;
  is_public: boolean;
  enabled: boolean;
  show_in_sidebar: boolean;
  min_role: "system_owner" | "admin" | "editor" | "viewer";
  sort_order: number;
  updated_at: string;
};

export type PlatformPageLink = {
  id: string;
  page_id: string;
  link_type: string;
  target_page_id: string | null;
  target_name: string | null;
  note: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: owner } = await supabase.rpc("has_role", { _user_id: userId, _role: "system_owner" });
  if (!admin && !owner) throw new Error("صلاحيات غير كافية لإدارة الصفحات");
}

export const listPlatformPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data: pages, error } = await supabase
      .from("platform_pages")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: links } = await supabase.from("platform_page_links").select("*");
    return {
      pages: (pages ?? []) as PlatformPage[],
      links: (links ?? []) as PlatformPageLink[],
    };
  });

export const updatePlatformPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<PlatformPage> }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const allowed: (keyof PlatformPage)[] = [
      "section",
      "icon",
      "name_ar",
      "name_fr",
      "name_en",
      "description_ar",
      "enabled",
      "show_in_sidebar",
      "min_role",
      "sort_order",
      "route_path",
    ];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) if (key in data.patch) patch[key] = (data.patch as any)[key];
    const { error } = await (supabase as any).from("platform_pages").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const bulkUpdatePlatformPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; patch: { enabled?: boolean; show_in_sidebar?: boolean; min_role?: string } }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!data.ids.length) return { ok: true as const, count: 0 };
    const { error } = await (supabase as any).from("platform_pages").update(data.patch).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true as const, count: data.ids.length };
  });

export const createPlatformPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { route_path: string; page_key: string; name_ar: string; section?: string; min_role?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).from("platform_pages").insert({
      route_path: data.route_path,
      page_key: data.page_key,
      name_ar: data.name_ar,
      section: data.section || "عام",
      min_role: data.min_role || "viewer",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deletePlatformPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).from("platform_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addPageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page_id: string; link_type: string; target_page_id?: string | null; target_name?: string | null; note?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).from("platform_page_links").insert({
      page_id: data.page_id,
      link_type: data.link_type,
      target_page_id: data.target_page_id ?? null,
      target_name: data.target_name ?? null,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removePageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await (supabase as any).from("platform_page_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
