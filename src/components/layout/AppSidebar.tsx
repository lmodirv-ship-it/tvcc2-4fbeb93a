import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Globe, Users, CreditCard, UserCog, Activity, Settings,
  Code2, LogOut, Wand2, FolderOpen, LayoutTemplate, Radio, ListChecks, Plug,
  Smartphone, KeyRound, Server, ShieldCheck, BadgeCheck, Bell, FileCog, LifeBuoy, ClipboardCheck,
  FileBarChart, Wallet, Boxes, Brain, Film, HardDrive, MessageSquare, History, NotebookPen, Archive, Network, Share2, ScrollText, ShieldAlert, GitBranch, Zap, Download, Link2, Cloud, Globe2, Fingerprint, Rocket,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportDashboardHtml } from "@/lib/html-export";
import { useTranslation } from "react-i18next";
import tvccLogo from "@/assets/tvcc-logo.asset.json";

const coreItems = [
  { titleKey: "sidebar.dashboard", url: "/dashboard", icon: LayoutDashboard },
  { titleKey: "sidebar.websites", url: "/websites", icon: Globe },
  { titleKey: "sidebar.import_sites", url: "/import-sites", icon: Download },
  { titleKey: "sidebar.groups", url: "/groups", icon: FolderOpen },
  { titleKey: "sidebar.templates", url: "/templates", icon: LayoutTemplate },
  { titleKey: "sidebar.editor", url: "/editor", icon: Wand2 },
  { titleKey: "sidebar.monitoring", url: "/monitoring", icon: Radio },
  { titleKey: "sidebar.jobs", url: "/jobs", icon: ListChecks },
  { titleKey: "sidebar.integrations", url: "/integrations", icon: Plug },
  { titleKey: "sidebar.services", url: "/services", icon: Boxes },
  { titleKey: "sidebar.core_hub", url: "/core-hub", icon: Brain },
  { titleKey: "sidebar.video_studio", url: "/video-studio", icon: Film },
  { titleKey: "sidebar.blog", url: "/blog-manager", icon: NotebookPen },
];

const aiItems = [
  { titleKey: "sidebar.ai_models", url: "/ai-models", icon: Brain },
  { titleKey: "sidebar.ai_connect", url: "/ai-connect", icon: Plug },
  { titleKey: "sidebar.ai_chat", url: "/ai-chat", icon: MessageSquare },
  { titleKey: "sidebar.ai_tests", url: "/ai-tests", icon: History },
];

const opsItems = [
  { titleKey: "sidebar.servers", url: "/servers", icon: HardDrive },
  { titleKey: "sidebar.downloads", url: "/downloads", icon: Download },
  { titleKey: "sidebar.connect", url: "/connect", icon: Link2 },
  { titleKey: "sidebar.topology", url: "/topology", icon: Share2 },
  { titleKey: "sidebar.network", url: "/network", icon: Network },
  { titleKey: "sidebar.backups", url: "/backups", icon: Archive },
  { titleKey: "sidebar.operations", url: "/operations", icon: NotebookPen },
  { titleKey: "sidebar.logs", url: "/logs", icon: ScrollText },
  { titleKey: "sidebar.failover", url: "/failover", icon: ShieldAlert },
  { titleKey: "sidebar.deploy", url: "/deploy", icon: GitBranch },
  { titleKey: "sidebar.publish_sync", url: "/publish-sync", icon: Rocket },
  { titleKey: "sidebar.automation", url: "/automation", icon: Zap },
  { titleKey: "sidebar.domains", url: "/domains", icon: Server },
  { titleKey: "sidebar.hn_domains", url: "/hn-domains", icon: Globe2 },
  { titleKey: "sidebar.bridge", url: "/bridge", icon: Network },
  { titleKey: "sidebar.my_hosting", url: "/my-hosting", icon: Cloud },
  { titleKey: "sidebar.ssl", url: "/ssl", icon: ShieldCheck },
  { titleKey: "sidebar.certificates", url: "/certificates", icon: BadgeCheck },
  { titleKey: "sidebar.notifications", url: "/notifications", icon: Bell },
  { titleKey: "sidebar.environment", url: "/environment", icon: FileCog },
  { titleKey: "sidebar.activity", url: "/activity", icon: Activity },
  { titleKey: "sidebar.reports", url: "/reports", icon: FileBarChart },
];

const adminItems = [
  { titleKey: "sidebar.group_ids", url: "/group-ids", icon: Fingerprint },
  { titleKey: "sidebar.vault", url: "/vault", icon: KeyRound },
  { titleKey: "sidebar.recovery", url: "/recovery", icon: LifeBuoy },
  { titleKey: "sidebar.apk_manager", url: "/apk-manager", icon: Smartphone },
  { titleKey: "sidebar.clients", url: "/clients", icon: Users },
  { titleKey: "sidebar.users", url: "/users", icon: UserCog },
  { titleKey: "sidebar.subscriptions", url: "/subscriptions", icon: CreditCard },
  { titleKey: "sidebar.hosting", url: "/hosting", icon: Cloud },
  { titleKey: "sidebar.payment_providers", url: "/payment-providers", icon: Wallet },
  { titleKey: "sidebar.payments_hub", url: "/payments-hub", icon: Wallet },
  { titleKey: "sidebar.payment_accounts", url: "/payment-accounts", icon: Wallet },
  { titleKey: "sidebar.audit", url: "/audit", icon: ClipboardCheck },
  { titleKey: "sidebar.settings", url: "/settings", icon: Settings },
];



export function AppSidebar() {
  const { t } = useTranslation();
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
        <Link to="/" className="flex flex-col items-center gap-2 text-center">
          <img
            src={tvccLogo.url}
            alt="TVCC"
            className="w-14 h-14 rounded-xl object-cover shadow-md"
          />
          <div className="text-[11px] text-muted-foreground">{t("sidebar.tagline")}</div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {[
          { label: t("sidebar.core"), items: coreItems },
          { label: t("sidebar.ai"), items: aiItems },
          { label: t("sidebar.operations"), items: opsItems },
          { label: t("sidebar.admin"), items: adminItems },

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
                          <span>{t(item.titleKey)}</span>
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
          <span className="text-xs font-medium">{t("sidebar.export_html")}</span>
        </button>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4" />
              <span>{t("common.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
