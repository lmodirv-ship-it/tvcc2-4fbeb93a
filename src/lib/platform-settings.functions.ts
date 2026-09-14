import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformSettings = {
  id: string;
  support_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  social_links: Record<string, string>;
  default_language: string;
  official_domain: string | null;
  maintenance_mode: boolean;
  dns_records: Record<string, string>;
  notes: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: owner } = await supabase.rpc("has_role", { _user_id: userId, _role: "system_owner" });
  if (!admin && !owner) throw new Error("صلاحيات غير كافية لتعديل إعدادات المنصة");
}

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("platform_settings")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as PlatformSettings | null;
  });

export const savePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<PlatformSettings>) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const payload: Record<string, unknown> = {};
    for (const key of [
      "support_email",
      "phone",
      "whatsapp",
      "address",
      "social_links",
      "default_language",
      "official_domain",
      "maintenance_mode",
      "dns_records",
      "notes",
    ] as const) {
      if (key in data) payload[key] = (data as any)[key];
    }

    const { data: existing } = await (supabase as any).from("platform_settings").select("id").maybeSingle();
    if (existing?.id) {
      const { error } = await (supabase as any).from("platform_settings").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabase as any).from("platform_settings").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const getBrandSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("brand_settings").select("*").maybeSingle();
    return data ?? null;
  });

export const saveBrandSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name?: string; logo_url?: string | null; favicon_url?: string | null; tagline?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: existing } = await (supabase as any).from("brand_settings").select("id").maybeSingle();
    if (existing?.id) {
      const { error } = await (supabase as any).from("brand_settings").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabase as any).from("brand_settings").insert({ name: data.name ?? "TVCC", ...data });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
