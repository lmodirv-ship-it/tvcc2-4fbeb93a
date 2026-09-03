import { supabase } from "@/integrations/supabase/client";

/** تفضيلات المستخدم (الثيم/اللغة) محفوظة في الحساب حتى تتبعه على أي جهاز. */
export type UserPreferences = {
  theme_id?: string | null;
  language?: string | null;
  sidebar_collapsed?: boolean | null;
};

export async function loadUserPreferences(): Promise<UserPreferences | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await (supabase as any)
    .from("user_preferences")
    .select("theme_id, language, sidebar_collapsed")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return (data as UserPreferences) ?? null;
}

export async function saveUserPreferences(patch: UserPreferences) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await (supabase as any)
    .from("user_preferences")
    .upsert({ user_id: auth.user.id, ...patch }, { onConflict: "user_id" });
}
