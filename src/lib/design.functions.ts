import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SaveDesignInput = {
  theme_id?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  font_family?: string | null;
  radius?: string | null;
  shadow?: string | null;
};

export const saveDesignIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveDesignInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: owner } = await supabase.rpc("has_role", { _user_id: userId, _role: "system_owner" });
    if (!allowed && !owner) throw new Error("صلاحيات غير كافية لتعديل هوية التصميم");

    const payload = {
      theme_id: data.theme_id ?? null,
      primary_color: data.primary_color ?? null,
      accent_color: data.accent_color ?? null,
      background_color: data.background_color ?? null,
      font_family: data.font_family ?? null,
      radius: data.radius ?? null,
      shadow: data.shadow ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await (supabase as any)
      .from("brand_settings")
      .select("id")
      .maybeSingle();

    if (existing?.id) {
      const { error } = await (supabase as any).from("brand_settings").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabase as any).from("brand_settings").insert({ ...payload, name: "TVCC" });
      if (error) throw new Error(error.message);
    }

    return { ok: true as const };
  });
