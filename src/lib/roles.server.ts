/** فحص الأدوار مباشرة من جدول user_roles (دالة has_role لم تعد متاحة عبر RPC العام). */

const PERMANENT_OWNERS = ["lmodirv@gmail.com", "info@hnchat.net", "taltnamart@gmail.com"];

async function isPermanentOwner(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    const email = (data?.user?.email ?? "").toLowerCase();
    return PERMANENT_OWNERS.includes(email);
  } catch {
    return false;
  }
}

export async function hasAnyRole(
  supabase: any,
  userId: string,
  roles: string[],
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", roles)
    .limit(1);
  if (!error && data && data.length > 0) return true;
  return isPermanentOwner(supabase);
}

export async function isAdminOrOwner(supabase: any, userId: string): Promise<boolean> {
  return hasAnyRole(supabase, userId, ["admin", "system_owner"]);
}

export async function isSystemOwner(supabase: any, userId: string): Promise<boolean> {
  return hasAnyRole(supabase, userId, ["system_owner"]);
}
