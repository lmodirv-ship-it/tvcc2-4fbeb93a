import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Search, Settings as SettingsIcon, Home } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";

export function AppHeader() {
  const [email, setEmail] = useState<string>("");
  const { t } = useTranslation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  const initial = (email || "A").charAt(0).toUpperCase();

  return (
    <header className="h-16 flex items-center gap-4 border-b border-border bg-card/40 backdrop-blur px-5 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: "var(--gradient-primary)" }}
        >
          {initial}
        </div>
        <div className="hidden md:block">
          <div className="text-sm font-semibold leading-tight">Admin</div>
          <div className="text-[11px] text-muted-foreground">{t("header.admin")}</div>
        </div>
      </div>

      <Link
        to="/dashboard"
        aria-label="العودة للصفحة الرئيسية"
        title="العودة للصفحة الرئيسية"
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-success text-success-foreground hover:bg-success/90 text-sm font-medium transition shadow-sm"
      >
        <Home className="w-4 h-4" />
        <span className="hidden sm:inline">الرئيسية</span>
      </Link>

      <LanguageSwitcher />

      <Link to="/settings" aria-label={t("header.settings") as string} className="relative w-9 h-9 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center">
        <SettingsIcon className="w-4 h-4 text-muted-foreground" />
      </Link>
      <NotificationBell />

      <div className="flex-1 max-w-xl mx-auto relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("header.search_placeholder")}
          className="pr-9 bg-secondary/40 border-border/50 h-10"
        />
      </div>

      <SidebarTrigger className="ml-auto" />
    </header>
  );
}
