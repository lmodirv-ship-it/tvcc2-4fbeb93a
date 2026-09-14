/** فحص الأدوار مباشرة من جدول user_roles (دالة has_role لم تعد متاحة عبر RPC العام). */
import { PERMISSIONS, permissionsForRoles, type PermissionKey } from "./permissions";

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

/** كل أدوار المستخدم الحالي (مع ترقية المالك الدائم). */
export async function getUserRoles(supabase: any, userId: string): Promise<string[]> {
  const roles = new Set<string>();
  if (userId) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    for (const r of (data ?? []) as Array<{ role: string }>) roles.add(r.role);
  }
  if (await isPermanentOwner(supabase)) roles.add("system_owner");
  if (!roles.size) roles.add("viewer");
  return [...roles];
}

/** هل يملك المستخدم هذه الصلاحية حسب مصفوفة الأدوار؟ */
export async function userCan(supabase: any, userId: string, permission: PermissionKey): Promise<boolean> {
  const roles = await getUserRoles(supabase, userId);
  return permissionsForRoles(roles).has(permission);
}

/** يرمي خطأ عربياً واضحاً عند نقص الصلاحية. */
export async function assertCan(supabase: any, userId: string, permission: PermissionKey): Promise<void> {
  if (await userCan(supabase, userId, permission)) return;
  const label = PERMISSIONS.find((p) => p.key === permission)?.label ?? permission;
  throw new Error(`صلاحيات غير كافية — هذا الإجراء يتطلب صلاحية «${label}»`);
}

