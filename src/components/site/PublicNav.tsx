import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { LogIn, LayoutDashboard, Eye, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import tvccLogo from "@/assets/tvcc-logo.asset.json";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLATFORM_LINKS = [
  { to: "/manara", key: "nav.manara", fallback: "منارة" },
  { to: "/pricing", key: "nav.pricing", fallback: "الأسعار" },
  { to: "/docs", key: "nav.docs", fallback: "التوثيق" },
  { to: "/blog", key: "nav.blog", fallback: "المدونة" },
] as const;

export function PublicNav({ logo, name, tagline }: { logo?: string; name?: string; tagline?: string }) {
  const { t, i18n } = useTranslation();
  const [signedIn, setSignedIn] = useState(false);
  const [visits, setVisits] = useState<number | null>(null);
  const rtl = i18n.dir() === "rtl";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSignedIn(!!session));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const key = "tvcc_visit_counted";
    const method = sessionStorage.getItem(key) ? "GET" : "POST";
    fetch("/api/public/visits", { method })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        sessionStorage.setItem(key, "1");
        setVisits(Number(d.counter));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const startDemo = () => {
    localStorage.setItem("tvcc_demo_mode", "1");
    window.location.href = "/pricing";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div
        className="container mx-auto px-4 h-16 flex items-center gap-4"
        dir={rtl ? "rtl" : "ltr"}
      >
        {/* الشعار يملأ ارتفاع الشريط ويتبع اتجاه اللغة */}
        <Link to="/" className="flex items-center gap-3 shrink-0 h-16">
          <img
            src={logo || tvccLogo.url}
            alt={name || "TVCC"}
            className="h-16 w-auto max-w-[120px] object-contain"
          />
          <span className="sr-only">{tagline || "TVCC"}</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-5 text-sm text-muted-foreground flex-1">
          <Link to="/" className="hover:text-foreground transition">
            {t("nav.home", { defaultValue: "الرئيسية" })}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 hover:text-foreground transition">
              {t("nav.platform", { defaultValue: "المنصة" })}
              <ChevronDown className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={rtl ? "end" : "start"}>
              <DropdownMenuItem asChild><Link to="/manara">منارة</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/pricing">الاستضافة والأسعار</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/docs">التوثيق</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {PLATFORM_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground transition">
              {t(l.key, { defaultValue: l.fallback })}
            </Link>
          ))}

          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_var(--success)]" />
            {t("nav.status", { defaultValue: "حالة النظام" })}
          </span>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher />
          {signedIn ? (
            <Button asChild size="sm" className="gap-2">
              <Link to="/dashboard"><LayoutDashboard className="w-4 h-4" />{t("nav.dashboard", { defaultValue: "لوحة التحكم" })}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/auth"><LogIn className="w-4 h-4" />{t("nav.login", { defaultValue: "الدخول" })}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth">{t("nav.start", { defaultValue: "ابدأ الآن" })}</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={startDemo} className="hidden md:inline-flex">
            {t("nav.demo", { defaultValue: "نسخة تجريبية" })}
          </Button>
          <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Eye className="w-3.5 h-3.5" />
            {visits === null ? "—" : visits.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </header>
  );
}
