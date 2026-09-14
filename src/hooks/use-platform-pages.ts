import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export type SidebarPageRule = {
  route_path: string;
  enabled: boolean;
  show_in_sidebar: boolean;
  min_role: AppRole;
  name_ar: string;
};

const ROLE_RANK: Record<AppRole, number> = { viewer: 1, editor: 2, admin: 3, system_owner: 4 };

/** سجل الصفحات — يقرأه الشريط الجانبي والحارس لإخفاء أو منع الصفحات المعطّلة. */
export function usePlatformPageRules() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-page-rules"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_pages")
        .select("route_path, enabled, show_in_sidebar, min_role, name_ar");
      if (error) return [] as SidebarPageRule[];
      return (data ?? []) as SidebarPageRule[];
    },
  });

  const rules = data ?? [];
  const byPath = new Map(rules.map((r) => [r.route_path, r]));

  return {
    loading: isLoading,
    rules,
    ruleFor: (path: string) => byPath.get(path) ?? null,
    /** هل تُعرض الصفحة في القائمة لهذا الدور؟ */
    isVisible: (path: string, role: AppRole) => {
      const rule = byPath.get(path);
      if (!rule) return true;
      if (!rule.enabled || !rule.show_in_sidebar) return false;
      return ROLE_RANK[role] >= ROLE_RANK[rule.min_role];
    },
    /** هل يُسمح بالدخول إلى المسار؟ */
    isAllowed: (path: string, role: AppRole) => {
      const rule = byPath.get(path);
      if (!rule) return true;
      if (!rule.enabled) return false;
      return ROLE_RANK[role] >= ROLE_RANK[rule.min_role];
    },
  };
}

export { ROLE_RANK };
