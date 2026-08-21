import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PERMANENT_OWNER_EMAIL = "lmodirv@gmail.com";

export function useRoles() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return { email: "", roles: [] as string[] };
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return { email: user.email || "", roles: (rows || []).map((r) => r.role as string) };
    },
  });

  const roles = data?.roles || [];
  const email = data?.email || "";
  const isSystemOwner = roles.includes("system_owner") || email.toLowerCase() === PERMANENT_OWNER_EMAIL;

  return {
    loading: isLoading,
    email,
    roles,
    isSystemOwner,
    isAdmin: isSystemOwner || roles.includes("admin"),
    isEditor: isSystemOwner || roles.includes("admin") || roles.includes("editor"),
  };
}
