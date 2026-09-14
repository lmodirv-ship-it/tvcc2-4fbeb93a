import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Permanent platform owners — protected in the database, never removable. */
export const PERMANENT_OWNER_EMAILS = [
  "lmodirv@gmail.com",
  "info@hnchat.net",
  "taltnamart@gmail.com",
];

export const PERMANENT_OWNER_EMAIL = PERMANENT_OWNER_EMAILS[0];

export function isPermanentOwnerEmail(email?: string | null) {
  return PERMANENT_OWNER_EMAILS.includes((email || "").toLowerCase());
}

/** علامة جلسة المالك المباشرة (الجلسة الحقيقية محفوظة في كوكي آمن على الخادم). */
export const OWNER_SESSION_KEY = "tvcc-owner-email";

export function getLocalOwnerEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(OWNER_SESSION_KEY) || "";
}

export function useRoles() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        const ownerEmail = getLocalOwnerEmail();
        if (ownerEmail) return { email: ownerEmail, roles: ["system_owner"] };
        return { email: "", roles: [] as string[] };
      }
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return { email: user.email || "", roles: (rows || []).map((r) => r.role as string) };
    },
  });

  const roles = data?.roles || [];
  const email = data?.email || "";
  const isSystemOwner = roles.includes("system_owner") || isPermanentOwnerEmail(email);

  return {
    loading: isLoading,
    email,
    roles,
    isSystemOwner,
    isAdmin: isSystemOwner || roles.includes("admin"),
    isEditor: isSystemOwner || roles.includes("admin") || roles.includes("editor"),
  };
}
