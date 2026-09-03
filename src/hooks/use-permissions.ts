import { useMemo } from "react";
import { useRoles } from "@/hooks/use-roles";
import {
  permissionsForRoles,
  ROLE_LABELS,
  type AppRole,
  type PermissionKey,
} from "@/lib/permissions";

/** الصلاحيات الفعلية للمستخدم الحالي مشتقة من أدواره في قاعدة البيانات. */
export function usePermissions() {
  const { roles, isSystemOwner, isAdmin, isEditor, loading, email } = useRoles();

  const effectiveRoles = useMemo<AppRole[]>(() => {
    const list = [...roles] as AppRole[];
    if (isSystemOwner && !list.includes("system_owner")) list.push("system_owner");
    return list.length ? list : ["viewer"];
  }, [roles, isSystemOwner]);

  const granted = useMemo(() => permissionsForRoles(effectiveRoles), [effectiveRoles]);

  const primaryRole: AppRole = isSystemOwner
    ? "system_owner"
    : isAdmin
      ? "admin"
      : isEditor
        ? "editor"
        : "viewer";

  return {
    loading,
    email,
    roles: effectiveRoles,
    primaryRole,
    primaryRoleLabel: ROLE_LABELS[primaryRole],
    granted,
    can: (permission: PermissionKey) => granted.has(permission),
  };
}
