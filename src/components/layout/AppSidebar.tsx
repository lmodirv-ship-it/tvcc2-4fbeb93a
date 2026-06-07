import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Globe, Users, CreditCard, UserCog, Activity, Settings,
  Code2, LogOut, Wand2, FolderOpen, LayoutTemplate, Radio, ListChecks, Plug,
  Smartphone, KeyRound, Server, ShieldCheck, Bell, FileCog, LifeBuoy, ClipboardCheck,
  FileBarChart,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportDashboardHtml } from "@/lib/html-export";

const coreItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Websites", url: "/websites", icon: Globe },
  { title: "Groups", url: "/groups", icon: FolderOpen },
  { title: "Templates", url: "/templates", icon: LayoutTemplate },
  { title: "Editor Center", url: "/editor", icon: Wand2 },
  { title: "Monitoring Center", url: "/monitoring", icon: Radio },
  { title: "Jobs Center", url: "/jobs", icon: ListChecks },
  { title: "Integrations", url: "/integrations", icon: Plug },
];

const opsItems = [
  { title: "Domain Manager", url: "/domains", icon: Server },
  { title: "SSL Monitor", url: "/ssl", icon: ShieldCheck },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Environment Manager", url: "/environment", icon: FileCog },
  { title: "Activity Log", url: "/activity", icon: Activity },
  { title: "Reports", url: "/reports", icon: FileBarChart },
];

const adminItems = [
  { title: "Vault", url: "/vault", icon: KeyRound },
  { title: "Recovery", url: "/recovery", icon: LifeBuoy },
  { title: "APK Manager", url: "/apk-manager", icon: Smartphone },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Users", url: "/users", icon: UserCog },
  { title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
  { title: "System Audit", url: "/audit", icon: ClipboardCheck },
  { title: "Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const handleExport = async () => {
    try {
      await exportDashboardHtml();
      toast.success("تم تصدير HTML بنجاح");
    } catch {
      toast.error("فشل التصدير");
    }
  };

  return (
    <Sidebar collapsible="icon" side="right" className="border-l border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <div
            className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            TVCC
          </div>
          <div className="text-[11px] text-muted-foreground">مركز قيادة المواقع</div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {[
          { label: "الأساسية", items: mainItems },
          { label: "العمليات", items: opsItems },
          { label: "الإدارة", items: adminItems },
        ].map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[10px] text-muted-foreground/70 px-2">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={
                          active
                            ? "bg-primary/15 text-primary border-r-2 border-primary rounded-md"
                            : "hover:bg-sidebar-accent"
                        }
                      >
                        <Link to={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        <button
          onClick={handleExport}
          className="w-full text-right rounded-lg p-3 border border-primary/30 hover:bg-primary/10 transition flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, oklch(0.28 0.06 280 / 0.4), transparent)" }}
        >
          <Code2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">تصدير HTML</span>
        </button>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
