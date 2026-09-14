/** فحص الأدوار مباشرة من جدول user_roles (دالة has_role لم تعد متاحة عبر RPC العام). */
export async function hasAnyRole(
  supabase: any,
  userId: string,
  roles: string[],
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", roles)
    .limit(1);
  return Boolean(data && data.length > 0);
}

export async function isAdminOrOwner(supabase: any, userId: string): Promise<boolean> {
  return hasAnyRole(supabase, userId, ["admin", "system_owner"]);
}
