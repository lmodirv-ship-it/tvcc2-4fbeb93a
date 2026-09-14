import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlatformPageRules } from "@/hooks/use-platform-pages";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate({ to: "/auth" });
      else setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <main className="flex-1 p-6">
            <PageGuard>
              <Outlet />
            </PageGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

/** حارس الصفحات: يمنع الأدوار الأدنى أو الصفحات المعطّلة — المالك لا يُمنع أبداً. */
function PageGuard({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { primaryRole } = usePermissions();
  const { loading, isAllowed, ruleFor } = usePlatformPageRules();

  if (loading || primaryRole === "system_owner") return <>{children}</>;
  if (isAllowed(pathname, primaryRole)) return <>{children}</>;

  const rule = ruleFor(pathname);
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-3">
      <span className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <Lock className="w-6 h-6 text-muted-foreground" />
      </span>
      <h2 className="text-xl font-bold">{rule?.enabled === false ? "هذه الصفحة معطّلة حالياً" : "لا تملك صلاحية الوصول"}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {rule?.enabled === false
          ? "تم تعطيل هذه الصفحة من إعدادات المنصة. تواصل مع مدير المنصة لتفعيلها."
          : "هذه الصفحة متاحة لدور أعلى من دورك الحالي."}
      </p>
      <Button asChild variant="outline" size="sm"><Link to="/dashboard">العودة إلى لوحة التحكم</Link></Button>
    </div>
  );
}
