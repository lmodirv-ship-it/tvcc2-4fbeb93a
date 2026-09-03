import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { PermissionKey } from "@/lib/permissions";

/**
 * يخفي أو يعطل واجهة لا يملك المستخدم صلاحيتها.
 * الحماية النهائية تبقى في سياسات قاعدة البيانات.
 */
export function RoleGate({
  permission,
  children,
  fallback,
  showMessage = false,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
  showMessage?: boolean;
}) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (can(permission)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  if (!showMessage) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <ShieldAlert className="w-4 h-4 text-warning" />
      لا تملك صلاحية الوصول إلى هذا القسم — تواصل مع مدير المنصة.
    </div>
  );
}
