import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Globe, Users, CreditCard, UserCog, Activity, Settings,
  Code2, LogOut, Wand2, FolderOpen, LayoutTemplate, Radio, ListChecks, Plug,
  Smartphone, KeyRound, Server, ShieldCheck, BadgeCheck, Bell, FileCog, LifeBuoy, ClipboardCheck,
  FileBarChart, Wallet, Boxes, Brain, Film, HardDrive, MessageSquare, History, NotebookPen, Archive, Network, Share2, ScrollText, ShieldAlert, GitBranch, Zap, Download, Link2, Cloud, Globe2, Fingerprint, Rocket, Radar, Database, Shield, HeartPulse, Package, Bot, Container,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlatformPageRules } from "@/hooks/use-platform-pages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportDashboardHtml } from "@/lib/html-export";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type AppLang } from "@/i18n";
import { useEffect, useState } from "react";
import tvccLogo from "@/assets/tvcc-logo.asset.json";
import i18n from "@/i18n";

function ManaraIcon(props: { className?: string }) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V6z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const coreItems = [
  { titleKey: "sidebar.dashboard", url: "/dashboard", icon: LayoutDashboard },
  { titleKey: "sidebar.websites", url: "/websites", icon: Globe },
  { titleKey: "sidebar.manara", url: "/manara", icon: ManaraIcon },
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

const fedItems = [
  { titleKey: "sidebar.fed_overview", url: "/federated", icon: Radar },
  { titleKey: "sidebar.fed_fleet", url: "/federated/fleet", icon: Globe },
  { titleKey: "sidebar.fed_sql", url: "/federated/sql", icon: Database },
  { titleKey: "sidebar.fed_mesh", url: "/federated/mesh", icon: Shield },
  { titleKey: "sidebar.fed_pitr", url: "/federated/pitr", icon: History },
  { titleKey: "sidebar.fed_healing", url: "/federated/healing", icon: HeartPulse },
  { titleKey: "sidebar.fed_assets", url: "/federated/assets", icon: Package },
  { titleKey: "sidebar.fed_db", url: "/federated/db", icon: Database },
  { titleKey: "sidebar.fed_agents", url: "/federated/agents", icon: Bot },
  { titleKey: "sidebar.fed_docker", url: "/federated/docker", icon: Container },
  { titleKey: "sidebar.fed_nginx", url: "/federated/nginx", icon: Globe },
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

function SidebarLink({ item, active }: { item: typeof coreItems[number]; active: boolean }) {
  const { t } = useTranslation();
  const { setOpenMobile, isMobile, setOpen } = useSidebar();

  const handleClick = () => {
    if (isMobile) setOpenMobile(false);
    // طيّ الشريط الجانبي تلقائياً إلى الأيقونات عند اختيار أي صفحة من لوحة التحكم.
    setOpen(false);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={t(item.titleKey)}
        title={t(item.titleKey)}
        className={
          "h-7 min-h-7 py-0.5 text-xs gap-2 " +
          (active
            ? "bg-primary/15 text-primary border-r-2 border-primary rounded-md"
            : "hover:bg-sidebar-accent")
        }
      >
        <Link to={item.url} onClick={handleClick}>
          <item.icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t(item.titleKey)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}



export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { primaryRole } = usePermissions();
  const { isVisible } = usePlatformPageRules();
  const { setOpen } = useSidebar();
  const [lang, setLang] = useState<AppLang>(i18n.language as AppLang);

  useEffect(() => {
    const onLangChanged = (lng: string) => setLang(lng as AppLang);
    i18n.on("languageChanged", onLangChanged);
    setLang(i18n.language as AppLang);
    return () => {
      i18n.off("languageChanged", onLangChanged);
    };
  }, []);

  const langDef = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const side = langDef.dir === "rtl" ? "right" : "left";

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
    <Sidebar collapsible="icon" side={side} className="border-l border-sidebar-border" dir={langDef.dir}>
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <Link to="/" className="flex flex-col items-center gap-1 text-center">
          <img
            src={tvccLogo.url}
            alt="TVCC"
            className="w-10 h-10 rounded-lg object-cover shadow"
          />
          <div className="text-[10px] text-muted-foreground font-medium leading-tight">{t("sidebar.tagline")}</div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1 py-1">
        {[
          { label: t("sidebar.core"), items: coreItems },
          { label: t("sidebar.federated"), items: fedItems },
          { label: t("sidebar.ai"), items: aiItems },
          { label: t("sidebar.operations"), items: opsItems },
          { label: t("sidebar.admin"), items: adminItems },
        ].map((section) => (
          <SidebarGroup key={section.label} className="py-1">
            <SidebarGroupLabel className="text-[9px] text-muted-foreground/70 px-1.5 py-0 leading-none">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {section.items
                  .filter((item) => primaryRole === "system_owner" || isVisible(item.url, primaryRole))
                  .map((item) => (
                    <SidebarLink key={item.url} item={item} active={isActive(item.url)} />
                  ))}
                {section.items === coreItems && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => {
                        handleExport();
                        setOpen(false);
                      }}
                      tooltip={t("sidebar.export_html")}
                      title={t("sidebar.export_html")}
                      className="h-7 min-h-7 py-0.5 text-xs gap-2 text-primary"
                    >
                      <Code2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t("sidebar.export_html")}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-1.5" />

    </Sidebar>
  );
}

